"use client";

import Image from "next/image";
import type { Capture } from "@/lib/ink/capture";

type Props = {
  capture: Capture | null;
  onClose: () => void;
};

/** Side panel (bottom sheet on narrow screens) for a question about a circled region. */
export function AskPanel({ capture, onClose }: Props) {
  return (
    <aside className="fixed inset-x-0 bottom-0 z-20 flex h-[55dvh] flex-col rounded-t-2xl bg-white shadow-2xl md:static md:h-auto md:w-[380px] md:rounded-none md:border-l md:border-slate-200 md:shadow-none">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <Image src="/brand/icon.png" alt="" width={32} height={32} className="rounded-lg" />
        <h2 className="font-semibold text-slate-800">ถามจากตรงที่วง</h2>
        <button type="button" onClick={onClose} aria-label="ปิด" className="ml-auto px-2 text-2xl leading-none text-slate-400">
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {capture ? (
          <Image
            src={capture.crop}
            alt="ส่วนที่วงไว้"
            width={Math.round(capture.region.w)}
            height={Math.round(capture.region.h)}
            unoptimized
            className="h-auto w-full rounded-lg border border-slate-200"
          />
        ) : (
          <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
        )}
      </div>
    </aside>
  );
}
