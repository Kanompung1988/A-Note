import "server-only";
import { metaFetch, MODELS } from "@/lib/meta/client";

/** Muse Voice Transcribe: a short spoken question (16-bit PCM WAV) to text. */
export async function transcribe(wav: Blob): Promise<string> {
  const form = new FormData();
  form.append(
    "request",
    new Blob([JSON.stringify({ model: MODELS.transcribe, audioEncoding: "WAV", mode: "PUSH_TO_TALK" })], { type: "application/json" }),
  );
  form.append("audio", wav, "question.wav");
  const res = await metaFetch("/asr/transcribe", { method: "POST", body: form, headers: { Accept: "text/plain" } });
  // text/plain gives one turn per line
  return (await res.text())
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}
