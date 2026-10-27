import "server-only";

// Thin client for the Meta Model API (https://dev.meta.ai/docs/overview).
// Every model call in A-Note goes through this file.

const BASE_URL = process.env.META_API_BASE_URL ?? "https://api.meta.ai/v1";

export const MODELS = {
  tutor: "muse-spark-1.3",
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

export type ResponseRequest = {
  model: string;
  input: unknown;
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

export type MetaResponse = {
  id: string;
  model: string;
  output_text?: string;
  output?: { type: string; content?: { type: string; text?: string }[] }[];
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

export async function listModels(): Promise<string[]> {
  const res = await metaFetch("/models");
  const json: { data?: { id: string }[] } = await res.json();
  return (json.data ?? []).map((m) => m.id).sort();
}
