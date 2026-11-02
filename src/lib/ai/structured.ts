import "server-only";
import { createResponse, MODELS, outputText, type ReasoningEffort } from "@/lib/meta/client";

export type Part = { type: "input_text"; text: string } | { type: "input_image"; image_url: string };

export const text = (value: string): Part => ({ type: "input_text", text: value });
export const image = (url: string): Part => ({ type: "input_image", image_url: url });

/** One model call that must answer with JSON matching `schema`. */
export async function structured<T>(request: {
  name: string;
  schema: Record<string, unknown>;
  instructions: string;
  content: Part[];
  model?: string;
  effort?: ReasoningEffort;
  previousResponseId?: string;
  signal?: AbortSignal;
}): Promise<{ id: string; value: T }> {
  const response = await createResponse(
    {
      model: request.model ?? MODELS.tutor,
      reasoning: { effort: request.effort ?? "low" },
      instructions: request.instructions,
      previous_response_id: request.previousResponseId,
      input: [{ type: "message", role: "user", content: request.content }],
      text: { format: { type: "json_schema", name: request.name, schema: request.schema, strict: true } },
    },
    request.signal,
  );
  const raw = outputText(response);
  try {
    return { id: response.id, value: JSON.parse(raw) as T };
  } catch {
    throw new Error(`${request.name}: malformed JSON: ${raw.slice(0, 200)}`);
  }
}

/** A strict JSON-schema object: every property required, nothing extra. */
export function object(properties: Record<string, unknown>): Record<string, unknown> {
  return { type: "object", additionalProperties: false, required: Object.keys(properties), properties };
}

export const str = (description?: string) => ({ type: "string", ...(description && { description }) });
export const int = (description?: string) => ({ type: "integer", ...(description && { description }) });
export const bool = (description?: string) => ({ type: "boolean", ...(description && { description }) });
export const list = (items: unknown, description?: string) => ({ type: "array", items, ...(description && { description }) });
