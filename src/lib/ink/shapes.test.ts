import { describe, expect, it } from "vitest";
import { hitsStroke, type Stroke } from "./geometry";
import { lassoPick, pointInPolygon, shapePoints, strokesBounds, translateStrokes } from "./shapes";

const stroke = (id: string, points: [number, number][], extra: Partial<Stroke> = {}): Stroke => ({
  id,
  tool: "pen",
  color: "#000",
  size: 4,
  pressure: false,
  points: points.map(([x, y]) => ({ x, y, p: 0.5 })),
  ...extra,
});

const square = [
  { x: 0, y: 0, p: 0.5 },
  { x: 100, y: 0, p: 0.5 },
  { x: 100, y: 100, p: 0.5 },
  { x: 0, y: 100, p: 0.5 },
];

describe("shapePoints", () => {
  it("closes rectangles and ellipses", () => {
    const rect = shapePoints("rect", { x: 50, y: 40 }, { x: 10, y: 10 });
    expect(rect[0]).toEqual(rect[rect.length - 1]);
    expect(rect[0]).toMatchObject({ x: 10, y: 10 });
    const ellipse = shapePoints("ellipse", { x: 0, y: 0 }, { x: 100, y: 50 });
    expect(ellipse[0].x).toBeCloseTo(ellipse[ellipse.length - 1].x);
  });

  it("ends an arrow's barbs behind the tip", () => {
    const arrow = shapePoints("arrow", { x: 0, y: 0 }, { x: 200, y: 0 });
    expect(arrow[1]).toMatchObject({ x: 200, y: 0 });
    expect(arrow[2].x).toBeLessThan(200);
    expect(arrow[4].x).toBeLessThan(200);
    expect(Math.sign(arrow[2].y)).toBe(-Math.sign(arrow[4].y));
  });
});

describe("lasso", () => {
  it("finds points inside a polygon", () => {
    expect(pointInPolygon(50, 50, square)).toBe(true);
    expect(pointInPolygon(150, 50, square)).toBe(false);
  });

  it("picks strokes mostly inside, and text by its centre", () => {
    const strokes = [
      stroke("in", [[10, 10], [20, 20], [30, 30]]),
      stroke("half", [[50, 50], [150, 150], [160, 160]]),
      stroke("out", [[200, 200], [210, 210]]),
      stroke("text", [[40, 40], [60, 60]], { tool: "text", text: "x = 5" }),
    ];
    expect(lassoPick(strokes, square)).toEqual(["in", "text"]);
  });
});

describe("moving and bounds", () => {
  it("translates only the selected strokes", () => {
    const strokes = [stroke("a", [[0, 0]]), stroke("b", [[5, 5]])];
    const moved = translateStrokes(strokes, new Set(["a"]), 10, -2);
    expect(moved[0].points[0]).toMatchObject({ x: 10, y: -2 });
    expect(moved[1].points[0]).toMatchObject({ x: 5, y: 5 });
  });

  it("pads bounds by half the stroke width", () => {
    expect(strokesBounds([stroke("a", [[10, 10], [30, 20]])])).toEqual({ x: 8, y: 8, w: 24, h: 14 });
    expect(strokesBounds([])).toBeNull();
  });

  it("erases text when the eraser touches its box", () => {
    const text = stroke("t", [[100, 100], [200, 140]], { tool: "text", text: "hi" });
    expect(hitsStroke(text, 150, 120, 2)).toBe(true);
    expect(hitsStroke(text, 300, 120, 2)).toBe(false);
  });
});
