// A tiny single-stroke "handwriting" font for tests and demo seeding: turns text like "3x = 29" into
// A-Note pen strokes (page-space points with a little wobble), so smoke tests can write working on a
// worksheet without a human. Glyphs are polylines in a box 0.65 wide and 1 tall (y grows downward).

const G = {
  0: [ellipse(0.32, 0.5, 0.28, 0.5)],
  1: [[[0.18, 0.2], [0.38, 0], [0.38, 1]]],
  2: [[[0.05, 0.25], [0.2, 0.05], [0.45, 0], [0.6, 0.12], [0.6, 0.32], [0.48, 0.52], [0.05, 1], [0.65, 1]]],
  3: [[[0.05, 0.1], [0.3, 0], [0.55, 0.08], [0.58, 0.28], [0.3, 0.45], [0.58, 0.6], [0.6, 0.85], [0.35, 1], [0.05, 0.92]]],
  4: [[[0.45, 1], [0.45, 0], [0.02, 0.68], [0.65, 0.68]]],
  5: [[[0.6, 0], [0.12, 0], [0.08, 0.45], [0.35, 0.38], [0.58, 0.52], [0.6, 0.8], [0.38, 1], [0.05, 0.92]]],
  6: [[[0.55, 0.05], [0.3, 0], [0.1, 0.25], [0.05, 0.65], [0.15, 0.95], [0.38, 1], [0.58, 0.85], [0.58, 0.6], [0.35, 0.48], [0.1, 0.6]]],
  7: [[[0.02, 0], [0.62, 0], [0.25, 1]]],
  8: [[[0.32, 0.47], [0.08, 0.3], [0.1, 0.08], [0.32, 0], [0.55, 0.08], [0.56, 0.3], [0.32, 0.47], [0.05, 0.68], [0.08, 0.92], [0.32, 1], [0.58, 0.92], [0.6, 0.68], [0.32, 0.47]]],
  9: [[[0.55, 0.4], [0.35, 0.5], [0.1, 0.4], [0.08, 0.15], [0.3, 0], [0.55, 0.1], [0.58, 0.4], [0.5, 1]]],
  x: [[[0.05, 0.4], [0.55, 1]], [[0.55, 0.4], [0.05, 1]]],
  "=": [[[0.05, 0.5], [0.6, 0.5]], [[0.05, 0.74], [0.6, 0.74]]],
  "+": [[[0.32, 0.34], [0.32, 0.92]], [[0.04, 0.63], [0.6, 0.63]]],
  "-": [[[0.08, 0.64], [0.55, 0.64]]],
  "/": [[[0.55, 0], [0.08, 1]]],
  ".": [[[0.25, 0.95], [0.3, 1], [0.26, 0.98]]],
  "(": [[[0.4, 0], [0.15, 0.3], [0.12, 0.7], [0.4, 1]]],
  ")": [[[0.15, 0], [0.4, 0.3], [0.43, 0.7], [0.15, 1]]],
};

function ellipse(cx, cy, rx, ry) {
  return Array.from({ length: 17 }, (_, i) => {
    const a = -Math.PI / 2 - (i / 16) * Math.PI * 2;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
}

let seq = 0;
const rand = (() => {
  let s = 42;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
})();

/** Strokes that write `text` with its top-left corner at (x, y), letters `h` page pixels tall. */
export function write(text, x, y, h, color = "#1e293b") {
  const strokes = [];
  let cursor = x;
  for (const ch of text) {
    if (ch === " ") {
      cursor += h * 0.42;
      continue;
    }
    const glyph = G[ch];
    if (!glyph) throw new Error(`no glyph for "${ch}"`);
    const slant = (rand() - 0.5) * 0.06;
    for (const line of glyph) {
      const points = [];
      for (let i = 0; i < line.length - 1; i++) {
        const [ax, ay] = line[i];
        const [bx, by] = line[i + 1];
        for (let k = 0; k < 6; k++) {
          const t = k / 6;
          const gx = ax + (bx - ax) * t;
          const gy = ay + (by - ay) * t;
          points.push({ x: cursor + (gx + slant * (1 - gy)) * h + (rand() - 0.5) * 1.2, y: y + gy * h + (rand() - 0.5) * 1.2, p: 0.5 });
        }
      }
      const [lx, ly] = line[line.length - 1];
      points.push({ x: cursor + lx * h, y: y + ly * h, p: 0.5 });
      strokes.push({ id: `hw-${Date.now().toString(36)}-${seq++}`, tool: "pen", color, size: 1240 * 0.0032, pressure: false, points });
    }
    cursor += h * (ch === "1" || ch === "." ? 0.5 : 0.78);
  }
  return strokes;
}
