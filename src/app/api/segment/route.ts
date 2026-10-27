import { z } from "zod";
import { rateLimit } from "@/lib/ai/rate-limit";
import { errorResponse, imageDataUrl } from "@/lib/ai/http";
import { segmentRegion } from "@/lib/ai/segment";

export const maxDuration = 30;

const Body = z.object({
  image: imageDataUrl,
  size: z.object({ width: z.number().int().positive().max(8000), height: z.number().int().positive().max(8000) }),
  box: z.object({ x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive() }),
});

/** SAM 3.1: the learner's loop in, a tight mask of what they circled out. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "segment");
  if (limited) return limited;
  try {
    const { image, size, box } = Body.parse(await request.json());
    return Response.json({ region: await segmentRegion(image, size, box) });
  } catch (error) {
    return errorResponse(error);
  }
}
