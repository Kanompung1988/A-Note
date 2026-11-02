import { bounds, type Box, type InkPoint, type Shape, type Stroke } from "./geometry";

// Pure helpers for the board tools: shapes as pen polylines, lasso selection, moving a selection.

const pt = (x: number, y: number): InkPoint => ({ x, y, p: 0.5 });

/** The polyline for a shape dragged from `a` to `b`. Arrow heads scale with the length, within limits. */
export function shapePoints(shape: Shape, a: { x: number; y: number }, b: { x: number; y: number }): InkPoint[] {
  if (shape === "line") return [pt(a.x, a.y), pt(b.x, b.y)];
  if (shape === "arrow") {
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const head = Math.min(40, Math.max(14, Math.hypot(b.x - a.x, b.y - a.y) * 0.25));
    const left = pt(b.x - head * Math.cos(angle - 0.5), b.y - head * Math.sin(angle - 0.5));
    const right = pt(b.x - head * Math.cos(angle + 0.5), b.y - head * Math.sin(angle + 0.5));
    // one polyline: along the shaft, out to one barb, back to the tip, out to the other
    return [pt(a.x, a.y), pt(b.x, b.y), left, pt(b.x, b.y), right];
  }
  const x0 = Math.min(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  if (shape === "rect") return [pt(x0, y0), pt(x1, y0), pt(x1, y1), pt(x0, y1), pt(x0, y0)];
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return Array.from({ length: 49 }, (_, i) => {
    const t = (i / 48) * Math.PI * 2;
    return pt(cx + ((x1 - x0) / 2) * Math.cos(t), cy + ((y1 - y0) / 2) * Math.sin(t));
  });
}

/** Even-odd ray casting. */
export function pointInPolygon(x: number, y: number, polygon: readonly { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Ids of the strokes the lasso encloses: most of their points (or a text box's centre) inside it. */
export function lassoPick(strokes: readonly Stroke[], lasso: readonly InkPoint[], share = 0.6): string[] {
  if (lasso.length < 3) return [];
  return strokes
    .filter((s) => {
      if (s.tool === "text") {
        const b = bounds(s.points);
        return pointInPolygon(b.x + b.w / 2, b.y + b.h / 2, lasso);
      }
      const inside = s.points.filter((p) => pointInPolygon(p.x, p.y, lasso)).length;
      return inside / s.points.length >= share;
    })
    .map((s) => s.id);
}

/** The box around a set of strokes, or null for none. */
export function strokesBounds(strokes: readonly Stroke[]): Box | null {
  const points = strokes.flatMap((s) => s.points);
  if (!points.length) return null;
  const b = bounds(points);
  const pad = Math.max(...strokes.map((s) => s.size / 2), 0);
  return { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
}

export function translateStrokes(strokes: readonly Stroke[], ids: ReadonlySet<string>, dx: number, dy: number): Stroke[] {
  return strokes.map((s) => (ids.has(s.id) ? { ...s, points: s.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) } : s));
}
