"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useState } from "react";
import { generateWorksheet, publishDraft, unassign, type StreamEvent, type WorksheetRequest } from "@/lib/class/api";
import type { Assignment } from "@/lib/store/types";

const LANGUAGES = ["English", "Thai", "Spanish", "Hindi", "Indonesian", "Vietnamese", "Portuguese", "French", "Arabic", "Chinese", "Japanese"];
const GRADES = ["Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];
const IDEAS = [
  "Two-step equations with word problems from a market",
  "Series and parallel circuits in a house",
  "Fractions of a pizza and a chocolate bar",
  "Reading: why coral reefs turn white, with cause and effect",
];

type Step = { stage: string; detail: string };

const STAGE_MODEL: Record<string, string> = {
  writing: "Muse Spark",
  drawing: "Muse Image",
  verifying: "Muse Wonder",
  repairing: "Muse Spark",
  layout: "A-Note",
};

type Props = {
  code: string;
  teacherKey: string;
  onAssigned: (assignment: Assignment) => void;
};

/** "Create with A-Note": a worksheet from one line, with an answer key verified by a second model. */
export function CreateSheet({ code, teacherKey, onAssigned }: Props) {
  const [form, setForm] = useState<WorksheetRequest>({ topic: "", grade: "Grade 7", count: 5, language: "English", picture: true });
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ assignment: Assignment; verified: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  async function write() {
    if (form.topic.trim().length < 3 || busy) return;
    setBusy(true);
    setSteps([]);
    setDraft(null);
    setError(null);
    try {
      await generateWorksheet(code, teacherKey, form, (event: StreamEvent) => {
        if (event.type === "progress") setSteps((s) => [...s, { stage: String(event.stage), detail: String(event.detail) }]);
        if (event.type === "done") setDraft({ assignment: event.assignment as Assignment, verified: Number(event.verified), total: Number(event.total) });
        if (event.type === "error") setError("A-Note couldn't write that one. Try again or change the topic.");
      });
    } catch (e) {
      setError(e instanceof Error && e.message === "rate_limited" ? "One moment, then try again." : "A-Note couldn't write that one. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function assign() {
    if (!draft) return;
    setPublishing(true);
    try {
      onAssigned(await publishDraft(code, teacherKey, draft.assignment.id));
    } catch {
      setError("Couldn't assign it. Try again.");
    } finally {
      setPublishing(false);
    }
  }

  async function discard() {
    if (!draft) return;
    await unassign(code, teacherKey, draft.assignment.id).catch(() => undefined);
    setDraft(null);
    setSteps([]);
  }

  if (draft) {
    const { assignment, verified, total } = draft;
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="max-h-[60dvh] overflow-y-auto rounded-2xl bg-slate-100 p-2 ring-1 ring-slate-200">
          <Image src={assignment.sheet.src} alt={assignment.sheet.title} width={assignment.sheet.width} height={assignment.sheet.height} unoptimized className="h-auto w-full rounded-xl bg-white" />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <p className="text-lg font-semibold text-slate-900">{assignment.sheet.title}</p>
            <p className={`mt-1 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ring-1 ${verified === total ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}>
              ✓ {verified}/{total} answers confirmed by an independent Muse Wonder solve
            </p>
          </div>
          <div className="rounded-2xl ring-1 ring-slate-200">
            <p className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Answer key · only you and the tutor see this</p>
            <ol className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
              {assignment.key?.items.map((item) => (
                <li key={item.n} className="flex gap-3 px-4 py-2.5 text-sm">
                  <span className="font-semibold text-slate-400">{item.n}.</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-slate-900">{item.answer}</span>
                    <span className="block truncate text-slate-500">{item.skill}</span>
                  </span>
                  <span className={item.verified ? "text-emerald-600" : "text-amber-600"} title={item.verified ? "Verified" : "Not verified"}>
                    {item.verified ? "✓" : "?"}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-auto flex gap-2">
            <button type="button" onClick={assign} disabled={publishing} className="h-11 flex-1 rounded-xl bg-orange-500 font-semibold text-white disabled:opacity-50">
              {publishing ? "Assigning…" : "Assign to class"}
            </button>
            <button type="button" onClick={discard} className="h-11 rounded-xl border border-slate-300 px-4 font-semibold text-slate-700 hover:bg-slate-50">
              Discard
            </button>
          </div>
          {error && <p className="text-sm text-rose-700">{error}</p>}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void write();
        }}
      >
        <label className="block">
          <span className="text-sm font-medium text-slate-700">What should it practise?</span>
          <textarea
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
            rows={3}
            maxLength={300}
            placeholder="e.g. two-step equations with word problems from a market"
            className="mt-1 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-[15px] outline-none focus:border-orange-400"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {IDEAS.map((idea) => (
            <button key={idea} type="button" onClick={() => setForm({ ...form, topic: idea })} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 hover:bg-orange-50 hover:text-orange-700">
              {idea}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Grade">
            <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-2 py-2 text-sm">
              {GRADES.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </Field>
          <Field label="Questions">
            <select value={form.count} onChange={(e) => setForm({ ...form, count: Number(e.target.value) })} className="w-full rounded-xl border border-slate-300 bg-white px-2 py-2 text-sm">
              {[3, 4, 5, 6, 8].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Language">
            <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-2 py-2 text-sm">
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-3 rounded-xl bg-violet-50 px-3 py-2.5 text-sm text-violet-900 ring-1 ring-violet-100">
          <input type="checkbox" checked={form.picture} onChange={(e) => setForm({ ...form, picture: e.target.checked })} className="h-4 w-4 accent-violet-600" />
          Add a picture drawn by Muse Image
        </label>
        <button type="submit" disabled={busy || form.topic.trim().length < 3} className="h-11 w-full rounded-xl bg-orange-500 font-semibold text-white shadow-sm disabled:opacity-50">
          {busy ? "Writing…" : "Write it"}
        </button>
        {error && <p className="text-sm text-rose-700">{error}</p>}
      </form>

      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">How A-Note writes it</p>
        {steps.length === 0 ? (
          <ol className="mt-3 space-y-2 text-sm text-slate-600">
            <li>1. Muse Spark writes the questions and a private answer key.</li>
            <li>2. Muse Image draws a scene for the top of the page.</li>
            <li>3. Muse Wonder solves every question on its own. Answers that don&apos;t match get rewritten or dropped.</li>
            <li>4. You review it, then assign. Learners never see the key.</li>
          </ol>
        ) : (
          <ol className="mt-3 space-y-2">
            <AnimatePresence initial={false}>
              {steps.map((step, i) => {
                const current = busy && i === steps.length - 1;
                return (
                  <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-3 text-sm">
                    <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white ${current ? "animate-pulse bg-orange-400" : "bg-emerald-500"}`}>
                      {current ? "…" : "✓"}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium text-slate-800">{step.detail}</span>
                      <span className="text-xs text-slate-500">{STAGE_MODEL[step.stage] ?? "A-Note"}</span>
                    </span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ol>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
