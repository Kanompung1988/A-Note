import "server-only";
import { createResponse, MODELS, outputText, type ReasoningEffort } from "@/lib/meta/client";
import type { KeyItem } from "@/lib/store/types";

// First hints need care (reading the page); follow-ups are short checks and should feel quick.
const HINTS_EFFORT: ReasoningEffort = "medium";
const REPLY_EFFORT: ReasoningEffort = "low";

const TUTOR = `You are A-Note, a warm, patient tutor for middle-school learners.
The learner drew an orange loop around the part of their worksheet they don't understand.
Image 1 is a close-up of what they circled. Image 2 is the whole page, for context.

Rules:
- Reply in the language the learner writes in. If they wrote nothing, reply in English.
- Never state the final answer. Teach with small hints: one idea per hint, one or two short sentences each.
- Point at what is really on the page: the exact numbers, words and figures.
- Talk like a kind older friend. No lectures. Questions end with a question mark.
- If the circled part is unreadable or not schoolwork, say so gently in "circled" and give one hint that asks them to circle again.`;

/** The teacher's key goes in the instructions, never in what the learner sees. */
function withKey(instructions: string, key: KeyItem | null | undefined): string {
  if (!key) return instructions;
  return `${instructions}

The teacher's answer key for question ${key.n} (private: never quote it, never give the final answer or reveal these steps outright;
use it only so every hint and check leads the right way, and so you never mark a wrong answer as right):
Question: ${key.prompt}
Answer: ${key.answer}
Worked steps: ${key.steps.join(" | ")}`;
}

export type Hints = {
  /** what the tutor sees inside the loop, transcribed */
  circled: string;
  topic: string;
  steps: string[];
  /** a short question the learner answers to show they got it */
  check: string;
  /** a brief for Muse Image: one picture that would make the idea click, or "" */
  picture: string;
};

export type Reply = {
  reply: string;
  /** true once the learner has reached a correct answer on their own */
  solved: boolean;
};

const HINTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["circled", "topic", "steps", "check", "picture"],
  properties: {
    circled: { type: "string", description: "Exactly what the learner circled, transcribed (use plain-text math like 3x + 7 = 22)." },
    topic: { type: "string", description: "The topic in a few words." },
    steps: {
      type: "array",
      items: { type: "string" },
      description: "Two to four hints, each a single small step, never the final answer.",
    },
    check: { type: "string", description: "One short question the learner can answer to show they understand." },
    picture: {
      type: "string",
      description:
        "One sentence for an illustrator: a simple real-world picture or analogy that would make this idea click (for example a balance scale for equations). No words or numbers in it, and it must not show the answer. Empty string if a picture would not help.",
    },
  },
};

const REPLY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "solved"],
  properties: {
    reply: { type: "string", description: "Your answer to the learner, at most three short sentences." },
    solved: { type: "boolean", description: "True only when the learner reached a correct answer themselves." },
  },
};

export async function firstHints(input: { crop: string; page: string; question?: string; key?: KeyItem | null }) {
  const response = await createResponse({
    model: MODELS.tutor,
    reasoning: { effort: HINTS_EFFORT },
    instructions: withKey(TUTOR, input.key),
    input: [
      {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: input.question?.trim() || "I don't get this part." },
          { type: "input_image", image_url: input.crop },
          { type: "input_image", image_url: input.page },
        ],
      },
    ],
    text: { format: { type: "json_schema", name: "tutor_hints", schema: HINTS_SCHEMA, strict: true } },
  });
  return { responseId: response.id, hints: parseJson<Hints>(outputText(response)), grounded: Boolean(input.key) };
}

/** Continues the conversation; the images stay in context through previous_response_id. */
export async function replyTo(input: { responseId: string; message: string; key?: KeyItem | null }) {
  const response = await createResponse({
    model: MODELS.tutor,
    reasoning: { effort: REPLY_EFFORT },
    instructions: withKey(
      `${TUTOR}

The learner is now answering or asking a follow-up. Check their thinking step by step.
If they are right, say so briefly and why it works, and set solved to true.
If not, point to the exact slip and give the next small hint. Still never give the final answer.`,
      input.key,
    ),
    previous_response_id: input.responseId,
    input: [{ type: "message", role: "user", content: [{ type: "input_text", text: input.message }] }],
    text: { format: { type: "json_schema", name: "tutor_reply", schema: REPLY_SCHEMA, strict: true } },
  });
  return { responseId: response.id, ...parseJson<Reply>(outputText(response)) };
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Tutor returned malformed JSON: ${text.slice(0, 200)}`);
  }
}
