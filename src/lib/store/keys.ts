import "server-only";
import { SAMPLE_KEYS } from "@/lib/sample-keys";
import { learnerContext } from "./classes";
import type { KeyItem } from "./types";

/** Where a question comes from: a class worksheet (checked against the learner's seat) or a sample sheet. */
export type KeyContext = { code: string; studentId: string; assignmentId: string } | { sampleId: string };

/** The answer key item for question `n`, if this worksheet has one. */
export async function keyItem(ctx: KeyContext | undefined, n: number | null | undefined): Promise<KeyItem | null> {
  if (!ctx || !n) return null;
  if ("sampleId" in ctx) return SAMPLE_KEYS[ctx.sampleId]?.items.find((i) => i.n === n) ?? null;
  const found = await learnerContext(ctx);
  return found?.assignment.key?.items.find((i) => i.n === n) ?? null;
}
