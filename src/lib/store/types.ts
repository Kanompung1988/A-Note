import type { Box, Stroke } from "@/lib/ink/geometry";
import type { PageRegion } from "@/lib/regions";
import type { Sheet } from "@/lib/sheets";

export type ClassRoom = {
  id: string;
  /** what learners type to join, e.g. "K7PQ4X" */
  code: string;
  name: string;
  teacherName: string;
  /** secret the teacher's browser keeps to open the dashboard */
  teacherKey: string;
  createdAt: string;
};

/** The teacher's answer for one question. Only the server, the tutor and the teacher ever see it. */
export type KeyItem = {
  /** the question's number on the page */
  n: number;
  prompt: string;
  answer: string;
  steps: string[];
  skill: string;
  /** true when an independent solve reached the same answer, null when not checked */
  verified: boolean | null;
};

export type AnswerKey = { items: KeyItem[] };

export type Assignment = {
  id: string;
  classId: string;
  sheet: Sheet;
  createdAt: string;
  origin?: "sample" | "upload" | "generated" | "copilot";
  /** only these learners see it; absent means the whole class */
  studentIds?: string[];
  /** shown to the learners it was made for */
  note?: string;
  key?: AnswerKey;
  /** written by A-Note and waiting for the teacher to review it; learners cannot see drafts */
  draft?: boolean;
};

/** An assignment as a learner receives it: no answer key, no list of other learners. */
export type PublicAssignment = Omit<Assignment, "key" | "studentIds" | "draft"> & { forYou: boolean };

export type Student = {
  id: string;
  classId: string;
  name: string;
  joinedAt: string;
  lastSeenAt: string;
};

/** One "Ask here" or "Check my work": where on the page, what the tutor saw, and how it went. */
export type AskRecord = {
  id: string;
  classId: string;
  assignmentId: string;
  studentId: string;
  kind?: "ask" | "check";
  loop: Box;
  region: PageRegion | null;
  circled: string | null;
  topic: string | null;
  /** the mistake the tutor found when checking work */
  slip?: string | null;
  hintsSeen: number;
  replies: number;
  solved: boolean;
  createdAt: string;
  updatedAt: string;
};

/** A learner's work on one assignment, without the ink (light enough for the live dashboard). */
export type WorkRecord = {
  /** `<assignmentId>.<studentId>` */
  id: string;
  classId: string;
  assignmentId: string;
  studentId: string;
  status: "working" | "handed_in";
  strokeCount: number;
  updatedAt: string;
  handedInAt: string | null;
  /** the teacher's note back to the learner */
  feedback: string | null;
  feedbackAt: string | null;
};

/** The learner's ink for one assignment, stored apart from its WorkRecord. */
export type InkRecord = { id: string; classId: string; assignmentId: string; strokes: Stroke[]; updatedAt: string };

export type RunStep = {
  at: string;
  kind: "think" | "tool" | "check" | "done" | "error";
  title: string;
  detail?: string;
};

export type LessonPlan = {
  headline: string;
  warmup: string;
  groups: { name: string; studentNames: string[]; focus: string; assignmentId: string | null }[];
  reteach: string;
  exit_ticket: string;
};

/** One run of the class co-pilot: its visible trace and what it made. */
export type CopilotRun = {
  id: string;
  classId: string;
  assignmentId: string;
  status: "running" | "done" | "failed";
  steps: RunStep[];
  plan: LessonPlan | null;
  createdAssignmentIds: string[];
  createdAt: string;
  finishedAt: string | null;
};

export type PublicClass = Pick<ClassRoom, "code" | "name" | "teacherName"> & { assignments: PublicAssignment[]; work?: WorkRecord[] };

export type Dashboard = {
  classRoom: Omit<ClassRoom, "teacherKey">;
  assignments: Assignment[];
  students: Student[];
  asks: AskRecord[];
  runs: CopilotRun[];
  work: WorkRecord[];
};
