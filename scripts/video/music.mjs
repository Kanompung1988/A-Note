// A quiet instrumental bed for the demo video, made with the ElevenLabs music API: video-out/music.mp3.
// Usage: ELEVENLABS_API_KEY=... node scripts/video/music.mjs [seconds]

import { mkdirSync, writeFileSync } from "node:fs";

const key = process.env.ELEVENLABS_API_KEY;
if (!key) throw new Error("Set ELEVENLABS_API_KEY");
const seconds = Number(process.argv[2] ?? 180);

const res = await fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192", {
  method: "POST",
  headers: { "xi-api-key": key, "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt:
      "Warm, optimistic modern instrumental for an education technology product demo. Soft felt piano, light plucked synths, gentle hand claps, a soft kick, steady 100 BPM. Uplifting but understated so a voiceover sits on top, consistent energy, no vocals, no big drops. Ends on a soft resolved chord.",
    music_length_ms: seconds * 1000,
    force_instrumental: true,
  }),
});
if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
mkdirSync("video-out", { recursive: true });
writeFileSync("video-out/music.mp3", Buffer.from(await res.arrayBuffer()));
console.log(`music.mp3: ${seconds} s`);
