import "server-only";
import { MODELS } from "@/lib/meta/client";
import { sameAnswer } from "./answers";
import { bool, int, list, object, str, structured, text } from "./structured";

// Every answer key A-Note writes is checked before a learner sees it: Muse Wonder solves each question
// on its own, without the key, and the two answers must agree. Short answers are compared in code;
// worded ones go to a judge that sees both.

export type Verdict = {
  index: number;
  agrees: boolean;
  /** what the independent solve got */
  independent: string;
  /** why they disagree, empty when they agree */
  reason: string;
};

const SOLVE = `Solve each question on your own, as a careful teacher writing an answer key.
Every question must be answerable from its text alone. If one is ambiguous or impossible, say so in the answer, starting with "AMBIGUOUS:".
Give only the final answer for each, short (for example "x = 5" or "550 baht" or one sentence).`;

const JUDGE = `Two teachers answered the same questions independently. For each pair, decide whether both answers say the same thing
(equivalent forms count: "x = 5" and "5", "half" and "1/2"). For open questions, they agree when they reach the same conclusion.
If they disagree, give a one-sentence reason naming which one looks right.`;

export async function verifyItems(items: { prompt: string; answer: string }[], context: string): Promise<Verdict[]> {
  if (!items.length) return [];
  const solved = await structured<{ answers: { n: number; answer: string }[] }>({
    model: MODELS.verify,
    effort: "low",
    name: "independent_solve",
    instructions: SOLVE,
    schema: object({ answers: list(object({ n: int(), answer: str() })) }),
    content: [text(`${context}\n\n${items.map((q, i) => `${i + 1}. ${q.prompt}`).join("\n")}`)],
  });
  const independent = items.map((_, i) => solved.value.answers.find((a) => a.n === i + 1)?.answer?.trim() ?? "");

  const verdicts: Verdict[] = items.map((item, index) => {
    const theirs = independent[index];
    const ambiguous = /^ambiguous/i.test(theirs);
    const same = ambiguous ? false : sameAnswer(item.answer, theirs);
    return {
      index,
      agrees: same === true,
      independent: theirs,
      reason: ambiguous ? theirs : same === false ? `The independent solve got "${theirs}".` : "",
    };
  });

  // no verdict yet and no reason: the answers need reading
  const unsure = verdicts.filter((v) => !v.agrees && !v.reason);
  if (unsure.length) {
    const judged = await structured<{ pairs: { n: number; agree: boolean; reason: string }[] }>({
      effort: "low",
      name: "answer_judge",
      instructions: JUDGE,
      schema: object({ pairs: list(object({ n: int(), agree: bool(), reason: str() })) }),
      content: [
        text(
          unsure
            .map((v) => `${v.index + 1}. Question: ${items[v.index].prompt}\n   Answer A: ${items[v.index].answer}\n   Answer B: ${v.independent}`)
            .join("\n\n"),
        ),
      ],
    });
    for (const v of unsure) {
      const pair = judged.value.pairs.find((p) => p.n === v.index + 1);
      v.agrees = Boolean(pair?.agree);
      v.reason = v.agrees ? "" : pair?.reason || `The independent solve got "${v.independent}".`;
    }
  }
  return verdicts;
}
