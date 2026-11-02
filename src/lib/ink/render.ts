import { getStroke } from "perfect-freehand";
import type { Stroke } from "./geometry";

export const ASKED_COLOR = "#f97316";

export const TEXT_FONT = '"Segoe UI", "Leelawadee UI", "Helvetica Neue", Thonburi, Arial, "Noto Sans Thai", sans-serif';
const TEXT_LINE = 1.25;

// iPad Safari refuses canvases larger than this many pixels; zoomed pages stay under it.
const MAX_CANVAS_PIXELS = 16_000_000;

function outline(stroke: Stroke, complete: boolean): Path2D {
  const highlighter = stroke.tool === "highlighter";
  const points = getStroke(
    stroke.points.map((p) => [p.x, p.y, p.p]),
    {
      size: stroke.size,
      thinning: highlighter ? 0 : 0.55,
      smoothing: 0.5,
      streamline: highlighter ? 0.6 : 0.4,
      simulatePressure: !highlighter && !stroke.pressure,
      start: { cap: true, taper: highlighter ? 0 : 2 },
      end: { cap: true, taper: highlighter ? 0 : 2 },
      last: complete,
    },
  );
  return new Path2D(svgPath(points));
}

// Turns perfect-freehand's outline polygon into a smooth closed SVG path (midpoint quadratic curves).
function svgPath(points: number[][]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0][0]} ${points[0][1]} Q`;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    d += ` ${x0} ${y0} ${(x0 + x1) / 2} ${(y0 + y1) / 2}`;
  }
  return `${d} Z`;
}

/** Draws one stroke. The context's transform must already map page space to the canvas. */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, complete = true): void {
  if (stroke.tool === "text") return drawText(ctx, stroke);
  if (stroke.shape) return drawShape(ctx, stroke);
  ctx.fillStyle = stroke.asked ? ASKED_COLOR : stroke.color;
  ctx.globalAlpha = stroke.tool === "highlighter" ? 0.35 : 1;
  ctx.fill(outline(stroke, complete));
  ctx.globalAlpha = 1;
}

function drawShape(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const [first, ...rest] = stroke.points;
  if (!first) return;
  ctx.save();
  ctx.strokeStyle = stroke.asked ? ASKED_COLOR : stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (const p of rest) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const [origin] = stroke.points;
  if (!origin || !stroke.text) return;
  const size = stroke.fontSize ?? 32;
  ctx.save();
  ctx.fillStyle = stroke.color;
  ctx.font = `${size}px ${TEXT_FONT}`;
  ctx.textBaseline = "top";
  stroke.text.split("\n").forEach((line, i) => ctx.fillText(line, origin.x, origin.y + i * size * TEXT_LINE));
  ctx.restore();
}

let measurer: CanvasRenderingContext2D | null = null;

/** The page-space box a block of typed text takes at `fontSize`. */
export function measureText(text: string, fontSize: number): { w: number; h: number } {
  measurer ??= document.createElement("canvas").getContext("2d");
  const lines = text.split("\n");
  if (!measurer) return { w: fontSize * 0.6 * Math.max(...lines.map((l) => l.length)), h: lines.length * fontSize * TEXT_LINE };
  measurer.font = `${fontSize}px ${TEXT_FONT}`;
  return { w: Math.max(...lines.map((l) => measurer!.measureText(l).width), fontSize * 0.5), h: lines.length * fontSize * TEXT_LINE };
}

/** Sizes a canvas for crisp drawing at `cssWidth` and maps page space onto it. */
export function fitCanvas(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number, pageWidth: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, cssWidth * cssHeight)));
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  const ctx = canvas.getContext("2d")!;
  const scale = (cssWidth / pageWidth) * dpr;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  return ctx;
}

export function clearCanvas(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}
