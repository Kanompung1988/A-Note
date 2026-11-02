import { z } from "zod";
import { errorResponse, forbidden, teacherKey } from "@/lib/ai/http";
import { rateLimit } from "@/lib/ai/rate-limit";
import { ndjson } from "@/lib/ai/stream";
import { createWorksheet } from "@/lib/ai/worksheet";
import { addAssignment, teacherClass } from "@/lib/store/classes";

export const maxDuration = 300;

const Body = z.object({
  topic: z.string().trim().min(3).max(300),
  grade: z.string().trim().min(1).max(60),
  count: z.number().int().min(2).max(8),
  language: z.string().trim().min(2).max(40),
  picture: z.boolean(),
});

/**
 * "Create with A-Note": streams progress while the worksheet is written, verified and drawn, then saves it
 * as a draft the teacher reviews (with its answer key) before learners can see it.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/classes/[code]/generate">) {
  const limited = rateLimit(request, "generate");
  if (limited) return limited;
  try {
    const { code } = await ctx.params;
    const classRoom = await teacherClass(code, teacherKey(request));
    if (!classRoom) return forbidden();
    const req = Body.parse(await request.json());
    return ndjson(async (send) => {
      const pipeline = createWorksheet(req);
      for (;;) {
        const step = await pipeline.next();
        if (step.done) {
          const { sheet, key, verdicts } = step.value;
          const assignment = await addAssignment(classRoom.id, sheet, { origin: "generated", key, draft: true });
          send({ type: "done", assignment, verified: verdicts.filter((v) => v.agrees).length, total: verdicts.length });
          return;
        }
        send({ type: "progress", ...step.value });
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
