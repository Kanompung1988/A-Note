// Browser-side calls to A-Note's API routes.
import type { WorkCheck } from "./check";
import type { Region } from "./segment";
import type { Hints, Reply } from "./tutor";

export type { Hints, Region, Reply, WorkCheck };

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`);
  return json as T;
}

export const segment = (body: { image: string; size: { width: number; height: number }; box: { x: number; y: number; w: number; h: number } }) =>
  post<{ region: Region | null }>("/api/segment", body);

export const askTutor = (body: { crop: string; page: string; question?: string; context?: KeyContext }) =>
  post<{ responseId: string; hints: Hints; grounded: boolean }>("/api/tutor", body);

export const replyTutor = (body: { responseId: string; message: string; context?: KeyContext }) =>
  post<{ responseId: string } & Reply>("/api/tutor/reply", body);

/** Which worksheet and question a call is about, so the server can use the teacher's answer key. */
export type KeyContext = {
  question: number | null;
  source: { code: string; studentId: string; assignmentId: string } | { sampleId: string };
};

export const checkWork = (body: { crop: string; page: string; lineCount: number; context?: KeyContext }) =>
  post<{ check: WorkCheck; grounded: boolean }>("/api/check", body);

export const drawPicture = (brief: string) => post<{ image: string }>("/api/picture", { brief });
