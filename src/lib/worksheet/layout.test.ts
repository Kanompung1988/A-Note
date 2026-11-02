import { describe, expect, it } from "vitest";
import { escapeXml, layoutWorksheet, measure, wrap } from "./layout";

describe("wrap", () => {
  it("keeps every line within the width", () => {
    const lines = wrap("A som tam stall earned 150 baht more on Saturday than on Sunday. Over both days it earned 1,250 baht.", 32, 600);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(measure(line, 32)).toBeLessThanOrEqual(600);
    expect(lines.join(" ")).toContain("1,250 baht.");
  });

  it("wraps Thai, which has no spaces between words", () => {
    const thai = "ร้านส้มตำขายได้มากกว่าวันอาทิตย์หนึ่งร้อยห้าสิบบาทในวันเสาร์ และสองวันรวมกันขายได้หนึ่งพันสองร้อยห้าสิบบาท";
    const lines = wrap(thai, 32, 400);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("").replace(/\s/g, "")).toBe(thai.replace(/\s/g, ""));
  });
});

describe("layoutWorksheet", () => {
  const layout = layoutWorksheet({
    title: "Two-step equations",
    subtitle: "Grade 7 Mathematics",
    instructions: "Solve each equation. Show your working.",
    questions: [
      { prompt: "3x + 7 = 22", kind: "working" },
      { prompt: "A <tricky> & \"quoted\" question that is long enough to wrap onto a second line of the page for sure.", kind: "explain" },
      { prompt: "What is 2 + 2?", kind: "short" },
    ],
    footer: "Written by A-Note",
  });

  it("numbers questions in order with boxes that do not overlap", () => {
    expect(layout.questions.map((q) => q.n)).toEqual([1, 2, 3]);
    for (let i = 1; i < layout.questions.length; i++) {
      const prev = layout.questions[i - 1].box;
      expect(layout.questions[i].box.y).toBeGreaterThanOrEqual(prev.y + prev.h);
    }
  });

  it("escapes text", () => {
    expect(layout.svg).toContain("&lt;tricky&gt; &amp; &quot;quoted&quot;");
    expect(escapeXml("<a>")).toBe("&lt;a&gt;");
  });

  it("is at least one A4 page tall", () => {
    expect(layout.height).toBeGreaterThanOrEqual(1754);
  });
});
