import type { Box } from "@/lib/ink/geometry";
import type { AskRecord } from "@/lib/store/types";

/** A spot on the worksheet that several learners circled. */
export type Cluster = {
  /** 1 is the spot the most learners circled */
  id: number;
  box: Box;
  askIds: string[];
  studentIds: string[];
  solved: number;
  /** distinct transcriptions of what was circled, most recent first */
  circled: string[];
  topics: string[];
};

type ClusterInput = Pick<AskRecord, "id" | "studentId" | "loop" | "region" | "circled" | "topic" | "solved" | "createdAt">;

export function askBox(ask: Pick<AskRecord, "loop" | "region">): Box {
  return ask.region?.box ?? ask.loop;
}

/** Overlap relative to the smaller box, so a small circle inside a big one still counts as the same spot. */
export function overlapRatio(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.min(a.w * a.h, b.w * b.h);
}

function union(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** Groups asks that circle the same spot. Clusters come back ordered by how many learners they hold. */
export function clusterAsks(asks: readonly ClusterInput[], threshold = 0.35): Cluster[] {
  const groups: { boxes: Box[]; asks: ClusterInput[]; box: Box }[] = [];
  const ordered = [...asks].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const ask of ordered) {
    const box = askBox(ask);
    const group = groups.find((g) => g.boxes.some((b) => overlapRatio(b, box) >= threshold));
    if (group) {
      group.boxes.push(box);
      group.asks.push(ask);
      group.box = union(group.box, box);
    } else {
      groups.push({ boxes: [box], asks: [ask], box });
    }
  }

  return groups
    .map((g) => {
      const latestFirst = [...g.asks].reverse();
      return {
        id: 0,
        box: g.box,
        askIds: g.asks.map((a) => a.id),
        studentIds: [...new Set(g.asks.map((a) => a.studentId))],
        solved: g.asks.filter((a) => a.solved).length,
        circled: distinct(latestFirst.map((a) => a.circled)),
        topics: distinct(latestFirst.map((a) => a.topic)),
      };
    })
    .sort((a, b) => b.studentIds.length - a.studentIds.length || b.askIds.length - a.askIds.length || a.box.y - b.box.y)
    .map((c, i) => ({ ...c, id: i + 1 }));
}

function distinct(values: (string | null)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v?.trim();
    if (key && !seen.has(key.toLowerCase())) {
      seen.add(key.toLowerCase());
      out.push(key);
    }
  }
  return out;
}
