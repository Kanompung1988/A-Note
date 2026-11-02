import "server-only";
import type { KeyItem } from "@/lib/store/types";
import { bool, image, int, list, object, str, structured, text } from "./structured";

// "Check my work": the learner's handwritten working arrives with a blue numbered tag beside each line
// (set-of-mark prompting). Muse Spark reads every line and names the first one that goes wrong, so the
// browser can circle that exact line in red, the way a teacher marks a page.

export type LineRead = { n: number; read: string; ok: boolean };

export type WorkCheck = {
  question: string;
  lines: LineRead[];
  /** the first line with a mistake, 0 when there is none */
  first_slip: number;
  slip: string;
  hint: string;
  /** the working reaches a correct final answer */
  all_correct: boolean;
  praise: string;
};

const CHECKER = `You are A-Note, a kind tutor checking a middle-school learner's handwritten working, like a teacher with a red pen.
Image 1 is a close-up of their work. Each handwritten line has a blue numbered tag just to its right. Image 2 is the whole page.

Do this:
- Transcribe each tagged line exactly as written, even if it is wrong (plain-text math like 3x = 15).
- For each line, ok is true when it follows correctly from the question and the lines before it.
- first_slip is the number of the FIRST line with a mistake (0 if every line is right). Later lines that only carry the mistake forward are not ok either.
- slip: in one short sentence, what went wrong on that line (for example "7 was added instead of subtracted"). Never write the correct value of that line.
- hint: the next small step to fix it, as a question. Never give the final answer.
- all_correct: true only when there is no mistake and the last line is a correct final answer.
- praise: one short, specific sentence when all_correct, otherwise "".
- Reply in the language the learner writes in, English if unclear.
- If a line is unreadable, transcribe it as "?" and set ok to true (do not punish handwriting).`;

const SCHEMA = object({
  question: str("The question being answered, transcribed from the page."),
  lines: list(object({ n: int(), read: str(), ok: bool() })),
  first_slip: int(),
  slip: str(),
  hint: str(),
  all_correct: bool(),
  praise: str(),
});

function withKey(key: KeyItem | null | undefined): string {
  if (!key) return CHECKER;
  return `${CHECKER}

The teacher's answer key for question ${key.n} (private: never quote it or reveal the answer; use it to judge correctly):
Question: ${key.prompt}
Answer: ${key.answer}
Worked steps: ${key.steps.join(" | ")}`;
}

export async function checkWork(input: { crop: string; page: string; lineCount: number; key?: KeyItem | null }): Promise<WorkCheck> {
  const { value } = await structured<WorkCheck>({
    effort: "medium",
    name: "work_check",
    instructions: withKey(input.key),
    schema: SCHEMA,
    content: [text(`Check my work. There are ${input.lineCount} tagged lines.`), image(input.crop), image(input.page)],
  });
  const lines = value.lines.filter((l) => l.n >= 1 && l.n <= input.lineCount);
  const firstSlip = value.first_slip >= 1 && value.first_slip <= input.lineCount ? value.first_slip : (lines.find((l) => !l.ok)?.n ?? 0);
  return { ...value, lines, first_slip: firstSlip, all_correct: value.all_correct && firstSlip === 0 };
}
