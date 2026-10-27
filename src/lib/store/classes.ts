import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Box } from "@/lib/ink/geometry";
import type { PageRegion } from "@/lib/regions";
import type { Sheet } from "@/lib/sheets";
import { read, write } from "./db";
import type { AskRecord, Assignment, ClassRoom, Dashboard, PublicClass, Student } from "./types";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function id(): string {
  return randomBytes(9).toString("base64url");
}

function now(): string {
  return new Date().toISOString();
}

export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function newCode(taken: Set<string>): string {
  for (;;) {
    const bytes = randomBytes(6);
    const code = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
    if (!taken.has(code)) return code;
  }
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function createClass(input: { name: string; teacherName: string }): Promise<ClassRoom> {
  return write((data) => {
    const classRoom: ClassRoom = {
      id: id(),
      code: newCode(new Set(data.classes.map((c) => c.code))),
      name: input.name,
      teacherName: input.teacherName,
      teacherKey: randomBytes(24).toString("base64url"),
      createdAt: now(),
    };
    data.classes.push(classRoom);
    return classRoom;
  });
}

export function publicClass(code: string): Promise<PublicClass | null> {
  const wanted = normalizeCode(code);
  return read((data) => {
    const c = data.classes.find((x) => x.code === wanted);
    if (!c) return null;
    return {
      code: c.code,
      name: c.name,
      teacherName: c.teacherName,
      assignments: data.assignments.filter((a) => a.classId === c.id),
    };
  });
}

/** The class when `teacherKey` matches it, otherwise null. */
export function teacherClass(code: string, teacherKey: string | null): Promise<ClassRoom | null> {
  const wanted = normalizeCode(code);
  return read((data) => {
    const c = data.classes.find((x) => x.code === wanted);
    return c && teacherKey && sameSecret(c.teacherKey, teacherKey) ? c : null;
  });
}

export function addAssignment(classId: string, sheet: Sheet): Promise<Assignment> {
  return write((data) => {
    const assignment: Assignment = { id: id(), classId, sheet: { ...sheet, id: `assignment-${id()}`, local: false }, createdAt: now() };
    data.assignments.push(assignment);
    return assignment;
  });
}

export function removeAssignment(classId: string, assignmentId: string): Promise<boolean> {
  return write((data) => {
    const before = data.assignments.length;
    data.assignments = data.assignments.filter((a) => !(a.classId === classId && a.id === assignmentId));
    data.asks = data.asks.filter((a) => a.assignmentId !== assignmentId);
    return data.assignments.length < before;
  });
}

/** Joins a class by name. Joining again with the same name returns the same learner. */
export function joinClass(code: string, name: string): Promise<{ student: Student; classRoom: PublicClass } | null> {
  const wanted = normalizeCode(code);
  return write((data) => {
    const c = data.classes.find((x) => x.code === wanted);
    if (!c) return null;
    const key = name.trim().toLowerCase();
    let student = data.students.find((s) => s.classId === c.id && s.name.toLowerCase() === key);
    if (!student) {
      student = { id: id(), classId: c.id, name: name.trim(), joinedAt: now(), lastSeenAt: now() };
      data.students.push(student);
    } else {
      student.lastSeenAt = now();
    }
    return {
      student,
      classRoom: { code: c.code, name: c.name, teacherName: c.teacherName, assignments: data.assignments.filter((a) => a.classId === c.id) },
    };
  });
}

export function createAsk(input: { code: string; studentId: string; assignmentId: string; loop: Box }): Promise<AskRecord | null> {
  const wanted = normalizeCode(input.code);
  return write((data) => {
    const c = data.classes.find((x) => x.code === wanted);
    const student = c && data.students.find((s) => s.id === input.studentId && s.classId === c.id);
    const assignment = c && data.assignments.find((a) => a.id === input.assignmentId && a.classId === c.id);
    if (!c || !student || !assignment) return null;
    student.lastSeenAt = now();
    const ask: AskRecord = {
      id: id(),
      classId: c.id,
      assignmentId: assignment.id,
      studentId: student.id,
      loop: input.loop,
      region: null,
      circled: null,
      topic: null,
      hintsSeen: 0,
      replies: 0,
      solved: false,
      createdAt: now(),
      updatedAt: now(),
    };
    data.asks.push(ask);
    return ask;
  });
}

export type AskPatch = Partial<Pick<AskRecord, "circled" | "topic" | "hintsSeen" | "replies" | "solved">> & { region?: PageRegion | null };

/** Updates an ask that belongs to `studentId`. `solved` only ever turns on. */
export function updateAsk(askId: string, studentId: string, patch: AskPatch): Promise<AskRecord | null> {
  return write((data) => {
    const ask = data.asks.find((a) => a.id === askId && a.studentId === studentId);
    if (!ask) return null;
    if (patch.region !== undefined) ask.region = patch.region;
    if (patch.circled !== undefined) ask.circled = patch.circled;
    if (patch.topic !== undefined) ask.topic = patch.topic;
    if (patch.hintsSeen !== undefined) ask.hintsSeen = Math.max(ask.hintsSeen, patch.hintsSeen);
    if (patch.replies !== undefined) ask.replies = Math.max(ask.replies, patch.replies);
    if (patch.solved) ask.solved = true;
    ask.updatedAt = now();
    const student = data.students.find((s) => s.id === studentId);
    if (student) student.lastSeenAt = now();
    return ask;
  });
}

export function dashboard(classRoom: ClassRoom): Promise<Dashboard> {
  return read((data) => {
    const { teacherKey: _secret, ...safe } = classRoom;
    void _secret;
    return {
      classRoom: safe,
      assignments: data.assignments.filter((a) => a.classId === classRoom.id),
      students: data.students.filter((s) => s.classId === classRoom.id),
      asks: data.asks.filter((a) => a.classId === classRoom.id),
    };
  });
}
