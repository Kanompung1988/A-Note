// Pure ink geometry. All coordinates are in page space: pixels of the worksheet's natural size,
// so strokes stay put when the page is shown at a different size.

export type InkPoint = { x: number; y: number; p: number };

export type Tool = "pen" | "highlighter";

export type Stroke = {
  id: string;
  tool: Tool;
  color: string;
  size: number;
  /** false when the device gave no real pressure (mouse), so the renderer simulates it from speed */
  pressure: boolean;
  points: InkPoint[];
  /** set once the learner asked about the region this loop encloses */
  asked?: boolean;
};

export type Box = { x: number; y: number; w: number; h: number };

export function bounds(points: readonly InkPoint[]): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { x, y } of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function pathLength(points: readonly InkPoint[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return length;
}

/** Signed sum of heading changes along the path, ignoring steps shorter than `minStep` (jitter). */
export function totalTurning(points: readonly InkPoint[], minStep: number): number {
  const kept: InkPoint[] = [];
  for (const point of points) {
    const last = kept[kept.length - 1];
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= minStep) kept.push(point);
  }
  let turning = 0;
  let previous: number | null = null;
  for (let i = 1; i < kept.length; i++) {
    const heading = Math.atan2(kept[i].y - kept[i - 1].y, kept[i].x - kept[i - 1].x);
    if (previous !== null) {
      let delta = heading - previous;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta <= -Math.PI) delta += 2 * Math.PI;
      turning += delta;
    }
    previous = heading;
  }
  return turning;
}

/**
 * Returns the enclosed box when a stroke is a hand-drawn loop around something, otherwise null.
 * A loop ends near where it started, is long relative to its size, and turns roughly a full circle.
 * Underlines, ticks, out-and-back strokes and zigzag scribbles all fail at least one test.
 */
export function detectLoop(points: readonly InkPoint[], pageWidth: number): Box | null {
  if (points.length < 6) return null;
  const box = bounds(points);
  const minSide = pageWidth * 0.02;
  if (box.w < minSide || box.h < minSide * 0.6) return null;

  const diagonal = Math.hypot(box.w, box.h);
  const first = points[0];
  const last = points[points.length - 1];
  const gap = Math.hypot(last.x - first.x, last.y - first.y);
  if (gap > Math.max(pageWidth * 0.03, diagonal * 0.35)) return null;

  if (pathLength(points) < diagonal * 1.8) return null;

  const turning = Math.abs(totalTurning(points, pageWidth * 0.004));
  if (turning < 1.5 * Math.PI) return null;

  return box;
}

/** Whether a stroke passes within `radius` of (x, y). Used by the stroke eraser. */
export function hitsStroke(stroke: Stroke, x: number, y: number, radius: number): boolean {
  const reach = radius + stroke.size / 2;
  const { points } = stroke;
  if (points.length === 1) return Math.hypot(points[0].x - x, points[0].y - y) <= reach;
  for (let i = 1; i < points.length; i++) {
    if (distanceToSegment(x, y, points[i - 1], points[i]) <= reach) return true;
  }
  return false;
}

function distanceToSegment(x: number, y: number, a: InkPoint, b: InkPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lengthSq));
  return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
}

/** Grows a box by `pad` on every side, clamped to the page. */
export function expandBox(box: Box, pad: number, page: { width: number; height: number }): Box {
  const x = Math.max(0, box.x - pad);
  const y = Math.max(0, box.y - pad);
  return {
    x,
    y,
    w: Math.min(page.width, box.x + box.w + pad) - x,
    h: Math.min(page.height, box.y + box.h + pad) - y,
  };
}
