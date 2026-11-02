"use client";

import { motion } from "motion/react";
import Image from "next/image";
import type { ReactNode } from "react";
import { subjectStyle, type Sheet } from "@/lib/sheets";

/** A worksheet thumbnail card. Renders as a button when `onClick` is set. */
export function SheetCard({ sheet, onClick, footer, index = 0 }: { sheet: Sheet; onClick?: () => void; footer?: ReactNode; index?: number }) {
  const body = (
    <>
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
        <Image
          src={sheet.src}
          alt=""
          width={sheet.width}
          height={sheet.height}
          unoptimized
          className="absolute inset-x-0 top-0 h-auto w-full transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/90 to-transparent" />
      </div>
      <div className="mt-3 flex items-start gap-2">
        <p className="flex-1 font-semibold leading-snug text-slate-900">{sheet.title}</p>
        {sheet.subject && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${subjectStyle(sheet.subject)}`}>{sheet.subject}</span>}
      </div>
      {footer}
    </>
  );
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, type: "spring", stiffness: 260, damping: 26 }}
      whileHover={{ y: -4 }}
      className="group rounded-3xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-lg"
    >
      {onClick ? (
        <button type="button" onClick={onClick} className="block w-full text-left">
          {body}
        </button>
      ) : (
        body
      )}
    </motion.div>
  );
}
