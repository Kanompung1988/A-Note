import "server-only";
import { createImage, MODELS } from "@/lib/meta/client";
import type { Sheet } from "@/lib/sheets";
import { saveFile } from "@/lib/store/files";
import type { AnswerKey, KeyItem } from "@/lib/store/types";
import { layoutWorksheet, type LayoutQuestion } from "@/lib/worksheet/layout";
import { list, object, str, structured, text } from "./structured";
import { verifyItems, type Verdict } from "./verify";

// Writes a worksheet from a teacher's request: Muse Spark drafts questions and a private answer key,
// Muse Wonder re-solves every question to verify the key (failures are rewritten once, then dropped),
// Muse Image draws a scene for the top of the page, and the page is laid out as an SVG.

export type QuestionDraft = LayoutQuestion & { answer: string; steps: string[]; skill: string };

export type WorksheetRequest = {
  topic: string;
  grade: string;
  count: number;
  language: string;
  picture: boolean;
};

export type Progress = { stage: "writing" | "drawing" | "verifying" | "repairing" | "layout"; detail: string };

export type Published = { sheet: Sheet; key: AnswerKey; verdicts: Verdict[] };

const KIND = { type: "string", enum: ["short", "working", "explain"] };
const QUESTION = object({
  prompt: str("The question as printed. Plain-text math such as 3x + 7 = 22 or x/4."),
  kind: KIND,
  answer: str("Final answer only, short."),
  steps: list(str(), "Two to four worked steps for the teacher's key."),
  skill: str("The specific skill practised, two to five words."),
});

const DRAFT_SCHEMA = object({
  title: str("Short worksheet title."),
  subject: str("One word: Math, Science, English, Social Studies, ..."),
  instructions: str("One line telling learners what to do."),
  picture_prompt: str("Illustration brief, or empty."),
  questions: list(QUESTION),
});

const WRITER = `You write worksheets for real classrooms that a teacher can print and hand out tomorrow.
Rules:
- Order questions from easiest to hardest. Each one practises one clear skill.
- Every question must be answerable from its own text alone: no "see the picture", no references to other questions.
- One unambiguous answer per question. Friendly numbers for the grade.
- Plain-text math (3x + 7 = 22, x/4, 2^3, 3.5 cm). No LaTeX.
- kind: "short" for one-line answers, "working" for multi-step calculations, "explain" for answers in sentences.
- Contexts from learners' everyday lives, varied across questions.
- Write all learner-facing text in the requested language. answer, steps and skill may use the same language.`;

const PICTURE_STYLE =
  "Flat, friendly educational illustration with soft colours on a plain white background. No words, letters, numbers or labels anywhere in the image.";

export async function draftWorksheet(req: WorksheetRequest) {
  const { value } = await structured<{ title: string; subject: string; instructions: string; picture_prompt: string; questions: QuestionDraft[] }>({
    effort: "medium",
    name: "worksheet",
    instructions: WRITER,
    schema: DRAFT_SCHEMA,
    content: [
      text(
        `Topic: ${req.topic}\nLearners: ${req.grade}\nNumber of questions: ${req.count}\nLanguage: ${req.language}\n` +
          (req.picture
            ? `picture_prompt: one sentence describing a single scene for the top of the sheet that sets the context (no answers, no text in the image).`
            : `picture_prompt: "" (no picture).`),
      ),
    ],
  });
  return { ...value, questions: value.questions.slice(0, Math.max(1, req.count)) };
}

