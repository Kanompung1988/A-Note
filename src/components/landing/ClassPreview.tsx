"use client";

import { motion } from "motion/react";

// An illustration of the teacher dashboard: spots glow as learners circle them.
const SPOTS = [
  { top: "22%", left: "8%", width: "52%", count: 2, delay: 0.2 },
  { top: "40%", left: "8%", width: "64%", count: 9, delay: 0.5 },
  { top: "70%", left: "8%", width: "78%", count: 4, delay: 0.8 },
];

export function ClassPreview() {
  return (
    <div className="relative grid gap-4 sm:grid-cols-[1.2fr_1fr]">
      <div className="relative aspect-[4/5] rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="mb-[7%] h-3 rounded-full bg-slate-100" style={{ width: `${55 + ((i * 17) % 40)}%` }} />
        ))}
        {SPOTS.map((s) => (
          <motion.div
            key={s.top}
            className="absolute h-[9%] rounded-2xl bg-orange-400"
            style={{ top: s.top, left: s.left, width: s.width }}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: [0, 0.3 + s.count * 0.05, 0.22 + s.count * 0.05] }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: s.delay }}
          >
            <motion.span
              className="absolute -right-3 -top-3 grid h-8 w-8 place-items-center rounded-full bg-orange-500 text-sm font-bold text-white shadow-lg ring-2 ring-white"
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 400, damping: 14, delay: s.delay + 0.4 }}
            >
              {s.count}
            </motion.span>
          </motion.div>
        ))}
      </div>
      <div className="space-y-3">
        {[
          { title: "Distributing 5(x − 2)", body: "9 learners. Most wrote 5x − 2. Re-teach: expand with an area model, then solve." },
          { title: "Word problem setup", body: "4 learners. Unsure which day is x. Re-teach: name the unknown first." },
        ].map((card, i) => (
          <motion.div
            key={card.title}
            className="rounded-3xl bg-white p-4 shadow-lg ring-1 ring-slate-200"
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 1 + i * 0.25, type: "spring", stiffness: 160, damping: 20 }}
          >
            <p className="font-semibold text-slate-900">{card.title}</p>
            <p className="mt-1 text-sm text-slate-600">{card.body}</p>
          </motion.div>
        ))}
        <motion.p
          className="px-2 text-xs text-slate-400"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 1.6 }}
        >
          Illustration. Real dashboards use your class&apos;s circles.
        </motion.p>
      </div>
    </div>
  );
}
