// Who this browser is in each class. Kept in localStorage: a demo has no accounts, and a teacher's
// key or a learner's id simply lives on the device that created it.

export type TeacherSeat = { code: string; name: string; teacherKey: string };
export type LearnerSeat = { code: string; className: string; studentId: string; name: string };

const TEACHER = "a-note:teacher";
const LEARNER = "a-note:learner";

function readList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, list: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // storage blocked: the seat lasts for this page only
  }
}

export const teacherSeats = () => readList<TeacherSeat>(TEACHER);
export const teacherSeat = (code: string) => teacherSeats().find((s) => s.code === code) ?? null;
export function saveTeacherSeat(seat: TeacherSeat) {
  writeList(TEACHER, [seat, ...teacherSeats().filter((s) => s.code !== seat.code)]);
}

export const learnerSeats = () => readList<LearnerSeat>(LEARNER);
export const learnerSeat = (code: string) => learnerSeats().find((s) => s.code === code) ?? null;
export function saveLearnerSeat(seat: LearnerSeat) {
  writeList(LEARNER, [seat, ...learnerSeats().filter((s) => s.code !== seat.code)]);
}

/** "K7PQ4X" → "K7P-Q4X" for reading aloud and writing on the board. */
export function formatCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}

export function removeTeacherSeat(code: string) {
  writeList(TEACHER, teacherSeats().filter((s) => s.code !== code));
}
