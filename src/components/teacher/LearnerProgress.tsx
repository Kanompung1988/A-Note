"use client";

import { useState } from "react";
import { removeStudent, type Dashboard } from "@/lib/class/api";
import { skillRows, worksheetRows } from "@/lib/class/progress";
import { timeAgo } from "@/lib/time";
import { Modal } from "./Modal";

type Props = {
  code: string;
  teacherKey: string;
  data: Dashboard;
  studentId: string | null;
  now: number;
  onClose: () => void;
  /** open this learner's page on one worksheet */
  onViewPage: (assignmentId: string, studentId: string) => void;
  onRemoved: (studentId: string) => void;
};

const STATUS_STYLE = {
  "Handed in": "text-emerald-700",
  "In progress": "text-slate-600",
  "Not started": "text-slate-400",
};

/** One learner across every worksheet: what they handed in, and the skills to practise next. */
export function LearnerProgress({ code, teacherKey, data, studentId, now, onClose, onViewPage, onRemoved }: Props) {
  const student = data.students.find((s) => s.id === studentId) ?? null;
  const [removing, setRemoving] = useState(false);
  const rows = student ? worksheetRows(data, student) : [];
  const skills = student ? skillRows(data, student) : [];
  const toPractise = skills.filter((s) => s.slips > 0 || s.asked > s.solvedAfterHints).slice(0, 3);

  async function remove() {
    if (!student || !window.confirm(`Remove ${student.name} and their work from the class? They can join again, starting fresh.`)) return;
    setRemoving(true);
    try {
      await removeStudent(code, teacherKey, student.id);
      onRemoved(student.id);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Modal open={Boolean(student)} onClose={onClose} wide>
      {student && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-slate-900">{student.name}</h2>
              <p className="text-sm text-slate-500">
                Joined {timeAgo(student.joinedAt, now)} · last active {timeAgo(student.lastSeenAt, now)}
              </p>
            </div>
            <button type="button" onClick={remove} disabled={removing} className="rounded-xl px-3 py-2 text-sm font-medium text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-50">
              {removing ? "Removing…" : "Remove from class"}
            </button>
          </div>

          <section className="rounded-2xl bg-orange-50 p-4 ring-1 ring-orange-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">To practise next</p>
            {toPractise.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">Nothing stands out yet: no slips, and every question asked was solved.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {toPractise.map((s) => (
                  <li key={s.skill} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                    <span className="font-semibold text-slate-900">{s.skill}</span>
                    <span className="text-slate-600">
                      {s.slips > 0 && `${s.slips} ${s.slips === 1 ? "slip" : "slips"} in checked work`}
                      {s.slips > 0 && s.asked > 0 && " · "}
                      {s.asked > 0 && `asked ${s.asked}, solved ${s.solvedAfterHints} after hints`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Worksheets</p>
            <table className="mt-2 w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-2 font-medium">Worksheet</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Asked</th>
                  <th className="py-2 text-right font-medium">Solved</th>
                  <th className="hidden py-2 text-right font-medium sm:table-cell">Checked</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.assignment.id} className="border-t border-slate-100">
                    <td className="py-2.5 pr-2 font-medium text-slate-800">
                      {r.assignment.sheet.title}
                      {r.assignment.studentIds && <span className="ml-2 text-xs font-normal text-orange-600">made for them</span>}
                    </td>
                    <td className={`py-2.5 ${STATUS_STYLE[r.status]}`}>{r.status}</td>
                    <td className="py-2.5 text-right tabular-nums">{r.asked}</td>
                    <td className="py-2.5 text-right tabular-nums">{r.solved}</td>
                    <td className="hidden py-2.5 text-right tabular-nums sm:table-cell">
                      {r.checksRight > 0 && <span className="text-emerald-600">✓{r.checksRight}</span>} {r.slips > 0 && <span className="text-rose-600">✗{r.slips}</span>}
                    </td>
                    <td className="py-2.5 text-right">
                      <button type="button" onClick={() => onViewPage(r.assignment.id, student.id)} className="rounded-lg px-2 py-1 text-xs font-semibold ring-1 ring-slate-200 hover:bg-slate-50">
                        Page
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {skills.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">All skills met</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {skills.map((s) => {
                  const shaky = s.slips > 0 || s.asked > s.solvedAfterHints;
                  return (
                    <span key={s.skill} className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${shaky ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"}`}>
                      {s.skill}
                    </span>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
