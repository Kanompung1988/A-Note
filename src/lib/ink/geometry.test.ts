import { describe, expect, it } from "vitest";
import { detectLoop, expandBox, hitsStroke, totalTurning, type InkPoint, type Stroke } from "./geometry";

const PAGE_WIDTH = 1240;

function ellipse(cx: number, cy: number, rx: number, ry: number, turns = 1, steps = 60, startAngle = 0): InkPoint[] {
  return Array.from({ length: Math.round(steps * turns) + 1 }, (_, i) => {
    const a = startAngle + (i / steps) * 2 * Math.PI;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a), p: 0.5 };
  });
}

function line(x0: number, y0: number, x1: number, y1: number, steps = 30): InkPoint[] {
  return Array.from({ length: steps + 1 }, (_, i) => ({
    x: x0 + ((x1 - x0) * i) / steps,
    y: y0 + ((y1 - y0) * i) / steps,
    p: 0.5,
  }));
}

describe("detectLoop", () => {
  it("accepts a circle around a word", () => {
    const box = detectLoop(ellipse(400, 300, 120, 50), PAGE_WIDTH);
    expect(box).not.toBeNull();
    expect(box!.w).toBeCloseTo(240, 0);
    expect(box!.h).toBeCloseTo(100, 0);
  });

  it("accepts a loop that stops a little short of its start", () => {
    expect(detectLoop(ellipse(400, 300, 120, 50, 0.9), PAGE_WIDTH)).not.toBeNull();
  });

  it("accepts a loop that overshoots past its start", () => {
    expect(detectLoop(ellipse(400, 300, 90, 90, 1.15), PAGE_WIDTH)).not.toBeNull();
  });

  it("accepts a loop drawn counter-clockwise", () => {
    const points = ellipse(400, 300, 120, 50).reverse();
    expect(detectLoop(points, PAGE_WIDTH)).not.toBeNull();
  });

  it("rejects an underline", () => {
    expect(detectLoop(line(100, 500, 600, 505), PAGE_WIDTH)).toBeNull();
  });

  it("rejects an out-and-back stroke", () => {
    expect(detectLoop([...line(100, 500, 600, 520), ...line(600, 520, 102, 503)], PAGE_WIDTH)).toBeNull();
  });

  it("rejects a zigzag scribble", () => {
    const zigzag: InkPoint[] = Array.from({ length: 12 }, (_, i) => ({ x: 100 + i * 20, y: i % 2 ? 300 : 340, p: 0.5 }));
    zigzag.push({ x: 110, y: 320, p: 0.5 });
    expect(detectLoop(zigzag, PAGE_WIDTH)).toBeNull();
  });

  it("rejects an open arc like the letter C", () => {
    expect(detectLoop(ellipse(400, 300, 80, 80, 0.6), PAGE_WIDTH)).toBeNull();
  });

  it("rejects a tiny loop such as a handwritten letter o", () => {
    expect(detectLoop(ellipse(400, 300, 8, 8), PAGE_WIDTH)).toBeNull();
  });
});

describe("totalTurning", () => {
  it("is about a full turn for a circle", () => {
    expect(Math.abs(totalTurning(ellipse(0, 0, 100, 100), 1))).toBeCloseTo(2 * Math.PI, 0);
  });
});

describe("hitsStroke", () => {
  const stroke: Stroke = { id: "s", tool: "pen", color: "#000", size: 4, pressure: false, points: line(0, 0, 100, 0) };

  it("hits near the line", () => {
    expect(hitsStroke(stroke, 50, 8, 8)).toBe(true);
  });

  it("misses away from the line", () => {
    expect(hitsStroke(stroke, 50, 30, 8)).toBe(false);
  });
});

describe("expandBox", () => {
  it("pads and clamps to the page", () => {
    expect(expandBox({ x: 10, y: 10, w: 100, h: 50 }, 20, { width: 120, height: 1000 })).toEqual({ x: 0, y: 0, w: 120, h: 80 });
  });
});
