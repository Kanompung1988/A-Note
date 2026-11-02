"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { bounds, detectLoop, hitsStroke, type Box, type InkPoint, type Stroke } from "@/lib/ink/geometry";
import { writingStrokes } from "@/lib/ink/lines";
import { roughRing, tick } from "@/lib/ink/marks";
import { clearCanvas, drawStroke, fitCanvas, measureText, TEXT_FONT } from "@/lib/ink/render";
import { lassoPick, shapePoints, strokesBounds, translateStrokes } from "@/lib/ink/shapes";
import { loadStrokes, newId, saveStrokes } from "@/lib/ink/storage";
import { regionTransform, type PageRegion } from "@/lib/regions";
import type { Sheet } from "@/lib/sheets";
import { DEFAULT_CHOICE, PEN_SIZES, Toolbar, ZOOMS, type ToolChoice, type ToolName } from "./Toolbar";

const MAX_PAGE_WIDTH = 980;
const HISTORY_LIMIT = 80;
const NOTE_WIDTH = 280;
/** typed text, as a share of the page width (about 32 px on an A4 sheet) */
const TEXT_SIZE = 0.026;

type LoopPrompt = { strokeId: string; box: Box };

/** What the tutor draws on the page: SAM's mask of the circled part and a hint note beside it. */
export type BoardOverlay = {
  loop: Box;
  region: PageRegion | null;
  note: { label: string; text: string; tone: "thinking" | "hint" | "slip" | "done" } | null;
};

type Note = NonNullable<BoardOverlay["note"]>;

/** What A-Note marks on the page after checking a block of working. */
export type WorkMarks = {
  id: string;
  status: "checking" | "done";
  lines: { box: Box; state: "checking" | "ok" | "slip" | "plain" }[];
  allCorrect: boolean;
  note: Note | null;
  /** where the note pins */
  anchor: Box;
};

type Props = {
  sheet: Sheet;
  overlay?: BoardOverlay | null;
  marks?: WorkMarks | null;
  /** ink to start from when this device has none saved (work saved to the class from another device) */
  initialStrokes?: Stroke[];
  /** called when the learner taps "Ask here" on a loop; gets the strokes with that loop marked as asked */
  onAsk: (strokes: Stroke[], loop: Box) => void;
  /** "Check my work": gets every stroke on the page */
  onCheck?: (strokes: Stroke[]) => void;
  /** every change to the ink, e.g. to save class work */
  onChange?: (strokes: Stroke[]) => void;
  /** extra toolbar actions, e.g. "Hand in" */
  actions?: ReactNode;
};

/** `token` names one editing session, so a blur and a click can't place the same text twice. */
type TextEdit = { token: string; id: string | null; x: number; y: number; value: string; color: string; fontSize: number };
type Drag = { start: InkPoint; before: Stroke[]; moved: boolean };

const TOOL_KEYS: Record<string, ToolName> = { p: "pen", h: "highlighter", t: "text", s: "shape", l: "lasso", e: "eraser" };

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable));
}

