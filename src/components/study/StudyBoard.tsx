"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { captureRegion, type Capture } from "@/lib/ink/capture";
import type { Box, Stroke } from "@/lib/ink/geometry";
import { SAMPLE_SHEETS, sheetFromFile, type Sheet } from "@/lib/sheets";
import { AskPanel } from "./AskPanel";

// The worksheet reads saved ink from localStorage on first render, so it only renders in the browser.
const Worksheet = dynamic(() => import("@/components/worksheet/Worksheet"), {
  ssr: false,
  loading: () => <div className="flex-1 bg-slate-100" />,
});

export default function StudyBoard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<Sheet>(SAMPLE_SHEETS[0]);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [asking, setAsking] = useState(false);

  async function handleAsk(strokes: Stroke[], loop: Box) {
    setAsking(true);
    setCapture(null);
    try {
      setCapture(await captureRegion(sheet, strokes, loop));
    } catch {
      setAsking(false);
    }
  }

  async function openFile(file: File | undefined) {
    if (!file) return;
    setSheet(await sheetFromFile(file));
    setCapture(null);
    setAsking(false);
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <Image src="/brand/icon.png" alt="" width={32} height={32} className="rounded-lg" />
          A-Note
        </Link>
        <span className="truncate text-sm text-slate-500">{sheet.title}</span>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="ml-auto shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          เปิดชีทของฉัน
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void openFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </header>
      <div className="flex min-h-0 flex-1">
        <Worksheet key={sheet.id} sheet={sheet} onAsk={handleAsk} />
        {asking && (
          <AskPanel
            capture={capture}
            onClose={() => {
              setAsking(false);
              setCapture(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
