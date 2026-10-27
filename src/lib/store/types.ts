import type { Box } from "@/lib/ink/geometry";
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

export type Assignment = {
  id: string;
  classId: string;
  sheet: Sheet;
  createdAt: string;
};

export type Student = {
  id: string;
  classId: string;
  name: string;
  joinedAt: string;
  lastSeenAt: string;
};

/** One "Ask here": where a learner circled, what the tutor saw, and how it went. */
export type AskRecord = {
  id: string;
  classId: string;
  assignmentId: string;
  studentId: string;
  loop: Box;
  region: PageRegion | null;
  circled: string | null;
  topic: string | null;
  hintsSeen: number;
  replies: number;
  solved: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PublicClass = Pick<ClassRoom, "code" | "name" | "teacherName"> & { assignments: Assignment[] };

export type Dashboard = {
  classRoom: Omit<ClassRoom, "teacherKey">;
  assignments: Assignment[];
  students: Student[];
  asks: AskRecord[];
};
