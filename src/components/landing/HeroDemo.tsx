"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useEffect, useState } from "react";

// A looping, scripted replay of the real flow: circle, SAM outline, hint, answer, solved.
const STEPS = ["page", "circle", "outline", "hint", "answer", "solved"] as const;
const DURATIONS = [900, 1300, 1100, 2600, 1800, 2600];

export function HeroDemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), DURATIONS[step]);
    return () => clearTimeout(timer);
  }, [step]);

  const at = (name: (typeof STEPS)[number]) => step >= STEPS.indexOf(name);

  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <motion.div
        className="absolute -left-16 -top-24 z-10 hidden lg:block"
        animate={{ y: [0, -14, 0], rotate: [-4, 2, -4] }}
        transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut" }}
      >
        <Image src="/brand/mascot.webp" alt="" width={170} height={121} preload />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 30, rotate: -2 }}
        animate={{ opacity: 1, y: 0, rotate: -1.5 }}
        transition={{ type: "spring", stiffness: 120, damping: 18, delay: 0.2 }}
        className="relative rounded-[28px] bg-white p-6 shadow-2xl shadow-sky-200/70 ring-1 ring-slate-200 sm:p-8"
      >
        <p className="text-sm font-semibold text-slate-400">Worksheet 3 · Linear Equations</p>
        <p className="mt-1 text-lg font-bold text-blue-900">Part 1 · Solve each equation.</p>
        <div className="mt-5 space-y-6 font-serif text-[26px] italic text-slate-800 sm:text-3xl">
          <div className="relative flex items-center gap-4">
            <span className="font-sans text-xl font-bold not-italic">1.</span>
            <span className="relative">
              3x + 7 = 22
              <AnimatePresence>
                {at("outline") && (
                  <motion.span
                    key="sam"
                    className="absolute -inset-x-2 -inset-y-1 -z-0 rounded-lg bg-orange-300/50"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                  />
                )}
              </AnimatePresence>
            </span>
            <svg className="pointer-events-none absolute -left-3 -top-5 h-[84px] w-[250px] overflow-visible sm:w-[270px]" viewBox="0 0 270 84" aria-hidden>
              <motion.path
                d="M235 22 C 205 2, 60 2, 22 22 C -6 38, 10 72, 70 78 C 140 86, 236 78, 252 52 C 262 34, 240 16, 205 12"
                fill="none"
                stroke="#f97316"
                strokeWidth={4}
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: at("circle") ? 1 : 0, opacity: at("circle") ? 1 : 0 }}
                transition={{ duration: at("circle") ? 1.1 : 0.3, ease: "easeInOut" }}
              />
            </svg>
          </div>
          <div className="flex items-center gap-4 text-slate-500">
            <span className="font-sans text-xl font-bold not-italic text-slate-800">2.</span>
            5(x − 2) = 3x + 4
          </div>
          <div className="h-px bg-slate-200" />
          <AnimatePresence>
            {at("answer") && (
              <motion.p
                key="ink"
                initial={{ opacity: 0, clipPath: "inset(0 100% 0 0)" }}
                animate={{ opacity: 1, clipPath: "inset(0 0% 0 0)" }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.1, ease: "easeOut" }}
                className="font-[cursive] text-2xl not-italic text-blue-700"
              >
                3x = 15 → x = 5
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* the tutor's note, pinned beside the circled problem */}
      <AnimatePresence mode="wait">
        {at("hint") && (
          <motion.div
            key={at("solved") ? "solved" : "hint"}
            initial={{ opacity: 0, scale: 0.8, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className={`relative mx-auto mt-4 flex w-full max-w-xs gap-2 rounded-2xl p-3 shadow-xl ring-1 sm:absolute sm:-right-10 sm:top-24 sm:mt-0 sm:w-60 ${
              at("solved") ? "bg-emerald-50 ring-emerald-300" : "bg-amber-50 ring-amber-300"
            }`}
          >
            <motion.div animate={at("solved") ? { rotate: [0, -14, 14, 0], scale: [1, 1.2, 1] } : {}} transition={{ duration: 0.7 }} className="shrink-0">
              <Image src="/brand/icon.png" alt="" width={36} height={36} className="rounded-xl" />
            </motion.div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{at("solved") ? "You got it" : "Hint 1 of 3"}</p>
              <p className="text-sm leading-snug text-slate-800">
                {at("solved") ? "You solved it yourself. Check: 3 × 5 + 7 = 22." : "What is getting in the way of the 3x? Undo it on both sides."}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {at("outline") && !at("solved") && (
          <motion.span
            key="badge"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute -bottom-4 left-8 hidden rounded-full sm:block bg-white px-3 py-1.5 text-xs font-semibold text-orange-700 shadow-md ring-1 ring-orange-200"
          >
            Outlined by SAM 3.1 · Hints by Muse Spark
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
