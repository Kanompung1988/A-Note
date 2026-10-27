import { z } from "zod";
import { errorResponse, notFound, pageRegion } from "@/lib/ai/http";
import { updateAsk } from "@/lib/store/classes";

const Body = z.object({
  studentId: z.string().min(1).max(40),
  region: pageRegion.nullable().optional(),
  circled: z.string().max(500).optional(),
  topic: z.string().max(200).optional(),
  hintsSeen: z.number().int().min(0).max(20).optional(),
  replies: z.number().int().min(0).max(500).optional(),
  solved: z.boolean().optional(),
});

/** Progress on one ask: what SAM and the tutor saw, hints used, replies, solved. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/asks/[id]">) {
  try {
    const { id } = await ctx.params;
    const { studentId, ...patch } = Body.parse(await request.json());
    const ask = await updateAsk(id, studentId, patch);
    return ask ? new Response(null, { status: 204 }) : notFound();
  } catch (error) {
    return errorResponse(error);
  }
}
