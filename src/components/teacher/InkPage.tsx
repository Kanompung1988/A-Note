"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Box, Stroke } from "@/lib/ink/geometry";
import { roughRing } from "@/lib/ink/marks";
import { drawStroke, fitCanvas } from "@/lib/ink/render";
import type { Sheet } from "@/lib/sheets";

export type PageMark = { box: Box; kind: "ask" | "slip" | "right" };

/** A learner's page as they left it: the sheet, their ink, and where they asked or slipped. Read-only. */
export function InkPage({ sheet, strokes, marks = [] }: { sheet: Sheet; strokes: Stroke[]; marks?: PageMark[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const height = Math.round((sheet.height * width) / sheet.width);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => el.clientWidth && setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width) return;
    const ctx = fitCanvas(canvas, width, height, sheet.width);
    for (const stroke of strokes) drawStroke(ctx, stroke);
  }, [strokes, width, height, sheet.width]);

  const pen = sheet.width * 0.004;
  return (
    <div ref={wrapRef} className="w-full">
      {width > 0 && (
        <div className="relative bg-white shadow-sm ring-1 ring-slate-200" style={{ width, height }}>
          <Image src={sheet.src} alt={sheet.title} width={width} height={height} unoptimized className="absolute inset-0 h-full w-full" />
          <canvas ref={canvasRef} className="absolute inset-0" />
          <svg className="pointer-events-none absolute inset-0" width={width} height={height} viewBox={`0 0 ${sheet.width} ${sheet.height}`} aria-hidden>
            {marks.map((m, i) =>
              m.kind === "ask" ? (
                <rect key={i} x={m.box.x - 6} y={m.box.y - 6} width={m.box.w + 12} height={m.box.h + 12} rx={14} fill="#f97316" fillOpacity={0.12} stroke="#f97316" strokeWidth={pen * 0.6} />
              ) : (
                <path key={i} d={roughRing(m.box, i + 3, sheet.width * 0.01)} fill="none" stroke={m.kind === "slip" ? "#dc2626" : "#16a34a"} strokeWidth={pen} strokeLinecap="round" />
              ),
            )}
          </svg>
        </div>
      )}
    </div>
  );
}