/** A worksheet you can write on. Pen and mouse draw, fingers scroll, and a loop offers to ask. */
export default function Worksheet({ sheet, overlay, marks, initialStrokes, onAsk, onCheck, onChange, actions }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef<Stroke | null>(null);
  const shapeStartRef = useRef<InkPoint | null>(null);
  const lassoRef = useRef<InkPoint[] | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const pointerRef = useRef<number | null>(null);
  const frameRef = useRef(0);
  const erasedRef = useRef(false);
  const placedRef = useRef(new Set<string>());

  const [strokes, setStrokes] = useState<Stroke[]>(() => {
    if (sheet.local) return [];
    const saved = loadStrokes(sheet.id);
    return saved.length ? saved : (initialStrokes ?? []);
  });
  const [past, setPast] = useState<Stroke[][]>([]);
  const [future, setFuture] = useState<Stroke[][]>([]);
  const [choice, setChoice] = useState<ToolChoice>(DEFAULT_CHOICE);
  const [fitWidth, setFitWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [prompt, setPrompt] = useState<LoopPrompt | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [textEdit, setTextEdit] = useState<TextEdit | null>(null);

  const width = Math.round(fitWidth * zoom);
  const scale = width / sheet.width;
  const height = Math.round(sheet.height * scale);
  // the page (and its canvases) mounts only once the available width is known
  const mounted = width > 0;
  const selected = strokes.filter((s) => selection.includes(s.id));
  const selectionBox = strokesBounds(selected);

  // Fit the page to the available width. A hidden page (Next keeps visited routes alive in the
  // background) measures 0 wide; keep the last size instead of unmounting the canvases.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === 0) return;
      setFitWidth(Math.max(0, Math.min(el.clientWidth - 32, MAX_PAGE_WIDTH)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Committed ink. Text being edited is drawn by its text box instead.
  useEffect(() => {
    const canvas = baseRef.current;
    if (!width || !canvas) return;
    const ctx = fitCanvas(canvas, width, height, sheet.width);
    for (const stroke of strokes) if (stroke.id !== textEdit?.id) drawStroke(ctx, stroke);
  }, [strokes, width, height, sheet.width, textEdit?.id]);

  useEffect(() => {
    const canvas = liveRef.current;
    if (width && canvas) fitCanvas(canvas, width, height, sheet.width);
  }, [width, height, sheet.width]);

  useEffect(() => {
    if (!sheet.local) saveStrokes(sheet.id, strokes);
    onChange?.(strokes);
  }, [sheet.id, sheet.local, strokes, onChange]);

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

  // Trackpad pinch (and Ctrl + wheel) zooms the page instead of the whole site.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => {
        const at = ZOOMS.indexOf(z);
        return ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, at + (e.deltaY < 0 ? 1 : -1)))];
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function commit(next: Stroke[], before: Stroke[] = strokes) {
    setPast((h) => [...h.slice(-HISTORY_LIMIT + 1), before]);
    setFuture([]);
    setStrokes(next);
  }

  function undo() {
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast(past.slice(0, -1));
    setFuture((f) => [...f, strokes]);
    setStrokes(previous);
    setPrompt(null);
    setSelection([]);
  }

  function redo() {
    const next = future[future.length - 1];
    if (!next) return;
    setFuture(future.slice(0, -1));
    setPast((h) => [...h, strokes]);
    setStrokes(next);
    setSelection([]);
  }

  function choose(next: ToolChoice) {
    if (next.tool !== "lasso") setSelection([]);
    if (textEdit) finishText();
    setChoice(next);
  }

  function deleteSelection() {
    if (!selection.length) return;
    commit(strokes.filter((s) => !selection.includes(s.id)));
    setSelection([]);
  }

  function duplicateSelection() {
    if (!selection.length) return;
    const offset = sheet.width * 0.02;
    const copies = selected.map((s) => ({ ...s, id: newId(), asked: false, points: s.points.map((p) => ({ ...p, x: p.x + offset, y: p.y + offset })) }));
    commit([...strokes, ...copies]);
    setSelection(copies.map((c) => c.id));
  }

  // Keyboard: undo/redo, tool letters, Delete for a selection, Escape to let go.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selection.length) {
        e.preventDefault();
        deleteSelection();
      } else if (e.key === "Escape") {
        setSelection([]);
        setPrompt(null);
      } else if (!mod && !e.altKey && TOOL_KEYS[e.key.toLowerCase()]) {
        choose({ ...choice, tool: TOOL_KEYS[e.key.toLowerCase()] });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
    const ctx = liveRef.current?.getContext("2d");
    if (!ctx) return;
    clearCanvas(ctx);
    if (activeRef.current) drawStroke(ctx, activeRef.current, false);
    const lasso = lassoRef.current;
    if (lasso && lasso.length > 1) {
      ctx.save();
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = sheet.width * 0.0016;
      ctx.setLineDash([sheet.width * 0.008, sheet.width * 0.006]);
      ctx.beginPath();
      ctx.moveTo(lasso[0].x, lasso[0].y);
      for (const p of lasso.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  function clearLive() {
    const ctx = liveRef.current?.getContext("2d");
    if (ctx) clearCanvas(ctx);
  }

  function eraseAt(point: InkPoint, current: Stroke[]): Stroke[] {
    const radius = sheet.width * 0.012;
    return current.filter((s) => !hitsStroke(s, point.x, point.y, radius));
  }

  function inside(box: Box | null, p: InkPoint): boolean {
    return Boolean(box && p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h);
  }

  function startText(point: InkPoint) {
    const hit = [...strokes].reverse().find((s) => s.tool === "text" && hitsStroke(s, point.x, point.y, 4));
    if (hit) {
      setTextEdit({ token: newId(), id: hit.id, x: hit.points[0].x, y: hit.points[0].y, value: hit.text ?? "", color: hit.color, fontSize: hit.fontSize ?? sheet.width * TEXT_SIZE });
      return;
    }
    const fontSize = sheet.width * TEXT_SIZE;
    setTextEdit({ token: newId(), id: null, x: point.x, y: point.y - fontSize * 0.6, value: "", color: choice.color, fontSize });
  }

  function finishText(edit: TextEdit | null = textEdit) {
    if (!edit || placedRef.current.has(edit.token)) return;
    placedRef.current.add(edit.token);
    setTextEdit(null);
    const value = edit.value.replace(/\s+$/, "");
    const others = strokes.filter((s) => s.id !== edit.id);
    if (!value.trim()) {
      if (edit.id) commit(others);
      return;
    }
    const { w, h } = measureText(value, edit.fontSize);
    const stroke: Stroke = {
      id: edit.id ?? newId(),
      tool: "text",
      color: edit.color,
      size: 0,
      pressure: false,
      text: value,
      fontSize: edit.fontSize,
      points: [
        { x: edit.x, y: edit.y, p: 0.5 },
        { x: edit.x + w, y: edit.y + h, p: 0.5 },
      ],
    };
    const original = strokes.find((s) => s.id === edit.id);
    if (original?.text === value) return;
    commit(edit.id ? strokes.map((s) => (s.id === edit.id ? stroke : s)) : [...strokes, stroke]);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "touch" || pointerRef.current !== null) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const point = toPage(e.nativeEvent);
    setPrompt(null);

    if (choice.tool === "text") {
      e.preventDefault();
      if (textEdit) finishText();
      else startText(point);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    pointerRef.current = e.pointerId;

    if (choice.tool === "eraser") {
      erasedRef.current = false;
      const next = eraseAt(point, strokes);
      if (next.length !== strokes.length) {
        erasedRef.current = true;
        commit(next);
      }
      return;
    }
    if (choice.tool === "lasso") {
      if (selection.length && inside(selectionBox, point)) {
        dragRef.current = { start: point, before: strokes, moved: false };
      } else {
        setSelection([]);
        lassoRef.current = [point];
      }
      return;
    }
    if (choice.tool === "shape") {
      shapeStartRef.current = point;
      activeRef.current = {
        id: newId(),
        tool: "pen",
        shape: choice.shape,
        color: choice.color,
        size: sheet.width * PEN_SIZES[choice.size],
        pressure: false,
        points: [point],
      };
      return;
    }
    const highlighter = choice.tool === "highlighter";
    activeRef.current = {
      id: newId(),
      tool: highlighter ? "highlighter" : "pen",
      color: highlighter ? choice.highlight : choice.color,
      size: highlighter ? sheet.width * 0.022 : sheet.width * PEN_SIZES[choice.size],
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
    const point = toPage(e.nativeEvent);
    const drag = dragRef.current;
    if (drag) {
      drag.moved = true;
      setStrokes(translateStrokes(drag.before, new Set(selection), point.x - drag.start.x, point.y - drag.start.y));
      return;
    }
    if (lassoRef.current) {
      for (const ev of events) lassoRef.current.push(toPage(ev));
      frameRef.current ||= requestAnimationFrame(drawLive);
      return;
    }
    const active = activeRef.current;
    if (!active) return;
    if (active.shape && shapeStartRef.current) active.points = shapePoints(active.shape, shapeStartRef.current, point);
    else for (const ev of events) active.points.push(toPage(ev));
    frameRef.current ||= requestAnimationFrame(drawLive);
  }

  function onPointerUp(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== pointerRef.current) return;
    pointerRef.current = null;

    const drag = dragRef.current;
    dragRef.current = null;
    if (drag) {
      // the drag already moved the ink; record it as one undo step
      if (drag.moved) {
        setPast((h) => [...h.slice(-HISTORY_LIMIT + 1), drag.before]);
        setFuture([]);
      }
      return;
    }
    const lasso = lassoRef.current;
    lassoRef.current = null;
    if (lasso) {
      clearLive();
      setSelection(lassoPick(strokes, lasso));
      return;
    }

    const active = activeRef.current;
    activeRef.current = null;
    shapeStartRef.current = null;
    clearLive();
    if (!active) return;
    if (active.shape) {
      const b = bounds(active.points);
      if (Math.hypot(b.w, b.h) < sheet.width * 0.008) return;
    }
    commit([...strokes, active]);
    if (active.tool === "pen" && !active.shape) {
      const box = detectLoop(active.points, sheet.width);
      if (box) setPrompt({ strokeId: active.id, box });
    }
  }

  function onPointerCancel(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== pointerRef.current) return;
    pointerRef.current = null;
    activeRef.current = null;
    lassoRef.current = null;
    if (dragRef.current) setStrokes(dragRef.current.before);
    dragRef.current = null;
    clearLive();
  }

  function clearPage() {
    if (!strokes.length || !window.confirm("Clear everything you wrote on this page?")) return;
    commit([]);
    setPrompt(null);
    setSelection([]);
  }

  function ask(target: LoopPrompt) {
    const next = strokes.map((s) => (s.id === target.strokeId ? { ...s, asked: true } : s));
    setStrokes(next);
    setPrompt(null);
    onAsk(next, target.box);
  }

  const cursor = { pen: "crosshair", highlighter: "crosshair", shape: "crosshair", eraser: "cell", text: "text", lasso: "default" }[choice.tool];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar
        choice={choice}
        onChoose={choose}
        canUndo={past.length > 0}
        onUndo={undo}
        canRedo={future.length > 0}
        onRedo={redo}
        canClear={strokes.length > 0}
        onClear={clearPage}
        zoom={zoom}
        onZoom={setZoom}
        onCheck={onCheck && (() => onCheck(strokes))}
        canCheck={writingStrokes(strokes).length > 0 && marks?.status !== "checking"}
        checking={marks?.status === "checking"}
        actions={actions}
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
            {marks && <MarksLayer key={marks.id} marks={marks} sheet={sheet} width={width} height={height} />}
            <canvas
              ref={liveRef}
              className="absolute inset-0 select-none"
              style={{ touchAction: "pan-x pan-y", WebkitTouchCallout: "none", cursor }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
            />
            {selectionBox && choice.tool === "lasso" && (
              <SelectionBox box={selectionBox} scale={scale} count={selection.length} onDelete={deleteSelection} onDuplicate={duplicateSelection} />
            )}
            {textEdit && (
              <TextBox
                key={textEdit.token}
                edit={textEdit}
                scale={scale}
                onChange={(value) => setTextEdit({ ...textEdit, value })}
                onDone={(value) => finishText({ ...textEdit, value })}
                onCancel={() => setTextEdit(null)}
              />
            )}
            <AnimatePresence>
              {overlay?.note && <BoardNote key="note" anchor={overlay.region?.box ?? overlay.loop} note={overlay.note} scale={scale} pageWidth={width} />}
              {!overlay?.note && marks?.note && <BoardNote key={`marks-${marks.id}`} anchor={marks.anchor} note={marks.note} scale={scale} pageWidth={width} />}
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

/** Dashed box around a lasso selection, with its actions. Drag inside it (lasso tool) to move. */
function SelectionBox({ box, scale, count, onDelete, onDuplicate }: { box: Box; scale: number; count: number; onDelete: () => void; onDuplicate: () => void }) {
  const pad = 6;
  return (
    <>
      <div
        className="pointer-events-none absolute rounded-md border-2 border-dashed border-sky-500 bg-sky-400/5"
        style={{ left: box.x * scale - pad, top: box.y * scale - pad, width: box.w * scale + pad * 2, height: box.h * scale + pad * 2, cursor: "move" }}
      />
      <div
        className="absolute z-20 flex items-center gap-1 rounded-xl bg-slate-900 p-1 text-xs font-semibold text-white shadow-lg"
        style={{ left: box.x * scale - pad, top: Math.max(4, box.y * scale - pad - 40) }}
      >
        <span className="px-2 text-slate-300">{count} selected · drag to move</span>
        <button type="button" onClick={onDuplicate} className="rounded-lg px-2 py-1.5 hover:bg-white/10">
          Duplicate
        </button>
        <button type="button" onClick={onDelete} className="rounded-lg px-2 py-1.5 text-rose-300 hover:bg-white/10">
          Delete
        </button>
      </div>
    </>
  );
}

/** Typing on the page. Enter places the text, Shift+Enter adds a line, Escape cancels. */
function TextBox({
  edit,
  scale,
  onChange,
  onDone,
  onCancel,
}: {
  edit: TextEdit;
  scale: number;
  onChange: (value: string) => void;
  onDone: (value: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  const fontSize = edit.fontSize * scale;
  const lines = edit.value.split("\n");
  return (
    <textarea
      ref={ref}
      aria-label="Type on the page"
      value={edit.value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onDone(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onDone(e.currentTarget.value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      rows={lines.length}
      placeholder="Type…"
      spellCheck={false}
      className="absolute z-20 resize-none overflow-hidden rounded-md bg-white/70 p-0 outline-none ring-2 ring-sky-400"
      style={{
        left: edit.x * scale,
        top: edit.y * scale,
        fontSize,
        lineHeight: 1.25,
        fontFamily: TEXT_FONT,
        color: edit.color,
        width: Math.max(fontSize * 6, Math.max(...lines.map((l) => l.length)) * fontSize * 0.62 + fontSize),
      }}
    />
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

/** Red pen and ticks over the learner's working, drawn stroke by stroke like a teacher marking. */
function MarksLayer({ marks, sheet, width, height }: { marks: WorkMarks; sheet: Sheet; width: number; height: number }) {
  const pen = sheet.width * 0.0042;
  const size = Math.max(28, sheet.width * 0.028);
  const last = marks.lines[marks.lines.length - 1]?.box;
  return (
    <svg className="pointer-events-none absolute inset-0" width={width} height={height} viewBox={`0 0 ${sheet.width} ${sheet.height}`} aria-hidden>
      {marks.lines.map((line, i) => {
        const { box } = line;
        if (line.state === "checking") {
          return (
            <motion.rect
              key={i}
              x={box.x - 10}
              y={box.y - 8}
              width={box.w + 20}
              height={box.h + 16}
              rx={12}
              fill="#dbeafe"
              stroke="#60a5fa"
              strokeWidth={pen * 0.6}
              strokeDasharray="10 8"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.15, 0.55, 0.15] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.18 }}
            />
          );
        }
        if (line.state === "slip") {
          return (
            <motion.path
              key={i}
              d={roughRing(box, i + 3, sheet.width * 0.012)}
              fill="none"
              stroke="#dc2626"
              strokeWidth={pen}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0.9 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.7, ease: "easeInOut" }}
            />
          );
        }
        if (line.state === "ok") {
          return (
            <motion.path
              key={i}
              d={tick(Math.min(box.x + box.w + size * 0.6, sheet.width - size * 1.2), box.y + box.h / 2 - size * 0.2, size)}
              fill="none"
              stroke="#16a34a"
              strokeWidth={pen}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.35, delay: i * 0.18, ease: "easeOut" }}
            />
          );
        }
        return null;
      })}
      {marks.allCorrect && last && (
        <motion.path
          d={roughRing({ x: last.x - 6, y: last.y - 4, w: last.w + 12, h: last.h + 8 }, 7, sheet.width * 0.01)}
          fill="none"
          stroke="#16a34a"
          strokeWidth={pen}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, delay: marks.lines.length * 0.18 }}
        />
      )}
    </svg>
  );
}

const NOTE_TONES = {
  thinking: "bg-white ring-sky-200",
  hint: "bg-amber-50 ring-amber-300",
  slip: "bg-rose-50 ring-rose-300",
  done: "bg-emerald-50 ring-emerald-300",
};

function BoardNote({ anchor, note, scale, pageWidth }: { anchor: Box; note: Note; scale: number; pageWidth: number }) {
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
