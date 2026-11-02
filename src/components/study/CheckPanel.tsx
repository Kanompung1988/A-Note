"use client";

import { motion } from "motion/react";
import Image from "next/image";
import type { WorkCheck } from "@/lib/ai/api";
import type { Box } from "@/lib/ink/geometry";

/** One "Check my work": the lines A-Note read and what it found. */
export type CheckSession = {
  id: string;
  status: "checking" | "done" | "error";
  /** the handwritten lines that were checked, in page space, top to bottom */
  lines: Box[];
  question: number | null;
  /** the whole block of working */
  area: Box;
  result?: WorkCheck;
  grounded?: boolean;
};

type Props = {
  check: CheckSession;
  onAskAboutSlip: () => void;
  onRetry: () => void;
  onClose: () => void;
};

const appear = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } };

export function CheckPanel({ check, onAskAboutSlip, onRetry, onClose }: Props) {
  const { result } = check;
  return (
    <motion.aside
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="fixed inset-x-0 bottom-0 z-30 flex max-h-[55dvh] flex-col rounded-t-3xl bg-white shadow-2xl md:static md:max-h-none md:w-[400px] md:rounded-none md:border-l md:border-slate-200 md:shadow-none"
    >
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <Image src="/brand/icon.png" alt="" width={32} height={32} className="rounded-lg" />
        <h2 className="font-semibold text-slate-800">Check my work</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="ml-auto rounded-lg px-2 text-2xl leading-none text-slate-400 hover:bg-slate-100">
          ×
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {check.status === "checking" && (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <span className="inline-block h-2 w-2 animate-ping rounded-full bg-sky-400" />
            Muse Spark is reading {check.lines.length} {check.lines.length === 1 ? "line" : "lines"} of your handwriting…
          </p>
        )}

        {check.status === "error" && (
          <div className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200">
            A-Note couldn&apos;t check that just now.{" "}
            <button type="button" onClick={onRetry} className="font-semibold underline">
              Try again
            </button>
          </div>
        )}

        {result && (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              {result.question && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{result.question}</span>}
              {check.grounded && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 ring-1 ring-emerald-200">Checked against the teacher&apos;s key</span>
              )}
            </div>

            <ol className="space-y-1.5">
              {result.lines.map((line, i) => {
                const slip = line.n === result.first_slip;
                const after = result.first_slip > 0 && line.n > result.first_slip;
                return (
                  <motion.li
                    key={line.n}
                    {...appear}
                    transition={{ delay: i * 0.12 }}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 font-mono text-[15px] ${slip ? "bg-rose-50 ring-1 ring-rose-200" : "bg-slate-50"}`}
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-600 font-sans text-xs font-bold text-white">{line.n}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-800">{line.read}</span>
                    <span className={`font-sans text-sm font-bold ${slip ? "text-rose-600" : after ? "text-slate-300" : "text-emerald-600"}`}>
                      {slip ? "✗" : after ? "·" : "✓"}
                    </span>
                  </motion.li>
                );
              })}
            </ol>

            {result.all_correct ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-200"
              >
                <Image src="/brand/peek.webp" alt="" width={56} height={55} className="h-[55px] w-[56px] shrink-0" />
                <p className="text-[15px] font-medium text-emerald-800">{result.praise || "Every line is right."}</p>
              </motion.div>
            ) : result.first_slip ? (
              <motion.div {...appear} className="space-y-2 rounded-2xl bg-rose-50 p-3 ring-1 ring-rose-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Line {result.first_slip}</p>
                <p className="text-[15px] leading-snug text-slate-800">{result.slip}</p>
                <p className="text-[15px] leading-snug text-slate-800">
                  <span className="font-semibold text-amber-700">Try: </span>
                  {result.hint}
                </p>
              </motion.div>
            ) : (
              <p className="rounded-2xl bg-sky-50 p-3 text-[15px] text-slate-800 ring-1 ring-sky-200">{result.hint || "So far so good. Keep going."}</p>
            )}
          </>
        )}
      </div>

      {result && (
        <div className="flex gap-2 border-t border-slate-100 p-3">
          {result.first_slip > 0 && (
            <button type="button" onClick={onAskAboutSlip} className="h-11 flex-1 rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white">
              Ask about line {result.first_slip}
            </button>
          )}
          <button type="button" onClick={onRetry} className="h-11 flex-1 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Check again
          </button>
        </div>
      )}
    </motion.aside>
  );
}
