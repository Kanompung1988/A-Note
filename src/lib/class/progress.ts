import { questionAt } from "@/lib/sheets";
import type { AskRecord, Assignment, Dashboard, Student, WorkRecord } from "@/lib/store/types";

// Pure summaries of a class's results: one learner's progress across worksheets (and the skills they
// should practise), and the whole class as CSV for a spreadsheet.

export type WorksheetRow = {
  assignment: Assignment;
  status: "Not started" | "In progress" | "Handed in";
  handedInAt: string | null;
  asked: number;
  solved: number;
  hints: number;
  checksRight: number;
  slips: number;
  feedback: string | null;
};

export type SkillRow = { skill: string; asked: number; solvedAfterHints: number; slips: number; checksRight: number };

function status(work: WorkRecord | null | undefined): WorksheetRow["status"] {
  if (work?.status === "handed_in") return "Handed in";
  return work && work.strokeCount > 0 ? "In progress" : "Not started";
}

/** The worksheets a learner has, whole-class ones and those made for them. Drafts are never theirs. */
function assignmentsOf(data: Dashboard, student: Student): Assignment[] {
  return data.assignments.filter((a) => !a.draft && (!a.studentIds || a.studentIds.includes(student.id)));
}

export function worksheetRows(data: Dashboard, student: Student): WorksheetRow[] {
  return assignmentsOf(data, student).map((assignment) => {
    const all = data.asks.filter((a) => a.studentId === student.id && a.assignmentId === assignment.id);
    const asks = all.filter((a) => a.kind !== "check");
    const checks = all.filter((a) => a.kind === "check");
    const work = data.work.find((w) => w.studentId === student.id && w.assignmentId === assignment.id);
    return {
      assignment,
      status: status(work),
      handedInAt: work?.handedInAt ?? null,
      asked: asks.length,
      solved: asks.filter((a) => a.solved).length,
      hints: asks.reduce((n, a) => n + a.hintsSeen, 0),
      checksRight: checks.filter((a) => a.solved).length,
      slips: checks.filter((a) => !a.solved).length,
      feedback: work?.feedback ?? null,
    };
  });
}

/** The skill an ask is about: the answer key's skill for the question it sits on, else the tutor's topic. */
export function skillOf(ask: AskRecord, assignment: Assignment | undefined): string | null {
  if (assignment) {
    const n = questionAt(assignment.sheet, ask.region?.box ?? ask.loop);
    const item = n ? assignment.key?.items.find((i) => i.n === n) : undefined;
    if (item?.skill) return item.skill;
  }
  return ask.topic?.replace(/^Question \d+$/, "").trim() || null;
}

/** Skills a learner met, the ones that gave them most trouble first. */
export function skillRows(data: Dashboard, student: Student): SkillRow[] {
  const bySkill = new Map<string, SkillRow>();
  for (const ask of data.asks.filter((a) => a.studentId === student.id)) {
    const skill = skillOf(
      ask,
      data.assignments.find((a) => a.id === ask.assignmentId),
    );
    if (!skill) continue;
    const key = skill.toLowerCase();
    const row = bySkill.get(key) ?? { skill, asked: 0, solvedAfterHints: 0, slips: 0, checksRight: 0 };
    if (ask.kind === "check") {
      if (ask.solved) row.checksRight++;
      else row.slips++;
    } else {
      row.asked++;
      if (ask.solved) row.solvedAfterHints++;
    }
    bySkill.set(key, row);
  }
  const trouble = (r: SkillRow) => r.slips * 2 + (r.asked - r.solvedAfterHints);
  return [...bySkill.values()].sort((a, b) => trouble(b) - trouble(a) || b.asked - a.asked);
}

const CSV_HEADER = ["Learner", "Worksheet", "Status", "Handed in at", "Questions asked", "Solved after hints", "Hints used", "Checks correct", "Slips found", "Note to learner"];

function cell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Every learner × worksheet, ready for a spreadsheet (UTF-8 with BOM so Excel reads Thai names). */
export function resultsCsv(data: Dashboard): string {
  const rows = data.students.flatMap((student) =>
    worksheetRows(data, student).map((r) => [
      student.name,
      r.assignment.sheet.title,
      r.status,
      r.handedInAt,
      r.asked,
      r.solved,
      r.hints,
      r.checksRight,
      r.slips,
      r.feedback,
    ]),
  );
  return `﻿${[CSV_HEADER, ...rows].map((r) => r.map(cell).join(",")).join("\r\n")}\r\n`;
}
