import "server-only";
import { createResponse, MODELS, outputText } from "@/lib/meta/client";

export type SpotBrief = {
  id: number;
  learners: number;
  asks: number;
  solved: number;
  circled: string[];
  topics: string[];
};

export type ClassInsight = {
  summary: string;
  spots: { id: number; concept: string; misconception: string; reteach: string }[];
  next_step: string;
};

const INSIGHT = `You help a middle-school teacher see where their class got stuck on a worksheet.
The image is the worksheet. Each numbered orange box marks a spot learners circled to ask A-Note, the class tutor, for help.
The JSON lists, for each numbered spot, how many learners circled it, how many solved it after hints,
what the tutor read inside the circle, and the topic it named.

Write for a busy teacher:
- summary: two sentences on the overall picture, naming the spot most learners struggled with.
- spots: for every numbered spot, the concept being practised, the most likely misconception given what is on the page,
  and a re-teach the teacher can run in five minutes tomorrow (two or three concrete sentences, using the page's own numbers).
- next_step: one concrete thing to do first.
Refer to questions by their number on the worksheet ("question 2"), not by spot number, and write naturally.
Only use the data given. Do not invent learners, scores or quotes.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "spots", "next_step"],
  properties: {
    summary: { type: "string" },
    spots: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "concept", "misconception", "reteach"],
        properties: {
          id: { type: "integer" },
          concept: { type: "string" },
          misconception: { type: "string" },
          reteach: { type: "string" },
        },
      },
    },
    next_step: { type: "string" },
  },
};

export async function classInsight(input: { page: string; sheetTitle: string; learnersInClass: number; spots: SpotBrief[] }): Promise<ClassInsight> {
  const response = await createResponse({
    model: MODELS.tutor,
    reasoning: { effort: "medium" },
    instructions: INSIGHT,
    input: [
      {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({ worksheet: input.sheetTitle, learners_in_class: input.learnersInClass, spots: input.spots }),
          },
          { type: "input_image", image_url: input.page },
        ],
      },
    ],
    text: { format: { type: "json_schema", name: "class_insight", schema: SCHEMA, strict: true } },
  });
  return JSON.parse(outputText(response)) as ClassInsight;
}
