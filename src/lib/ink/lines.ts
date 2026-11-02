import { bounds, type Box, type Stroke } from "./geometry";

// Groups a learner's handwriting into lines, then picks the block of working they just wrote.
// "Check my work" numbers these lines on the image it sends (set-of-mark prompting), so the model
// only has to say "line 3" and A-Note knows exactly where on the page to draw its red circle.

export type InkLine = { box: Box; strokeIds: string[] };

function verticalOverlap(a: Box, b: Box): number {
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  return Math.max(0, bottom - top);
}

function union(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** What counts as working: pen writing and typed text, not highlighter, shapes or loops already asked about. */
export function writingStrokes(strokes: readonly Stroke[]): Stroke[] {
  return strokes.filter((s) => s.points.length > 0 && (s.tool === "text" || (s.tool === "pen" && !s.asked && !s.shape)));
}

/**
 * Strokes whose vertical extents overlap enough sit on the same line. Tall strokes (a long division bar,
 * a bracket) join the line they overlap most instead of swallowing neighbours.
 */
export function inkLines(strokes: readonly Stroke[], pageWidth: number): InkLine[] {
  const minHeight = pageWidth * 0.012;
  const items = writingStrokes(strokes)
    .map((s) => {
      const b = bounds(s.points);
      // dots and dashes have almost no height; give them some so they can join a line
      const h = Math.max(b.h, minHeight);
      return { id: s.id, box: { x: b.x, y: b.y + b.h / 2 - h / 2, w: Math.max(b.w, 1), h } };
    })
    .sort((a, b) => a.box.y + a.box.h / 2 - (b.box.y + b.box.h / 2));

  const lines: InkLine[] = [];
  for (const item of items) {
    let best: InkLine | null = null;
    let bestShare = 0;
    for (const line of lines) {
      const share = verticalOverlap(line.box, item.box) / Math.min(line.box.h, item.box.h);
      if (share > bestShare) {
        best = line;
        bestShare = share;
      }
    }
    if (best && bestShare >= 0.45) {
      best.box = union(best.box, item.box);
      best.strokeIds.push(item.id);
    } else {
      lines.push({ box: item.box, strokeIds: [item.id] });
    }
  }
  return lines.sort((a, b) => a.box.y - b.box.y);
}

/**
 * The run of lines around the most recent writing: neighbours closer than about two line heights
 * belong to the same piece of working. When `within` is given (the question's box), only lines inside it count.
 */
export function workBlock(lines: readonly InkLine[], latestStrokeId: string, within?: Box | null): InkLine[] {
  const pool = within ? lines.filter((l) => centerInside(l.box, within)) : [...lines];
  const at = pool.findIndex((l) => l.strokeIds.includes(latestStrokeId));
  if (at < 0) return [];
  if (within) return pool;

  const heights = pool.map((l) => l.box.h).sort((a, b) => a - b);
  const typical = heights[Math.floor(heights.length / 2)];
  const maxGap = typical * 2.2;
  let start = at;
  let end = at;
  while (start > 0 && pool[start].box.y - (pool[start - 1].box.y + pool[start - 1].box.h) < maxGap) start--;
  while (end < pool.length - 1 && pool[end + 1].box.y - (pool[end].box.y + pool[end].box.h) < maxGap) end++;
  return pool.slice(start, end + 1);
}

function centerInside(box: Box, area: Box): boolean {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return cx >= area.x && cx <= area.x + area.w && cy >= area.y && cy <= area.y + area.h;
}

export function blockBox(lines: readonly InkLine[]): Box | null {
  return lines.length ? lines.map((l) => l.box).reduce(union) : null;
}
