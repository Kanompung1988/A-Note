import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Box } from "@/lib/ink/geometry";
import type { PageRegion } from "@/lib/regions";
import type { Sheet } from "@/lib/sheets";
import { db } from "./db";
import type { Stroke } from "@/lib/ink/geometry";
import type { AskRecord, Assignment, ClassRoom, CopilotRun, Dashboard, InkRecord, PublicAssignment, PublicClass, Student, WorkRecord } from "./types";

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
  const [assignments, work] = await Promise.all([
    db().find<Assignment>("assignments", { classId: c.id }),
    studentId ? db().find<WorkRecord>("work", { classId: c.id, studentId }) : Promise.resolve([]),
  ]);
  return {
    code: c.code,
    name: c.name,
    teacherName: c.teacherName,
    assignments: assignments.filter((a) => visibleTo(a, studentId)).map((a) => toPublic(a, studentId)),
    work,
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
  await Promise.all([
    db().remove("asks", { classId, assignmentId }),
    db().remove("work", { classId, assignmentId }),
    db().remove("ink", { classId, assignmentId }),
  ]);
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
  const [assignments, students, asks, runs, work] = await Promise.all([
    db().find<Assignment>("assignments", { classId: classRoom.id }),
    db().find<Student>("students", { classId: classRoom.id }),
    db().find<AskRecord>("asks", { classId: classRoom.id }),
    db().find<CopilotRun>("runs", { classId: classRoom.id }),
    db().find<WorkRecord>("work", { classId: classRoom.id }),
  ]);
  return { classRoom: safe, assignments, students, asks, runs: runs.slice(-5), work };
}

export function saveRun(run: CopilotRun): Promise<CopilotRun> {
  return db().put("runs", run);
}

const workId = (assignmentId: string, studentId: string) => `${assignmentId}.${studentId}`;

/** Saves a learner's ink for an assignment; `handIn` marks it handed in (it stays editable). */
export async function saveWork(
  input: { code: string; studentId: string; assignmentId: string },
  strokes: Stroke[],
  handIn: boolean,
): Promise<WorkRecord | null> {
  const ctx = await learnerContext(input);
  if (!ctx) return null;
  const id = workId(ctx.assignment.id, ctx.student.id);
  const existing = await db().get<WorkRecord>("work", id);
  const at = now();
  const record: WorkRecord = {
    id,
    classId: ctx.classRoom.id,
    assignmentId: ctx.assignment.id,
    studentId: ctx.student.id,
    status: handIn || existing?.status === "handed_in" ? "handed_in" : "working",
    strokeCount: strokes.length,
    updatedAt: at,
    handedInAt: handIn ? at : (existing?.handedInAt ?? null),
    feedback: existing?.feedback ?? null,
    feedbackAt: existing?.feedbackAt ?? null,
  };
  await Promise.all([db().put<InkRecord>("ink", { id, classId: ctx.classRoom.id, assignmentId: ctx.assignment.id, studentId: ctx.student.id, strokes, updatedAt: at }), db().put("work", record)]);
  void touchStudent(ctx.student.id);
  return record;
}

/** The ink and status of one learner's work, for that learner or the teacher. */
export async function readWork(classId: string, assignmentId: string, studentId: string): Promise<{ work: WorkRecord | null; strokes: Stroke[] }> {
  const id = workId(assignmentId, studentId);
  const [work, ink] = await Promise.all([db().get<WorkRecord>("work", id), db().get<InkRecord>("ink", id)]);
  return { work: work && work.classId === classId ? work : null, strokes: ink && ink.classId === classId ? ink.strokes : [] };
}

export async function learnerWork(input: { code: string; studentId: string; assignmentId: string }) {
  const ctx = await learnerContext(input);
  return ctx ? readWork(ctx.classRoom.id, ctx.assignment.id, ctx.student.id) : null;
}

/** The teacher's note back to a learner on one assignment. */
export async function setFeedback(classId: string, assignmentId: string, studentId: string, feedback: string): Promise<WorkRecord | null> {
  const student = await db().get<Student>("students", studentId);
  const assignment = await getAssignment(classId, assignmentId);
  if (!student || student.classId !== classId || !assignment) return null;
  const id = workId(assignmentId, studentId);
  const existing = await db().get<WorkRecord>("work", id);
  const record: WorkRecord = existing ?? {
    id,
    classId,
    assignmentId,
    studentId,
    status: "working",
    strokeCount: 0,
    updatedAt: now(),
    handedInAt: null,
    feedback: null,
    feedbackAt: null,
  };
  return db().put<WorkRecord>("work", { ...record, feedback: feedback.trim() || null, feedbackAt: feedback.trim() ? now() : null });
}

export async function renameClass(classRoom: ClassRoom, input: { name: string; teacherName: string }): Promise<ClassRoom> {
  return db().put<ClassRoom>("classes", { ...classRoom, name: input.name, teacherName: input.teacherName });
}

/** Deletes a class and everything in it. Uploaded files stay in storage, unreferenced. */
export async function deleteClass(classRoom: ClassRoom): Promise<void> {
  const classId = classRoom.id;
  await Promise.all((["asks", "work", "ink", "runs", "students", "assignments"] as const).map((c) => db().remove(c, { classId })));
  await db().remove("classes", { id: classId });
}

/** Removes a learner and their asks and work from the class. Joining again starts fresh. */
export async function removeStudent(classId: string, studentId: string): Promise<boolean> {
  const student = await db().get<Student>("students", studentId);
  if (!student || student.classId !== classId) return false;
  await Promise.all([
    db().remove("asks", { classId, studentId }),
    db().remove("work", { classId, studentId }),
    db().remove("ink", { classId, studentId }),
  ]);
  await db().remove("students", { id: studentId });
  return true;
}
