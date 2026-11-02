"use client";

import { useEffect, useState } from "react";
import { getLearnerWork, sendFeedback, type WorkRecord } from "@/lib/class/api";
import type { Stroke } from "@/lib/ink/geometry";
import type { AskRecord, Assignment, Student } from "@/lib/store/types";
import { timeAgo } from "@/lib/time";
import { InkPage, type PageMark } from "./InkPage";
import { Modal } from "./Modal";

type Props = {
  code: string;
  teacherKey: string;
  assignment: Assignment;
  students: Student[];
  asks: AskRecord[];
  work: WorkRecord[];
  studentId: string | null;
  now: number;
  onSelect: (studentId: string | null) => void;
  onSaved: (work: WorkRecord) => void;
};

/** One learner's page for the teacher, with what they asked, where they slipped, and a note back. */
export function WorkViewer(props: Props) {
  const { students, studentId, onSelect } = props;
  const student = students.find((s) => s.id === studentId) ?? null;
  return (
    <Modal open={Boolean(student)} onClose={() => onSelect(null)} wide>
      {student && <LearnerWork key={student.id} {...props} student={student} />}
    </Modal>
  );
}

/** Keyed by learner, so the page and the note start fresh for each one. */
function LearnerWork({ code, teacherKey, assignment, students, asks, work, now, onSelect, onSaved, student }: Props & { student: Student }) {
  const index = students.findIndex((s) => s.id === student.id);
  const record = work.find((w) => w.studentId === student.id) ?? null;
  const mine = asks.filter((a) => a.studentId === student.id);
  const [page, setPage] = useState<Stroke[] | null>(null);
  const [note, setNote] = useState(() => record?.feedback ?? "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getLearnerWork(code, teacherKey, assignment.id, student.id)
      .then((r) => !cancelled && setPage(r.strokes))
      .catch(() => !cancelled && setPage([]));
    return () => {
      cancelled = true;
    };
  }, [code, teacherKey, assignment.id, student.id]);

  const marks: PageMark[] = mine.map((a) => ({ box: a.region?.box ?? a.loop, kind: a.kind === "check" ? (a.solved ? "right" : "slip") : "ask" }));

  async function send() {
    setSending(true);
    try {
      const { work: saved } = await sendFeedback(code, teacherKey, { assignmentId: assignment.id, studentId: student.id, feedback: note });
      onSaved(saved);
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
      <div className="max-h-[78dvh] overflow-y-auto rounded-2xl bg-slate-100 p-3">
        {page ? (
          page.length || marks.length ? (
            <InkPage sheet={assignment.sheet} strokes={page} marks={marks} />
          ) : (
            <p className="p-10 text-center text-slate-500">{student.name} hasn&apos;t written on this worksheet yet.</p>
          )
        ) : (
          <div className="grid h-64 place-items-center">
            <span className="h-8 w-8 animate-spin rounded-full border-4 border-orange-100 border-t-orange-500" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous learner"
            disabled={index <= 0}
            onClick={() => onSelect(students[index - 1].id)}
            className="grid h-9 w-9 place-items-center rounded-lg ring-1 ring-slate-200 disabled:opacity-30"
          >
            ‹
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-lg font-semibold text-slate-900">{student.name}</p>
            <p className="text-xs text-slate-500">
              {index + 1} of {students.length}
            </p>
          </div>
          <button
            type="button"
            aria-label="Next learner"
            disabled={index >= students.length - 1}
            onClick={() => onSelect(students[index + 1].id)}
            className="grid h-9 w-9 place-items-center rounded-lg ring-1 ring-slate-200 disabled:opacity-30"
          >
            ›
          </button>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {record?.status === "handed_in" ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 ring-1 ring-emerald-200">
              Handed in {record.handedInAt ? timeAgo(record.handedInAt, now) : ""}
            </span>
          ) : record?.strokeCount ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">In progress · saved {timeAgo(record.updatedAt, now)}</span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-500">Not started</span>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">On this page</p>
          {mine.length === 0 && <p className="text-sm text-slate-500">No circles or checks yet.</p>}
          <ul className="max-h-56 space-y-1.5 overflow-y-auto">
            {mine.map((a) => (
              <li key={a.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                {a.kind === "check" ? (
                  <span className={a.solved ? "text-emerald-700" : "text-rose-700"}>
                    {a.solved ? "✓ Checked: all correct" : `✗ ${a.slip ?? "Slip in their working"}`}
                  </span>
                ) : (
                  <span className="text-slate-700">
                    <span className="font-medium text-orange-600">Asked</span> “{a.circled ?? "…"}” · {a.hintsSeen} hints{a.solved ? " · solved" : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="note">
            Note to {student.name}
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setSent(false);
            }}
            rows={3}
            maxLength={1000}
            placeholder="Great start on question 2. Check the sign when you expand the brackets."
            className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-400"
          />
          <button type="button" onClick={send} disabled={sending} className="h-10 w-full rounded-xl bg-slate-900 text-sm font-semibold text-white disabled:opacity-50">
            {sending ? "Sending…" : sent ? "Sent ✓" : record?.feedback ? "Update note" : "Send note"}
          </button>
          <p className="text-xs text-slate-500">They see it on the worksheet and on their class page.</p>
        </div>
      </div>
    </div>
  );
}
