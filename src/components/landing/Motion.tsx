"use client";

import { MotionConfig, motion } from "motion/react";
import type { ReactNode } from "react";

/** Honors the visitor's reduced-motion setting for everything inside. */
export function RespectMotion({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export function Float({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} animate={{ y: [0, -12, 0], rotate: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}>
      {children}
    </motion.div>
  );
}
