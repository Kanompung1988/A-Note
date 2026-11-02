import { z } from "zod";
import { rateLimit } from "@/lib/ai/rate-limit";
import { errorResponse, imageDataUrl, keyContext } from "@/lib/ai/http";
import { firstHints } from "@/lib/ai/tutor";
import { keyItem } from "@/lib/store/keys";

export const maxDuration = 60;

const Body = z.object({
  crop: imageDataUrl,
  page: imageDataUrl,
  question: z.string().max(500).optional(),
  context: keyContext,
});

/** Muse Spark: reads the circled close-up with the page and answers with step-by-step hints. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "tutor");
  if (limited) return limited;
  try {
    const { context, ...input } = Body.parse(await request.json());
    const key = await keyItem(context?.source, context?.question);
    return Response.json(await firstHints({ ...input, key }));
  } catch (error) {
    return errorResponse(error);
  }
}
