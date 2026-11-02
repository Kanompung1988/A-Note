import { describe, expect, it } from "vitest";
import type { Stroke } from "./geometry";
import { blockBox, inkLines, workBlock } from "./lines";

const PAGE = 1240;
let next = 0;

/** A short horizontal squiggle standing in for one handwritten word. */
function word(x: number, y: number, w = 60, h = 30, extra: Partial<Stroke> = {}): Stroke {
  const points = Array.from({ length: 8 }, (_, i) => ({ x: x + (w * i) / 7, y: y + (i % 2 ? h : 0), p: 0.5 }));
  return { id: `s${next++}`, tool: "pen", color: "#000", size: 4, pressure: false, points, ...extra };
}

describe("inkLines", () => {
  it("groups words on the same baseline and splits lines", () => {
    const strokes = [word(150, 600), word(230, 604), word(320, 598), word(150, 680), word(240, 684)];
    const lines = inkLines(strokes, PAGE);
    expect(lines).toHaveLength(2);
    expect(lines[0].strokeIds).toHaveLength(3);
    expect(lines[1].strokeIds).toHaveLength(2);
  });

  it("ignores highlighter and asked loops", () => {
    const strokes = [word(150, 600), word(150, 700, 60, 30, { tool: "highlighter" }), word(150, 800, 60, 30, { asked: true })];
    expect(inkLines(strokes, PAGE)).toHaveLength(1);
  });
});

describe("workBlock", () => {
  it("takes the lines around the latest stroke and stops at a big gap", () => {
    const strokes = [word(150, 300), word(150, 1000), word(150, 1060), word(150, 1120)];
    const lines = inkLines(strokes, PAGE);
    const block = workBlock(lines, strokes[3].id);
    expect(block).toHaveLength(3);
    expect(blockBox(block)!.y).toBeGreaterThan(900);
  });

  it("limits the block to the question's box when given", () => {
    const strokes = [word(150, 400), word(150, 460), word(150, 560)];
    const lines = inkLines(strokes, PAGE);
    const block = workBlock(lines, strokes[1].id, { x: 80, y: 380, w: 1080, h: 140 });
    expect(block).toHaveLength(2);
  });

  it("returns nothing when the latest stroke is outside the box", () => {
    const strokes = [word(150, 400), word(150, 900)];
    expect(workBlock(inkLines(strokes, PAGE), strokes[1].id, { x: 80, y: 380, w: 1080, h: 140 })).toEqual([]);
  });
});
