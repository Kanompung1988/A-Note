import { z } from "zod";
import { rateLimit } from "@/lib/ai/rate-limit";
import { errorResponse, imageDataUrl } from "@/lib/ai/http";
import { firstHints } from "@/lib/ai/tutor";

export const maxDuration = 60;

const Body = z.object({
  crop: imageDataUrl,
  page: imageDataUrl,
  question: z.string().max(500).optional(),
});

/** Muse Spark: reads the circled close-up with the page and answers with step-by-step hints. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "tutor");
  if (limited) return limited;
  try {
    return Response.json(await firstHints(Body.parse(await request.json())));
  } catch (error) {
    return errorResponse(error);
  }
}
