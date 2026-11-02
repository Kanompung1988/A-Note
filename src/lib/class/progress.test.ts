import { describe, expect, it } from "vitest";
import type { AskRecord, Assignment, Dashboard, Student, WorkRecord } from "@/lib/store/types";
import { resultsCsv, skillRows, worksheetRows } from "./progress";

const sheet = {
  id: "s",
  title: "Equations, part 1",
  src: "/x.svg",
  width: 1240,
  height: 1754,
  questions: [
    { n: 1, box: { x: 80, y: 400, w: 1080, h: 140 } },
    { n: 2, box: { x: 80, y: 545, w: 1080, h: 145 } },
  ],
};

const assignment: Assignment = {
  id: "a1",
  classId: "c",
  sheet,
  createdAt: "2026-11-01T00:00:00Z",
  key: {
    items: [
      { n: 1, prompt: "3x + 7 = 22", answer: "x = 5", steps: [], skill: "two-step equations", verified: true },
      { n: 2, prompt: "5(x − 2) = 3x + 4", answer: "x = 7", steps: [], skill: "brackets", verified: true },
    ],
  },
};
const practice: Assignment = { ...assignment, id: "a2", studentIds: ["other"], sheet: { ...sheet, title: "Practice" } };
const draft: Assignment = { ...assignment, id: "a3", draft: true };

const mali: Student = { id: "mali", classId: "c", name: "Mali, \"M\"", joinedAt: "", lastSeenAt: "" };

const ask = (over: Partial<AskRecord>): AskRecord => ({
  id: Math.random().toString(36),
  classId: "c",
  assignmentId: "a1",
  studentId: "mali",
  kind: "ask",
  loop: { x: 150, y: 420, w: 200, h: 50 },
  region: null,
  circled: null,
  topic: null,
  hintsSeen: 2,
  replies: 1,
  solved: false,
  createdAt: "",
  updatedAt: "",
  ...over,
});

const work: WorkRecord = {
  id: "a1.mali",
  classId: "c",
  assignmentId: "a1",
  studentId: "mali",
  status: "handed_in",
  strokeCount: 4,
  updatedAt: "2026-11-02T10:00:00Z",
  handedInAt: "2026-11-02T10:00:00Z",
  feedback: "Nice, check line 2",
  feedbackAt: null,
};

const data: Dashboard = {
  classRoom: { id: "c", code: "ABCDEF", name: "7/2", teacherName: "Kru", createdAt: "" },
  assignments: [assignment, practice, draft],
  students: [mali],
  asks: [
    ask({ solved: true }),
    ask({ loop: { x: 150, y: 560, w: 300, h: 50 } }),
    ask({ kind: "check", loop: { x: 560, y: 560, w: 300, h: 100 }, slip: "-2 not multiplied" }),
  ],
  runs: [],
  work: [work],
};

describe("worksheetRows", () => {
  it("lists only the learner's own, published worksheets with their results", () => {
    const rows = worksheetRows(data, mali);
    expect(rows.map((r) => r.assignment.id)).toEqual(["a1"]);
    expect(rows[0]).toMatchObject({ status: "Handed in", asked: 2, solved: 1, hints: 4, slips: 1, checksRight: 0 });
  });
});

describe("skillRows", () => {
  it("maps asks to the key's skills and puts the hardest first", () => {
    const skills = skillRows(data, mali);
    expect(skills.map((s) => s.skill)).toEqual(["brackets", "two-step equations"]);
    expect(skills[0]).toMatchObject({ asked: 1, slips: 1, solvedAfterHints: 0 });
  });
});

describe("resultsCsv", () => {
  it("quotes cells with commas and quotes, and starts with a BOM", () => {
    const csv = resultsCsv(data);
    expect(csv.startsWith("﻿Learner,Worksheet,Status")).toBe(true);
    expect(csv).toContain('"Mali, ""M""","Equations, part 1",Handed in');
    expect(csv.trim().split("\r\n")).toHaveLength(2);
  });
});
