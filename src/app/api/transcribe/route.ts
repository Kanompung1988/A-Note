import { errorResponse } from "@/lib/ai/http";
import { rateLimit } from "@/lib/ai/rate-limit";
import { transcribe } from "@/lib/ai/transcribe";

export const maxDuration = 60;

// Spoken questions are short; 60 s of 16 kHz 16-bit mono is under 2 MB.
const MAX_BYTES = 4 * 1024 * 1024;

/** Muse Voice Transcribe: the learner asks out loud. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "transcribe");
  if (limited) return limited;
  try {
    const form = await request.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File) || audio.size === 0 || audio.size > MAX_BYTES) {
      return Response.json({ error: "bad_request" }, { status: 400 });
    }
    return Response.json({ text: await transcribe(audio) });
  } catch (error) {
    return errorResponse(error);
  }
}
