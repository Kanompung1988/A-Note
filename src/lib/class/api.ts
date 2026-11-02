// Browser-side calls for classes, asks, uploads and voice.
import type { ClassInsight } from "@/lib/ai/insights";
import type { Box, Stroke } from "@/lib/ink/geometry";
import type { PageRegion } from "@/lib/regions";
import type { Assignment, Dashboard, PublicClass, Student, WorkRecord } from "@/lib/store/types";

export type { ClassInsight, Dashboard, PublicClass, WorkRecord };

async function request<T>(url: string, init: RequestInit & { teacherKey?: string } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.teacherKey) headers.set("x-teacher-key", init.teacherKey);
  if (typeof init.body === "string") headers.set("Content-Type", "application/json");
  const res = await fetch(url, { ...init, headers });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`);
  return json as T;
}

const json = (body: unknown) => JSON.stringify(body);

export const createClass = (name: string, teacherName: string) =>
  request<{ code: string; name: string; teacherKey: string }>("/api/classes", { method: "POST", body: json({ name, teacherName }) });

export const getClass = (code: string, studentId?: string) =>
  request<PublicClass>(`/api/classes/${encodeURIComponent(code)}${studentId ? `?student=${encodeURIComponent(studentId)}` : ""}`, { cache: "no-store" });

export const joinClass = (code: string, name: string) =>
  request<{ student: Student; classRoom: PublicClass }>(`/api/classes/${encodeURIComponent(code)}/join`, {
    method: "POST",
    body: json({ name }),
  });

export const getDashboard = (code: string, teacherKey: string) =>
  request<Dashboard>(`/api/classes/${encodeURIComponent(code)}/dashboard`, { teacherKey, cache: "no-store" });

export const assignSample = (code: string, teacherKey: string, sampleId: string) =>
  request<Assignment>(`/api/classes/${encodeURIComponent(code)}/assignments`, { method: "POST", teacherKey, body: json({ sampleId }) });

export const assignUpload = (code: string, teacherKey: string, upload: { fileId: string; title: string; width: number; height: number }) =>
  request<Assignment>(`/api/classes/${encodeURIComponent(code)}/assignments`, { method: "POST", teacherKey, body: json({ upload }) });

export const unassign = (code: string, teacherKey: string, assignmentId: string) =>
  request<void>(`/api/classes/${encodeURIComponent(code)}/assignments?id=${encodeURIComponent(assignmentId)}`, {
    method: "DELETE",
    teacherKey,
  });

export async function uploadImage(code: string, teacherKey: string, file: Blob, name: string) {
  const form = new FormData();
  form.append("file", file, name);
  return request<{ id: string; url: string }>(`/api/files?code=${encodeURIComponent(code)}`, { method: "POST", teacherKey, body: form });
}

export const classInsight = (code: string, teacherKey: string, assignmentId: string, page: string) =>
  request<{ insight: ClassInsight; spotCount: number; at: string }>(`/api/classes/${encodeURIComponent(code)}/insights`, {
    method: "POST",
    teacherKey,
    body: json({ assignmentId, page }),
  });

export const recordAsk = (body: { code: string; studentId: string; assignmentId: string; loop: Box; kind?: "ask" | "check" }) =>
  request<{ id: string }>("/api/asks", { method: "POST", body: json(body) });

export type AskProgress = {
  region?: PageRegion | null;
  circled?: string;
  topic?: string;
  slip?: string | null;
  hintsSeen?: number;
  replies?: number;
  solved?: boolean;
};

export const updateAskRecord = (askId: string, studentId: string, patch: AskProgress) =>
  request<void>(`/api/asks/${encodeURIComponent(askId)}`, { method: "PATCH", body: json({ studentId, ...patch }) });

export async function transcribeWav(wav: Blob): Promise<string> {
  const form = new FormData();
  form.append("audio", wav, "question.wav");
  return (await request<{ text: string }>("/api/transcribe", { method: "POST", body: form })).text;
}

/** Reads a newline-delimited JSON stream, calling `onEvent` for each line as it arrives. */
async function stream(url: string, init: RequestInit & { teacherKey?: string }, onEvent: (event: StreamEvent) => void): Promise<void> {
  const headers = new Headers(init.headers);
  if (init.teacherKey) headers.set("x-teacher-key", init.teacherKey);
  headers.set("Content-Type", "application/json");
  const res = await fetch(url, { ...init, headers });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body.error === "string" ? body.error : `HTTP ${res.status}`);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += value;
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) onEvent(JSON.parse(line) as StreamEvent);
      newline = buffer.indexOf("\n");
    }
    if (done) break;
  }
}

export type StreamEvent = { type: string; [key: string]: unknown };

export type WorksheetRequest = { topic: string; grade: string; count: number; language: string; picture: boolean };

export const generateWorksheet = (code: string, teacherKey: string, body: WorksheetRequest, onEvent: (event: StreamEvent) => void) =>
  stream(`/api/classes/${encodeURIComponent(code)}/generate`, { method: "POST", teacherKey, body: json(body) }, onEvent);

export const publishDraft = (code: string, teacherKey: string, id: string) =>
  request<Assignment>(`/api/classes/${encodeURIComponent(code)}/assignments`, { method: "PATCH", teacherKey, body: json({ id, publish: true }) });

export const runCopilot = (code: string, teacherKey: string, body: { assignmentId: string; page: string }, onEvent: (event: StreamEvent) => void) =>
  stream(`/api/classes/${encodeURIComponent(code)}/copilot`, { method: "POST", teacherKey, body: json(body) }, onEvent);

const seatQuery = (s: { code: string; studentId: string; assignmentId: string }) =>
  `code=${encodeURIComponent(s.code)}&studentId=${encodeURIComponent(s.studentId)}&assignmentId=${encodeURIComponent(s.assignmentId)}`;

export const getMyWork = (seat: { code: string; studentId: string; assignmentId: string }) =>
  request<{ work: WorkRecord | null; strokes: Stroke[] }>(`/api/work?${seatQuery(seat)}`, { cache: "no-store" });

export const saveMyWork = (seat: { code: string; studentId: string; assignmentId: string }, strokes: Stroke[], handIn = false) =>
  request<{ work: WorkRecord }>("/api/work", { method: "PUT", body: json({ ...seat, strokes, handIn }) });

export const getLearnerWork = (code: string, teacherKey: string, assignmentId: string, studentId: string) =>
  request<{ work: WorkRecord | null; strokes: Stroke[] }>(
    `/api/classes/${encodeURIComponent(code)}/work?assignmentId=${encodeURIComponent(assignmentId)}&studentId=${encodeURIComponent(studentId)}`,
    { teacherKey, cache: "no-store" },
  );

export const sendFeedback = (code: string, teacherKey: string, body: { assignmentId: string; studentId: string; feedback: string }) =>
  request<{ work: WorkRecord }>(`/api/classes/${encodeURIComponent(code)}/work`, { method: "PATCH", teacherKey, body: json(body) });
