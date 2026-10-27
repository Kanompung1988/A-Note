"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { formatCode } from "@/lib/class/identity";
import { Modal } from "./Modal";

/** Big enough to put on the classroom projector. */
export function JoinCodeModal({ open, code, className, onClose }: { open: boolean; code: string; className: string; onClose: () => void }) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return (
    <Modal open={open} onClose={onClose} wide>
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}>
          <Image src="/brand/mascot.webp" alt="" width={220} height={157} className="h-[157px] w-[220px]" />
        </motion.div>
        <p className="text-lg text-slate-500">Join {className} at</p>
        <p className="text-2xl font-semibold text-slate-800">{origin.replace(/^https?:\/\//, "")}/join</p>
        <p className="font-mono text-7xl font-bold tracking-[0.15em] text-orange-500 sm:text-8xl">{formatCode(code)}</p>
        <button type="button" onClick={onClose} className="mt-4 rounded-xl px-4 py-2 text-slate-500 hover:bg-slate-100">
          Close
        </button>
      </div>
    </Modal>
  );
}
