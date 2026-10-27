// Browser-side calls to A-Note's API routes.
import type { Region } from "./segment";
import type { Hints, Reply } from "./tutor";

export type { Hints, Region, Reply };

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`);
  return json as T;
}

export const segment = (body: { image: string; size: { width: number; height: number }; box: { x: number; y: number; w: number; h: number } }) =>
  post<{ region: Region | null }>("/api/segment", body);

export const askTutor = (body: { crop: string; page: string; question?: string }) =>
  post<{ responseId: string; hints: Hints }>("/api/tutor", body);

export const replyTutor = (body: { responseId: string; message: string }) =>
  post<{ responseId: string } & Reply>("/api/tutor/reply", body);
