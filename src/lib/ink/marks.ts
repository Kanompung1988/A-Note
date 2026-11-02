import type { Box } from "./geometry";

// Pen marks A-Note draws on the page when it checks work: a hand-drawn ring around a slip and ticks
// beside correct lines. Deterministic wobble, so a mark looks the same on every render.

function noise(seed: number, i: number): number {
  const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/** A slightly uneven ellipse around `box` that overshoots its start, like a quick teacher's circle. */
export function roughRing(box: Box, seed = 1, pad = 14): string {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const rx = box.w / 2 + pad * 1.6;
  const ry = box.h / 2 + pad;
  const start = -2.2 + noise(seed, 0) * 0.4;
  const sweep = Math.PI * 2 + 0.45;
  const steps = 48;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = start + (sweep * i) / steps;
    // the ring drifts outward as it closes, so the end overlaps rather than meets the start
    const drift = 1 + (i / steps) * 0.07 + (noise(seed, i) - 0.5) * 0.03;
    const x = cx + Math.cos(t) * rx * drift;
    const y = cy + Math.sin(t) * ry * drift;
    d += `${i ? " L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

/** A tick whose short arm starts at (x, y), `size` pixels tall. */
export function tick(x: number, y: number, size: number): string {
  return `M ${x} ${y} l ${size * 0.32} ${size * 0.34} l ${size * 0.7} ${-size * 0.84}`;
}
