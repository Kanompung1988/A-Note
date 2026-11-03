// Speaks the demo video's voiceover with ElevenLabs, one clip per scene, with character timings for the
// captions: video-out/voice/<scene>.mp3 and <scene>.json. Clips that exist are kept (pass --force to redo).
// Usage: ELEVENLABS_API_KEY=... node scripts/video/voice.mjs [--force] [sceneId ...]

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SCENES, VOICE } from "./narration.mjs";

const key = process.env.ELEVENLABS_API_KEY;
if (!key) throw new Error("Set ELEVENLABS_API_KEY");
const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--"));
const out = path.join("video-out", "voice");
mkdirSync(out, { recursive: true });

for (const [i, scene] of SCENES.entries()) {
  if (only.length && !only.includes(scene.id)) continue;
  const file = path.join(out, `${scene.id}.mp3`);
  if (existsSync(file) && !force) {
    console.log(`kept ${scene.id}`);
    continue;
  }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE.id}/with-timestamps?output_format=mp3_44100_192`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: scene.say,
      model_id: VOICE.model,
      voice_settings: VOICE.settings,
      // neighbouring lines keep the delivery continuous across clips
      previous_text: SCENES[i - 1]?.say,
      next_text: SCENES[i + 1]?.say,
    }),
  });
  if (!res.ok) throw new Error(`${scene.id}: ${res.status} ${await res.text()}`);
  const body = await res.json();
  const a = body.alignment;
  writeFileSync(file, Buffer.from(body.audio_base64, "base64"));
  writeFileSync(
    path.join(out, `${scene.id}.json`),
    JSON.stringify({ text: scene.say, chars: a.characters, starts: a.character_start_times_seconds, ends: a.character_end_times_seconds }),
  );
  console.log(`spoke ${scene.id}: ${a.character_end_times_seconds.at(-1).toFixed(2)} s`);
}
