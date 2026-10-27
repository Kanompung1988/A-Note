"use client";

import { motion } from "motion/react";

// Fixed positions so the server and browser render the same bubbles.
const BUBBLES = [
  { left: "6%", size: 14, delay: 0, duration: 9 },
  { left: "14%", size: 8, delay: 3, duration: 11 },
  { left: "27%", size: 20, delay: 1.5, duration: 13 },
  { left: "41%", size: 10, delay: 5, duration: 10 },
  { left: "58%", size: 16, delay: 2, duration: 12 },
  { left: "71%", size: 9, delay: 6, duration: 9 },
  { left: "83%", size: 22, delay: 0.8, duration: 14 },
  { left: "93%", size: 12, delay: 4, duration: 11 },
];

export function Bubbles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {BUBBLES.map((b, i) => (
        <motion.span
          key={i}
          className="absolute bottom-[-40px] rounded-full border border-sky-300/60 bg-white/40"
          style={{ left: b.left, width: b.size, height: b.size }}
          animate={{ y: [0, -900], x: [0, 12, -8, 0], opacity: [0, 0.9, 0.9, 0] }}
          transition={{ repeat: Infinity, duration: b.duration, delay: b.delay, ease: "linear" }}
        />
      ))}
    </div>
  );
}
