import { z } from "zod";
import { checkWork } from "@/lib/ai/check";
import { errorResponse, imageDataUrl, keyContext } from "@/lib/ai/http";
import { rateLimit } from "@/lib/ai/rate-limit";
import { keyItem } from "@/lib/store/keys";

export const maxDuration = 60;

const Body = z.object({
  crop: imageDataUrl,
  page: imageDataUrl,
  lineCount: z.number().int().min(1).max(30),
  context: keyContext,
});

/** Muse Spark reads the learner's handwritten working line by line and finds the first slip. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "check");
  if (limited) return limited;
  try {
    const { context, ...input } = Body.parse(await request.json());
    const key = await keyItem(context?.source, context?.question);
    return Response.json({ check: await checkWork({ ...input, key }), grounded: Boolean(key) });
  } catch (error) {
    return errorResponse(error);
  }
}
