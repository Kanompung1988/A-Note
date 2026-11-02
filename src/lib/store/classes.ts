import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Box } from "@/lib/ink/geometry";
import type { PageRegion } from "@/lib/regions";
import type { Sheet } from "@/lib/sheets";
import { db } from "./db";
import type { AskRecord, Assignment, ClassRoom, CopilotRun, Dashboard, PublicAssignment, PublicClass, Student } from "./types";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newId(): string {
  return randomBytes(9).toString("base64url");
}

function now(): string {
  return new Date().toISOString();
}

export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function randomCode(): string {
  return Array.from(randomBytes(6), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function classByCode(code: string): Promise<ClassRoom | null> {
  const wanted = normalizeCode(code);
  if (!wanted) return null;
  return (await db().find<ClassRoom>("classes", { code: wanted }))[0] ?? null;
}

export async function createClass(input: { name: string; teacherName: string }): Promise<ClassRoom> {
  let code = randomCode();
  while (await classByCode(code)) code = randomCode();
  return db().put<ClassRoom>("classes", {
    id: newId(),
    code,
    name: input.name,
    teacherName: input.teacherName,
    teacherKey: randomBytes(24).toString("base64url"),
    createdAt: now(),
  });
}

/** Whether `studentId` should see this assignment. */
function visibleTo(assignment: Assignment, studentId: string | null): boolean {
  if (assignment.draft) return false;
  return !assignment.studentIds || (studentId !== null && assignment.studentIds.includes(studentId));
}

export function toPublic(assignment: Assignment, studentId: string | null): PublicAssignment {
  const { key: _key, studentIds, draft: _draft, ...rest } = assignment;
  void _key;
  void _draft;
  return { ...rest, forYou: Boolean(studentIds && studentId && studentIds.includes(studentId)) };
}

/** What a learner sees: whole-class worksheets, plus the ones made for them. Never answer keys. */
export async function publicClass(code: string, studentId: string | null = null): Promise<PublicClass | null> {
  const c = await classByCode(code);
  if (!c) return null;
  const assignments = await db().find<Assignment>("assignments", { classId: c.id });
  return {
    code: c.code,
    name: c.name,
    teacherName: c.teacherName,
    assignments: assignments.filter((a) => visibleTo(a, studentId)).map((a) => toPublic(a, studentId)),
  };
}

/** The class when `teacherKey` matches it, otherwise null. */
export async function teacherClass(code: string, teacherKey: string | null): Promise<ClassRoom | null> {
  const c = await classByCode(code);
  return c && teacherKey && sameSecret(c.teacherKey, teacherKey) ? c : null;
}

export async function getAssignment(classId: string, assignmentId: string): Promise<Assignment | null> {
  const a = await db().get<Assignment>("assignments", assignmentId);
  return a && a.classId === classId ? a : null;
}

export function addAssignment(
  classId: string,
  sheet: Sheet,
  extra: Pick<Assignment, "origin" | "studentIds" | "note" | "key" | "draft"> = {},
): Promise<Assignment> {
  const id = newId();
  return db().put<Assignment>("assignments", {
    id,
    classId,
    sheet: { ...sheet, id: `assignment-${id}`, local: false },
    createdAt: now(),
    ...extra,
  });
}

/** Makes a reviewed draft visible to learners. */
export async function publishAssignment(classId: string, assignmentId: string): Promise<Assignment | null> {
  const a = await getAssignment(classId, assignmentId);
  if (!a) return null;
  return db().put<Assignment>("assignments", { ...a, draft: false });
}

export async function removeAssignment(classId: string, assignmentId: string): Promise<boolean> {
  if (!(await getAssignment(classId, assignmentId))) return false;
  await db().remove("asks", { classId, assignmentId });
  await db().remove("assignments", { id: assignmentId });
  return true;
}

/** Joins a class by name. Joining again with the same name returns the same learner. */
export async function joinClass(code: string, name: string): Promise<{ student: Student; classRoom: PublicClass } | null> {
  const c = await classByCode(code);
  if (!c) return null;
  const key = name.trim().toLowerCase();
  const students = await db().find<Student>("students", { classId: c.id });
  let student = students.find((s) => s.name.toLowerCase() === key);
  if (student) student.lastSeenAt = now();
  else student = { id: newId(), classId: c.id, name: name.trim(), joinedAt: now(), lastSeenAt: now() };
  await db().put("students", student);
  const classRoom = await publicClass(c.code, student.id);
  return classRoom && { student, classRoom };
}

async function touchStudent(studentId: string) {
  const student = await db().get<Student>("students", studentId);
  if (student) await db().put("students", { ...student, lastSeenAt: now() });
}

export async function learnerContext(input: { code: string; studentId: string; assignmentId: string }) {
  const c = await classByCode(input.code);
  if (!c) return null;
  const [student, assignment] = await Promise.all([db().get<Student>("students", input.studentId), getAssignment(c.id, input.assignmentId)]);
  if (!student || student.classId !== c.id || !assignment || !visibleTo(assignment, student.id)) return null;
  return { classRoom: c, student, assignment };
}

export async function createAsk(input: { code: string; studentId: string; assignmentId: string; loop: Box; kind?: AskRecord["kind"] }): Promise<AskRecord | null> {
  const ctx = await learnerContext(input);
  if (!ctx) return null;
  void touchStudent(ctx.student.id);
  return db().put<AskRecord>("asks", {
    id: newId(),
    classId: ctx.classRoom.id,
    assignmentId: ctx.assignment.id,
    studentId: ctx.student.id,
    kind: input.kind ?? "ask",
    loop: input.loop,
    region: null,
    circled: null,
    topic: null,
    slip: null,
    hintsSeen: 0,
    replies: 0,
    solved: false,
    createdAt: now(),
    updatedAt: now(),
  });
}

export type AskPatch = Partial<Pick<AskRecord, "circled" | "topic" | "slip" | "hintsSeen" | "replies" | "solved">> & { region?: PageRegion | null };

/** Updates an ask that belongs to `studentId`. `solved` only ever turns on. */
export async function updateAsk(askId: string, studentId: string, patch: AskPatch): Promise<AskRecord | null> {
  const ask = await db().get<AskRecord>("asks", askId);
  if (!ask || ask.studentId !== studentId) return null;
  if (patch.region !== undefined) ask.region = patch.region;
  if (patch.circled !== undefined) ask.circled = patch.circled;
  if (patch.topic !== undefined) ask.topic = patch.topic;
  if (patch.slip !== undefined) ask.slip = patch.slip;
  if (patch.hintsSeen !== undefined) ask.hintsSeen = Math.max(ask.hintsSeen, patch.hintsSeen);
  if (patch.replies !== undefined) ask.replies = Math.max(ask.replies, patch.replies);
  if (patch.solved) ask.solved = true;
  ask.updatedAt = now();
  void touchStudent(studentId);
  return db().put("asks", ask);
}

export async function dashboard(classRoom: ClassRoom): Promise<Dashboard> {
  const { teacherKey: _secret, ...safe } = classRoom;
  void _secret;
  const [assignments, students, asks, runs] = await Promise.all([
    db().find<Assignment>("assignments", { classId: classRoom.id }),
    db().find<Student>("students", { classId: classRoom.id }),
    db().find<AskRecord>("asks", { classId: classRoom.id }),
    db().find<CopilotRun>("runs", { classId: classRoom.id }),
  ]);
  return { classRoom: safe, assignments, students, asks, runs: runs.slice(-5) };
}

export function saveRun(run: CopilotRun): Promise<CopilotRun> {
  return db().put("runs", run);
}
