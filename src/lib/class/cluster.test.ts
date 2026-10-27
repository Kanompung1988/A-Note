import { describe, expect, it } from "vitest";
import { clusterAsks, overlapRatio } from "./cluster";

let n = 0;
function ask(studentId: string, x: number, y: number, w = 300, h = 100, extra: Partial<{ circled: string; topic: string; solved: boolean }> = {}) {
  n += 1;
  return {
    id: `a${n}`,
    studentId,
    loop: { x, y, w, h },
    region: null,
    circled: extra.circled ?? null,
    topic: extra.topic ?? null,
    solved: extra.solved ?? false,
    createdAt: new Date(2026, 9, 27, 10, 0, n).toISOString(),
  };
}

describe("overlapRatio", () => {
  it("is 1 when one box sits inside the other", () => {
    expect(overlapRatio({ x: 0, y: 0, w: 100, h: 100 }, { x: 10, y: 10, w: 20, h: 20 })).toBe(1);
  });
  it("is 0 for boxes that do not touch", () => {
    expect(overlapRatio({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 })).toBe(0);
  });
});

describe("clusterAsks", () => {
  it("groups loops around the same problem and keeps distant ones apart", () => {
    const clusters = clusterAsks([
      ask("s1", 120, 380, 330, 100),
      ask("s2", 140, 390, 280, 90),
      ask("s3", 130, 540, 360, 100),
    ]);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].studentIds).toEqual(["s1", "s2"]);
    expect(clusters[1].studentIds).toEqual(["s3"]);
  });

  it("orders spots by how many different learners circled them", () => {
    const clusters = clusterAsks([
      ask("s1", 100, 100),
      ask("s1", 105, 102),
      ask("s2", 100, 600),
      ask("s3", 102, 601),
    ]);
    expect(clusters.map((c) => c.studentIds.length)).toEqual([2, 1]);
    expect(clusters[0].id).toBe(1);
    expect(clusters[1].askIds).toHaveLength(2);
  });

  it("counts solved asks and lists distinct transcriptions", () => {
    const [cluster] = clusterAsks([
      ask("s1", 100, 100, 300, 100, { circled: "5(x − 2) = 3x + 4", solved: true }),
      ask("s2", 110, 105, 300, 100, { circled: "5(x - 2) = 3x + 4" }),
      ask("s3", 105, 100, 300, 100, { circled: "5(x − 2) = 3x + 4", topic: "Distributing" }),
    ]);
    expect(cluster.solved).toBe(1);
    expect(cluster.circled).toEqual(["5(x − 2) = 3x + 4", "5(x - 2) = 3x + 4"]);
    expect(cluster.topics).toEqual(["Distributing"]);
  });

  it("returns nothing for no asks", () => {
    expect(clusterAsks([])).toEqual([]);
  });
});
