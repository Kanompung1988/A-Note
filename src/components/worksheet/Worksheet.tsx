"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { detectLoop, hitsStroke, type Box, type InkPoint, type Stroke, type Tool } from "@/lib/ink/geometry";
import { clearCanvas, drawStroke, fitCanvas } from "@/lib/ink/render";
import { loadStrokes, newId, saveStrokes } from "@/lib/ink/storage";
import { regionTransform, type PageRegion } from "@/lib/regions";
import type { Sheet } from "@/lib/sheets";
import { Toolbar, type ToolChoice } from "./Toolbar";

const MAX_PAGE_WIDTH = 980;
const HISTORY_LIMIT = 50;
const NOTE_WIDTH = 280;

type LoopPrompt = { strokeId: string; box: Box };

/** What the tutor draws on the page: SAM's mask of the circled part and a hint note beside it. */
export type BoardOverlay = {
  loop: Box;
  region: PageRegion | null;
  note: { label: string; text: string; tone: "thinking" | "hint" | "done" } | null;
};

type Props = {
  sheet: Sheet;
  overlay?: BoardOverlay | null;
  /** called when the learner taps "Ask here" on a loop; gets the strokes with that loop marked as asked */
  onAsk: (strokes: Stroke[], loop: Box) => void;
};

/** A worksheet you can write on. Pen and mouse draw, fingers scroll, and a loop offers to ask. */
export default function Worksheet({ sheet, overlay, onAsk }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef<Stroke | null>(null);
  const pointerRef = useRef<number | null>(null);
  const frameRef = useRef(0);
  const erasedRef = useRef(false);

  const [strokes, setStrokes] = useState<Stroke[]>(() => (sheet.local ? [] : loadStrokes(sheet.id)));
  const [history, setHistory] = useState<Stroke[][]>([]);
  const [choice, setChoice] = useState<ToolChoice>({ tool: "pen", color: "#1e293b" });
  const [width, setWidth] = useState(0);
  const [prompt, setPrompt] = useState<LoopPrompt | null>(null);

  const scale = width / sheet.width;
  const height = Math.round(sheet.height * scale);
  // the page (and its canvases) mounts only once the available width is known
  const mounted = width > 0;

  // Fit the page to the available width.
  useEffect(() => {
    const el = scrollRef.current!;
    const observer = new ResizeObserver(() => setWidth(Math.min(el.clientWidth - 32, MAX_PAGE_WIDTH)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Committed ink.
  useEffect(() => {
    if (!width) return;
    const ctx = fitCanvas(baseRef.current!, width, height, sheet.width);
    for (const stroke of strokes) drawStroke(ctx, stroke);
  }, [strokes, width, height, sheet.width]);

  useEffect(() => {
    if (width) fitCanvas(liveRef.current!, width, height, sheet.width);
  }, [width, height, sheet.width]);

  useEffect(() => {
    if (!sheet.local) saveStrokes(sheet.id, strokes);
  }, [sheet.id, sheet.local, strokes]);

  // Apple Pencil arrives as touches too. Stop those from scrolling or selecting, but leave fingers alone.
  useEffect(() => {
    const canvas = liveRef.current;
    if (!canvas) return;
    const stopStylus = (e: TouchEvent) => {
      for (const touch of Array.from(e.changedTouches)) {
        if ((touch as Touch & { touchType?: string }).touchType === "stylus") {
          e.preventDefault();
          return;
        }
      }
    };
    canvas.addEventListener("touchstart", stopStylus, { passive: false });
    canvas.addEventListener("touchmove", stopStylus, { passive: false });
    return () => {
      canvas.removeEventListener("touchstart", stopStylus);
      canvas.removeEventListener("touchmove", stopStylus);
    };
  }, [mounted]);

  function commit(next: Stroke[]) {
    setHistory((h) => [...h.slice(-HISTORY_LIMIT + 1), strokes]);
    setStrokes(next);
  }

  function toPage(e: PointerEvent): InkPoint {
    const rect = liveRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * sheet.width) / rect.width,
      y: ((e.clientY - rect.top) * sheet.height) / rect.height,
      p: e.pointerType === "pen" ? e.pressure || 0.5 : 0.5,
    };
  }

  function drawLive() {
    frameRef.current = 0;
    const ctx = liveRef.current!.getContext("2d")!;
    clearCanvas(ctx);
    if (activeRef.current) drawStroke(ctx, activeRef.current, false);
  }

  function eraseAt(point: InkPoint, current: Stroke[]): Stroke[] {
    const radius = sheet.width * 0.012;
    return current.filter((s) => !hitsStroke(s, point.x, point.y, radius));
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "touch" || pointerRef.current !== null) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerRef.current = e.pointerId;
    setPrompt(null);
    const point = toPage(e.nativeEvent);

    if (choice.tool === "eraser") {
      erasedRef.current = false;
      const next = eraseAt(point, strokes);
      if (next.length !== strokes.length) {
        erasedRef.current = true;
        commit(next);
      }
      return;
    }
    const tool: Tool = choice.tool;
    activeRef.current = {
      id: newId(),
      tool,
      color: choice.color,
      size: tool === "highlighter" ? sheet.width * 0.022 : sheet.width * 0.0032,
      pressure: e.pointerType === "pen",
      points: [point],
    };
    frameRef.current ||= requestAnimationFrame(drawLive);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== pointerRef.current) return;
    const coalesced = e.nativeEvent.getCoalescedEvents?.() ?? [];
    const events = coalesced.length ? coalesced : [e.nativeEvent];
    if (choice.tool === "eraser") {
      let next = strokes;
      for (const ev of events) next = eraseAt(toPage(ev), next);
      if (next.length !== strokes.length) {
        // one undo step per eraser gesture
        if (erasedRef.current) setStrokes(next);
        else {
          erasedRef.current = true;
          commit(next);
        }
      }
      return;
    }
    const active = activeRef.current;
    if (!active) return;
    for (const ev of events) active.points.push(toPage(ev));
    frameRef.current ||= requestAnimationFrame(drawLive);
  }

  function onPointerUp(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== pointerRef.current) return;
    pointerRef.current = null;
    const active = activeRef.current;
    activeRef.current = null;
    clearCanvas(liveRef.current!.getContext("2d")!);
    if (!active) return;
    commit([...strokes, active]);
    if (active.tool === "pen") {
      const box = detectLoop(active.points, sheet.width);
      if (box) setPrompt({ strokeId: active.id, box });
    }
  }

  function onPointerCancel(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== pointerRef.current) return;
    pointerRef.current = null;
    activeRef.current = null;
    clearCanvas(liveRef.current!.getContext("2d")!);
  }

  function undo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory(history.slice(0, -1));
    setStrokes(previous);
    setPrompt(null);
  }

  function clearPage() {
    if (!strokes.length || !window.confirm("Clear everything you wrote on this page?")) return;
    commit([]);
    setPrompt(null);
  }

  function ask(target: LoopPrompt) {
    const next = strokes.map((s) => (s.id === target.strokeId ? { ...s, asked: true } : s));
    setStrokes(next);
    setPrompt(null);
    onAsk(next, target.box);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar
        choice={choice}
        onChoose={setChoice}
        canUndo={history.length > 0}
        onUndo={undo}
        canClear={strokes.length > 0}
        onClear={clearPage}
      />
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-slate-100 py-4">
        {mounted && (
          <div className="relative mx-auto shadow-md" style={{ width, height }}>
            <Image
              src={sheet.src}
              alt={sheet.title}
              width={width}
              height={height}
              unoptimized
              draggable={false}
              className="pointer-events-none absolute inset-0 select-none bg-white"
            />
            {overlay?.region && <RegionHighlight region={overlay.region} sheet={sheet} width={width} height={height} />}
            <canvas ref={baseRef} className="pointer-events-none absolute inset-0" />
            <canvas
              ref={liveRef}
              className="absolute inset-0 select-none"
              style={{ touchAction: "pan-x pan-y", WebkitTouchCallout: "none", cursor: choice.tool === "eraser" ? "cell" : "crosshair" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
            />
            <AnimatePresence>
              {overlay?.note && <BoardNote key="note" overlay={overlay} note={overlay.note} scale={scale} pageWidth={width} />}
            </AnimatePresence>
            <AnimatePresence>
              {prompt && (
                <AskChip
                  key={prompt.strokeId}
                  left={Math.min((prompt.box.x + prompt.box.w) * scale, width - 150)}
                  top={Math.max(prompt.box.y * scale - 52, 4)}
                  onAsk={() => ask(prompt)}
                  onDismiss={() => setPrompt(null)}
                />
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function RegionHighlight({ region, sheet, width, height }: { region: PageRegion; sheet: Sheet; width: number; height: number }) {
  return (
    <svg className="pointer-events-none absolute inset-0" width={width} height={height} viewBox={`0 0 ${sheet.width} ${sheet.height}`} aria-hidden>
      <motion.path
        d={region.path}
        transform={regionTransform(region)}
        fill="#fb923c"
        initial={{ fillOpacity: 0 }}
        animate={{ fillOpacity: [0, 0.45, 0.28] }}
        transition={{ duration: 0.9, times: [0, 0.4, 1], ease: "easeOut" }}
      />
    </svg>
  );
}

const NOTE_TONES = {
  thinking: "bg-white ring-sky-200",
  hint: "bg-amber-50 ring-amber-300",
  done: "bg-emerald-50 ring-emerald-300",
};

function BoardNote({ overlay, note, scale, pageWidth }: { overlay: BoardOverlay; note: NonNullable<BoardOverlay["note"]>; scale: number; pageWidth: number }) {
  const anchor = overlay.region?.box ?? overlay.loop;
  const right = (anchor.x + anchor.w) * scale + 16;
  const fitsRight = right + NOTE_WIDTH <= pageWidth - 8;
  const left = fitsRight ? right : Math.max(8, Math.min(anchor.x * scale, pageWidth - NOTE_WIDTH - 8));
  const top = fitsRight ? Math.max(8, anchor.y * scale - 8) : (anchor.y + anchor.h) * scale + 12;
  return (
    <motion.div
      role="status"
      layout
      initial={{ opacity: 0, scale: 0.85, x: -12 }}
      animate={{ opacity: 1, scale: 1, x: 0, left, top }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={`pointer-events-none absolute z-10 flex origin-top-left gap-2 rounded-2xl p-3 shadow-lg ring-1 transition-colors duration-500 ${NOTE_TONES[note.tone]}`}
      style={{ width: NOTE_WIDTH }}
    >
      <motion.div
        animate={note.tone === "thinking" ? { y: [0, -4, 0], rotate: [0, -6, 0] } : note.tone === "done" ? { rotate: [0, -12, 12, 0], scale: [1, 1.15, 1] } : { y: 0 }}
        transition={note.tone === "thinking" ? { repeat: Infinity, duration: 1.2 } : { duration: 0.6 }}
        className="shrink-0"
      >
        <Image src="/brand/icon.png" alt="" width={36} height={36} className="h-9 w-9 rounded-xl" />
      </motion.div>
      <div className="min-w-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={note.label + note.text}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{note.label}</p>
            <p className="text-[15px] leading-snug text-slate-800">{note.text}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function AskChip({ left, top, onAsk, onDismiss }: { left: number; top: number; onAsk: () => void; onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      className="absolute z-20 flex items-center gap-1 rounded-full bg-white p-1 pr-2 shadow-lg ring-1 ring-orange-200"
      style={{ left, top }}
    >
      <motion.button
        type="button"
        onClick={onAsk}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 rounded-full bg-orange-500 py-1.5 pl-1.5 pr-4 text-sm font-semibold text-white"
      >
        <Image src="/brand/icon.png" alt="" width={28} height={28} className="rounded-full" />
        Ask here
      </motion.button>
      <button type="button" onClick={onDismiss} aria-label="Not now" className="px-1.5 text-lg leading-none text-slate-400">
        ×
      </button>
    </motion.div>
  );
}
