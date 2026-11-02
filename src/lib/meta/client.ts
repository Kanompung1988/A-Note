import "server-only";

// Thin client for the Meta Model API (https://dev.meta.ai/docs/overview).
// Every model call in A-Note goes through this file.

const BASE_URL = process.env.META_API_BASE_URL ?? "https://api.meta.ai/v1";

export const MODELS = {
  /** tutoring, checking work, writing worksheets and running the class co-pilot */
  tutor: "muse-spark-1.3",
  /** a second, stronger model solves every generated question on its own to verify the answer key */
  verify: "muse-wonder-1.0",
  /** pictures for "Show me" hints and generated worksheets */
  image: "muse-image-1.0",
  segment: "sam-3.1",
  transcribe: "muse-voice-transcribe-1.0",
} as const;

export type ReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export class MetaApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Meta Model API ${status}: ${body.slice(0, 300)}`);
    this.name = "MetaApiError";
  }
}

function apiKey(): string {
  const key = process.env.META_API_KEY;
  if (!key) throw new Error("META_API_KEY is not set");
  return key;
}

export async function metaFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${apiKey()}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (!res.ok) throw new MetaApiError(res.status, await res.text());
  return res;
}

export type FunctionTool = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
};

export type ResponseRequest = {
  model: string;
  input: unknown;
  tools?: FunctionTool[];
  parallel_tool_calls?: boolean;
  instructions?: string;
  reasoning?: { effort: ReasoningEffort };
  max_output_tokens?: number;
  previous_response_id?: string;
  metadata?: Record<string, string>;
  text?: { format: { type: "json_schema"; name: string; schema: Record<string, unknown>; strict?: boolean } };
};

export type ResponseUsage = {
  input_tokens: number;
  output_tokens: number;
  output_tokens_details?: { reasoning_tokens?: number };
};

export type OutputItem = {
  type: string;
  content?: { type: string; text?: string }[];
  /** function_call items */
  name?: string;
  arguments?: string;
  call_id?: string;
};

export type MetaResponse = {
  id: string;
  model: string;
  output_text?: string;
  output?: OutputItem[];
  usage?: ResponseUsage;
};

export async function createResponse(body: ResponseRequest, signal?: AbortSignal): Promise<MetaResponse> {
  const res = await metaFetch("/responses", { method: "POST", body: JSON.stringify(body), signal });
  return res.json();
}

// The REST body does not always carry `output_text` (the SDKs compute it), so join the parts ourselves.
export function outputText(response: MetaResponse): string {
  if (response.output_text) return response.output_text;
  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text" && part.text)
    .map((part) => part.text)
    .join("");
}

export type FunctionCall = { name: string; arguments: string; callId: string };

export function functionCalls(response: MetaResponse): FunctionCall[] {
  return (response.output ?? [])
    .filter((item) => item.type === "function_call" && item.name && item.call_id)
    .map((item) => ({ name: item.name!, arguments: item.arguments ?? "{}", callId: item.call_id! }));
}

/** Muse Image: one picture as a data URL. Built-in search and shell tools stay off. */
export async function createImage(prompt: string, size = "1024x768", signal?: AbortSignal): Promise<{ dataUrl: string; bytes: Uint8Array; type: string }> {
  const res = await metaFetch("/images/generations", {
    method: "POST",
    signal,
    body: JSON.stringify({
      model: MODELS.image,
      prompt,
      size,
      n: 1,
      output_format: "jpeg",
      tool_enablement: { enable_image_search: false, enable_web_search: false, enable_shell: false },
    }),
  });
  const json: { data?: { b64_json?: string }[] } = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new MetaApiError(502, "image response had no data");
  return { dataUrl: `data:image/jpeg;base64,${b64}`, bytes: new Uint8Array(Buffer.from(b64, "base64")), type: "image/jpeg" };
}

export async function listModels(): Promise<string[]> {
  const res = await metaFetch("/models");
  const json: { data?: { id: string }[] } = await res.json();
  return (json.data ?? []).map((m) => m.id).sort();
}
