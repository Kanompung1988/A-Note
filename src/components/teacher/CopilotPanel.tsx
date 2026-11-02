"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import type { Assignment, CopilotRun, RunStep, Student } from "@/lib/store/types";

const KIND_STYLE: Record<RunStep["kind"], { dot: string; label: string }> = {
  think: { dot: "bg-sky-400", label: "Thinking" },
  tool: { dot: "bg-orange-500", label: "Action" },
  check: { dot: "bg-violet-500", label: "Verified" },
  done: { dot: "bg-emerald-500", label: "Done" },
  error: { dot: "bg-rose-500", label: "Problem" },
};

type Props = {
  run: CopilotRun | null;
  steps: RunStep[];
  running: boolean;
  /** practice sheets this run made, as they arrive */
  made: Assignment[];
  students: Student[];
  error: string | null;
  onRun: () => void;
  canRun: boolean;
};

/** The class co-pilot: what it did, step by step, the practice it assigned, and tomorrow's plan. */
export function CopilotPanel({ run, steps, running, made, students, error, onRun, canRun }: Props) {
  const plan = run?.plan ?? null;
  const names = new Map(students.map((s) => [s.id, s.name]));
  return (
    <div className="overflow-hidden rounded-3xl bg-slate-900 text-white shadow-lg ring-1 ring-slate-800">
      <div className="flex flex-wrap items-center gap-4 p-5">
        <motion.div animate={running ? { rotate: [0, -8, 8, 0], y: [0, -3, 0] } : {}} transition={{ repeat: running ? Infinity : 0, duration: 1 }}>
          <Image src="/brand/icon.png" alt="" width={48} height={48} className="rounded-2xl" />
        </motion.div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold">Plan tomorrow with the co-pilot</p>
          <p className="text-sm text-slate-300">
            An agent on Muse Spark reads every circle and checked answer, writes practice for each group that needs it, has Muse Wonder verify
            every answer, and assigns it only to those learners.
          </p>
        </div>
        <motion.button
          type="button"
          onClick={onRun}
          disabled={!canRun || running}
          whileTap={{ scale: 0.97 }}
          className="h-11 rounded-xl bg-orange-500 px-5 font-semibold text-white shadow-sm disabled:opacity-50"
        >
          {running ? "Working…" : run ? "Run again" : "Run the co-pilot"}
        </motion.button>
      </div>
      {error && <p className="mx-5 mb-4 rounded-xl bg-rose-500/20 p-3 text-sm text-rose-100">{error}</p>}

      {(steps.length > 0 || plan) && (
        <div className="grid gap-px bg-slate-800 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <ol className="max-h-[420px] space-y-3 overflow-y-auto bg-slate-900 p-5 lg:max-h-none">
            <AnimatePresence initial={false}>
              {steps.map((s, i) => {
                const style = KIND_STYLE[s.kind];
                const current = running && i === steps.length - 1;
                return (
                  <motion.li key={`${s.at}-${i}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex gap-3">
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${style.dot} ${current ? "animate-ping" : ""}`} />
                    <div className="min-w-0">
                      <p className={`text-[15px] leading-snug ${s.kind === "think" ? "italic text-slate-300" : "text-white"}`}>{s.title}</p>
                      {s.detail && <p className="mt-0.5 text-sm leading-snug text-slate-400">{s.detail}</p>}
                      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">{style.label}</p>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
            {running && (
              <li className="flex items-center gap-2 pl-5 text-sm text-slate-500">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:240ms]" />
              </li>
            )}
          </ol>

          <div className="space-y-4 bg-white p-5 text-slate-900">
            {made.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Practice it assigned</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {made.map((a) => (
                    <motion.div key={a.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex gap-3 rounded-2xl p-2 ring-1 ring-slate-200">
                      <Image src={a.sheet.src} alt="" width={64} height={90} unoptimized className="h-[90px] w-16 shrink-0 rounded-lg object-cover object-top ring-1 ring-slate-200" />
                      <div className="min-w-0">
                        <p className="font-semibold leading-snug">{a.sheet.title}</p>
                        <p className="mt-1 text-sm text-slate-500">For {(a.studentIds ?? []).map((id) => names.get(id) ?? "?").join(", ")}</p>
                        <p className="mt-1 text-xs font-medium text-emerald-700">
                          ✓ {a.key?.items.filter((k) => k.verified).length ?? 0}/{a.key?.items.length ?? 0} answers verified
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {plan ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <p className="text-lg font-semibold leading-snug">{plan.headline}</p>
                <PlanBlock tone="sky" label="2-minute warm-up" text={plan.warmup} />
                <PlanBlock tone="orange" label="5-minute re-teach" text={plan.reteach} />
                {plan.groups.length > 0 && (
                  <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Groups</p>
                    <ul className="mt-2 space-y-2">
                      {plan.groups.map((g) => (
                        <li key={g.name} className="text-sm">
                          <span className="font-semibold">{g.name}</span>
                          <span className="text-slate-500"> · {g.studentNames.join(", ")}</span>
                          <span className="block text-slate-700">{g.focus}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <PlanBlock tone="emerald" label="Exit ticket" text={plan.exit_ticket} />
              </motion.div>
            ) : (
              !made.length && <p className="text-sm text-slate-500">{running ? "The plan appears here when the co-pilot finishes." : "No plan from this run."}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const TONES = {
  sky: "bg-sky-50 ring-sky-100 text-sky-700",
  orange: "bg-orange-50 ring-orange-100 text-orange-700",
  emerald: "bg-emerald-50 ring-emerald-100 text-emerald-700",
};

function PlanBlock({ tone, label, text }: { tone: keyof typeof TONES; label: string; text: string }) {
  return (
    <div className={`rounded-2xl p-3 ring-1 ${TONES[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-[15px] leading-relaxed text-slate-800">{text}</p>
    </div>
  );
}