/** Verifies questions with an independent solve; rewrites failures once, re-verifies, then keeps only what passes. */
export async function* verifyAndRepair(
  questions: QuestionDraft[],
  context: string,
  minKeep = 2,
): AsyncGenerator<Progress, { questions: QuestionDraft[]; verdicts: Verdict[] }> {
  yield { stage: "verifying", detail: `Muse Wonder is solving all ${questions.length} questions on its own` };
  let verdicts = await verifyItems(questions, context);
  const failed = verdicts.filter((v) => !v.agrees);
  if (!failed.length) return { questions, verdicts };

  yield { stage: "repairing", detail: `${failed.length} ${failed.length === 1 ? "answer didn't" : "answers didn't"} match — rewriting` };
  const { value } = await structured<{ questions: QuestionDraft[] }>({
    effort: "medium",
    name: "repaired_questions",
    instructions: `${WRITER}

An independent solver disagreed with these answer keys. For each one, rewrite the question so it has exactly one clear answer
(or fix the answer if the question was fine), keeping the same skill, kind and language.`,
    schema: object({ questions: list(QUESTION) }),
    content: [
      text(
        failed
          .map((v, i) => `${i + 1}. Question: ${questions[v.index].prompt}\n   Your answer: ${questions[v.index].answer}\n   Independent answer: ${v.independent}\n   Note: ${v.reason}`)
          .join("\n\n"),
      ),
    ],
  });
  const repaired = [...questions];
  failed.forEach((v, i) => {
    if (value.questions[i]) repaired[v.index] = value.questions[i];
  });

  yield { stage: "verifying", detail: "Checking the rewritten questions again" };
  const second = await verifyItems(
    failed.map((v) => repaired[v.index]),
    context,
  );
  verdicts = verdicts.map((v) => {
    const k = failed.findIndex((f) => f.index === v.index);
    return k >= 0 ? { ...second[k], index: v.index } : v;
  });

  const passing = repaired.filter((_, i) => verdicts[i].agrees);
  if (passing.length >= minKeep) {
    return { questions: passing, verdicts: verdicts.filter((v) => v.agrees).map((v, i) => ({ ...v, index: i })) };
  }
  return { questions: repaired, verdicts };
}

/** Runs a progress generator to the end and returns its result. */
export async function settle<T>(pipeline: AsyncGenerator<unknown, T>): Promise<T> {
  for (;;) {
    const next = await pipeline.next();
    if (next.done) return next.value;
  }
}

export async function drawPicture(brief: string): Promise<string | null> {
  if (!brief.trim()) return null;
  try {
    return (await createImage(`${brief.trim()} ${PICTURE_STYLE}`, "1024x768")).dataUrl;
  } catch (error) {
    console.error("[image]", error instanceof Error ? error.message : error);
    return null;
  }
}

/** Lays out the page, stores it, and returns the sheet with its private answer key. */
export async function publishSheet(input: {
  title: string;
  subtitle: string;
  subject: string;
  instructions: string;
  questions: QuestionDraft[];
  verdicts: Verdict[];
  picture: string | null;
}): Promise<Published> {
  const layout = layoutWorksheet({
    title: input.title,
    subtitle: input.subtitle,
    instructions: input.instructions,
    questions: input.questions,
    picture: input.picture ? { dataUrl: input.picture, width: 4, height: 3 } : null,
    footer: `Written by A-Note · ${MODELS.tutor} · answer key verified by ${MODELS.verify}`,
  });
  const id = await saveFile(new TextEncoder().encode(layout.svg), "image/svg+xml");
  const items: KeyItem[] = input.questions.map((q, i) => ({
    n: i + 1,
    prompt: q.prompt,
    answer: q.answer,
    steps: q.steps,
    skill: q.skill,
    verified: input.verdicts[i]?.agrees ?? null,
  }));
  return {
    sheet: {
      id,
      title: input.title,
      src: `/api/files/${id}`,
      width: layout.width,
      height: layout.height,
      subject: input.subject,
      questions: layout.questions,
    },
    key: { items },
    verdicts: input.verdicts,
  };
}

/** The whole pipeline for the teacher's "Create with A-Note". */
export async function* createWorksheet(req: WorksheetRequest): AsyncGenerator<Progress, Published> {
  yield { stage: "writing", detail: `Muse Spark is writing ${req.count} questions on ${req.topic}` };
  const draft = await draftWorksheet(req);

  const picture = req.picture && draft.picture_prompt ? drawPicture(draft.picture_prompt) : Promise.resolve(null);
  if (req.picture && draft.picture_prompt) yield { stage: "drawing", detail: "Muse Image is drawing the picture" };

  const context = `Learners: ${req.grade}. Topic: ${req.topic}. Language: ${req.language}.`;
  const checked = yield* verifyAndRepair(draft.questions, context);

  yield { stage: "layout", detail: "Laying out the page" };
  return publishSheet({
    title: draft.title,
    subtitle: `${req.grade} · ${draft.subject}`,
    subject: draft.subject,
    instructions: draft.instructions,
    questions: checked.questions,
    verdicts: checked.verdicts,
    picture: await picture,
  });
}
