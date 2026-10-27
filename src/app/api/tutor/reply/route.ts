import { z } from "zod";
import { rateLimit } from "@/lib/ai/rate-limit";
import { errorResponse } from "@/lib/ai/http";
import { replyTo } from "@/lib/ai/tutor";

export const maxDuration = 60;

const Body = z.object({
  responseId: z.string().min(1).max(200),
  message: z.string().trim().min(1).max(1000),
});

/** Muse Spark: checks the learner's answer or follow-up, keeping the worksheet in context. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "reply");
  if (limited) return limited;
  try {
    return Response.json(await replyTo(Body.parse(await request.json())));
  } catch (error) {
    return errorResponse(error);
  }
}
