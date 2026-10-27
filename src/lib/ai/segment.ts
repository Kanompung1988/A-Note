import "server-only";
import {
  buildObjectPrompt,
  decodeMaskToSVGPath,
  parseImageStream,
  recordsOfKind,
  type ResponsesEvent,
} from "@meta-sam/parser";
import { createResponse, MODELS, outputText } from "@/lib/meta/client";

/** SAM's mask of what the learner circled, in the pixels of the image that was sent. */
export type Region = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  confidence: number | null;
  /** outline of the mask in raster space (maskWidth × maskHeight), which stretches over the bounds */
  path: string;
  maskWidth: number;
  maskHeight: number;
};

type Rect = { x: number; y: number; w: number; h: number };

/**
 * Asks SAM 3.1 for the object inside the learner's loop. The loop's bounding box is the box prompt,
 * so a rough circle becomes a tight mask of the equation, figure or word the learner meant.
 */
export async function segmentRegion(image: string, size: { width: number; height: number }, loop: Rect): Promise<Region | null> {
  const left = clamp(Math.floor(loop.x), 0, size.width - 1);
  const top = clamp(Math.floor(loop.y), 0, size.height - 1);
  const right = clamp(Math.ceil(loop.x + loop.w), left + 1, size.width);
  const bottom = clamp(Math.ceil(loop.y + loop.h), top + 1, size.height);
  const prompt = buildObjectPrompt({ size, objects: [{ id: 1, prompts: [{ box: { left, top, right, bottom } }] }] });

  const response = await createResponse({
    model: MODELS.segment,
    input: [
      {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: image },
        ],
      },
    ],
    metadata: { include_confidence: "true" },
  });

  const text = outputText(response);
  if (!text.trim()) return null;

  const parsed = parseImageStream(asEvents(text));
  for await (const snapshot of parsed) void snapshot;
  const { records } = await parsed.finalResult;
  const mask = recordsOfKind(records, "mask")[0];
  if (!mask) return null;

  return {
    ...mask.bounds,
    confidence: mask.confidence ?? null,
    path: decodeMaskToSVGPath(mask.mask),
    maskWidth: mask.mask.width,
    maskHeight: mask.mask.height,
  };
}

// We call SAM without streaming, so replay the finished text as the event sequence the parser reads.
async function* asEvents(text: string): AsyncIterable<ResponsesEvent> {
  const lane = { item_id: "output", output_index: 0, content_index: 0 };
  yield { type: "response.output_text.delta", ...lane, delta: text };
  yield { type: "response.output_text.done", ...lane, text };
  yield { type: "response.completed" };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
