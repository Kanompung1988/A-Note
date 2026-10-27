// Browser-side calls for classes, asks, uploads and voice.
import type { ClassInsight } from "@/lib/ai/insights";
import type { Box } from "@/lib/ink/geometry";
import type { PageRegion } from "@/lib/regions";
import type { Assignment, Dashboard, PublicClass, Student } from "@/lib/store/types";

export type { ClassInsight, Dashboard, PublicClass };

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

export const getClass = (code: string) => request<PublicClass>(`/api/classes/${encodeURIComponent(code)}`);

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

export const recordAsk = (body: { code: string; studentId: string; assignmentId: string; loop: Box }) =>
  request<{ id: string }>("/api/asks", { method: "POST", body: json(body) });

export type AskProgress = {
  region?: PageRegion | null;
  circled?: string;
  topic?: string;
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
