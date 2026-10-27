"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import type { ClassInsight } from "@/lib/class/api";
import type { Cluster } from "@/lib/class/cluster";

type Props = {
  clusters: Cluster[];
  active: number | null;
  onSelect: (id: number | null) => void;
  insight: { insight: ClassInsight; at: string } | null;
  thinking: boolean;
  error: string | null;
  onExplain: () => void;
};

/** "Where the class is stuck": each spot, and A-Note's read on why and what to re-teach. */
export function SpotsPanel({ clusters, active, onSelect, insight, thinking, error, onExplain }: Props) {
  const spotInsight = (id: number) => insight?.insight.spots.find((s) => s.id === id);
  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-orange-50 to-amber-50 p-5 ring-1 ring-orange-100">
        <div className="flex items-center gap-3">
          <motion.div animate={thinking ? { rotate: [0, -8, 8, 0], y: [0, -3, 0] } : {}} transition={{ repeat: thinking ? Infinity : 0, duration: 1 }}>
            <Image src="/brand/icon.png" alt="" width={44} height={44} className="rounded-2xl" />
          </motion.div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900">Why are they stuck?</p>
            <p className="text-sm text-slate-600">Muse Spark reads every circled spot and suggests what to re-teach.</p>
          </div>
        </div>
        <motion.button
          type="button"
          onClick={onExplain}
          disabled={thinking || clusters.length === 0}
          whileTap={{ scale: 0.97 }}
          className="mt-4 w-full rounded-2xl bg-orange-500 py-2.5 font-semibold text-white shadow-sm disabled:opacity-50"
        >
          {thinking ? "Reading the class…" : insight ? "Ask again with the latest circles" : "Ask A-Note"}
        </motion.button>
        {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
        <AnimatePresence>
          {insight && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
              <p className="mt-4 text-[15px] leading-relaxed text-slate-800">{insight.insight.summary}</p>
              <p className="mt-3 rounded-2xl bg-white/80 p-3 text-sm text-slate-700 ring-1 ring-orange-100">
                <span className="font-semibold text-orange-700">First, </span>
                {insight.insight.next_step}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {clusters.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
          No circles yet. When learners circle something and tap “Ask here”, the spot lights up on the worksheet.
        </p>
      ) : (
        <ul className="space-y-3">
          {clusters.map((c, i) => {
            const detail = spotInsight(c.id);
            const selected = active === c.id;
            return (
              <motion.li
                key={c.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <button
                  type="button"
                  onClick={() => onSelect(selected ? null : c.id)}
                  className={`w-full rounded-3xl bg-white p-4 text-left ring-1 transition ${selected ? "shadow-md ring-orange-300" : "ring-slate-200 hover:ring-orange-200"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange-500 text-sm font-bold text-white">{c.id}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900">{detail?.concept ?? c.topics[0] ?? "Circled spot"}</p>
                      <p className="text-sm text-slate-500">
                        {c.studentIds.length} {c.studentIds.length === 1 ? "learner" : "learners"} · {c.solved}/{c.askIds.length} solved after hints
                      </p>
                    </div>
                  </div>
                  {c.circled[0] && <p className="mt-2 truncate rounded-xl bg-slate-50 px-3 py-1.5 text-sm text-slate-700">“{c.circled[0]}”</p>}
                  <AnimatePresence>
                    {detail && (selected || clusters.length <= 2) && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <p className="mt-3 text-sm text-slate-700">
                          <span className="font-semibold text-rose-600">Likely mix-up: </span>
                          {detail.misconception}
                        </p>
                        <p className="mt-2 text-sm text-slate-700">
                          <span className="font-semibold text-emerald-700">5-minute re-teach: </span>
                          {detail.reteach}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
