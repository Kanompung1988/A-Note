import { z } from "zod";
import { errorResponse } from "@/lib/ai/http";
import { rateLimit } from "@/lib/ai/rate-limit";
import { createImage } from "@/lib/meta/client";

export const maxDuration = 60;

const Body = z.object({ brief: z.string().trim().min(4).max(400) });

const STYLE =
  "Simple, friendly flat illustration for a 12-year-old, soft colours, plain white background, one clear idea. No words, letters, numbers or labels anywhere in the image.";

/** Muse Image: the "Show me" hint, a picture or analogy that makes the idea click. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "picture");
  if (limited) return limited;
  try {
    const { brief } = Body.parse(await request.json());
    const { dataUrl } = await createImage(`${brief} ${STYLE}`, "1024x768", request.signal);
    return Response.json({ image: dataUrl });
  } catch (error) {
    return errorResponse(error);
  }
}
