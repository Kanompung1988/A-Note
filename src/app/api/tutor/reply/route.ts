import { z } from "zod";
import { rateLimit } from "@/lib/ai/rate-limit";
import { errorResponse, keyContext } from "@/lib/ai/http";
import { replyTo } from "@/lib/ai/tutor";
import { keyItem } from "@/lib/store/keys";

export const maxDuration = 60;

const Body = z.object({
  responseId: z.string().min(1).max(200),
  message: z.string().trim().min(1).max(1000),
  context: keyContext,
});

/** Muse Spark: checks the learner's answer or follow-up, keeping the worksheet in context. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "reply");
  if (limited) return limited;
  try {
    const { context, ...input } = Body.parse(await request.json());
    const key = await keyItem(context?.source, context?.question);
    return Response.json(await replyTo({ ...input, key }));
  } catch (error) {
    return errorResponse(error);
  }
}
