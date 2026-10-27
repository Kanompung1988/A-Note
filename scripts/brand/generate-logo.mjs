// Offline brand-asset generator. Uses OpenAI image generation, never part of the app pipeline.
// node --env-file=.env.local scripts/brand/generate-logo.mjs [model] [variant ...]
// Writes PNGs to brand/drafts/ (gitignored). Chosen assets are copied to public/brand/ by hand.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const key = process.env.OPEN_AI_API_KEY;
if (!key) {
  console.error("OPEN_AI_API_KEY is not set (expected in .env.local)");
  process.exit(1);
}

const CHARACTER = [
  "An original mascot for A-Note, a Thai study app where students circle what they don't understand on a worksheet.",
  "The character is a chubby, friendly clownfish: bright tangerine-orange body, three soft white bands edged with thin deep-navy lines,",
  "short rounded fins, big round curious eyes with a small white highlight, and a gentle closed-mouth smile.",
  "Signature detail: its tail fin is shaped like the sharpened tip of a pencil (light wood cone with a dark graphite point).",
  "Flat vector illustration, bold clean outlines in deep navy, at most two tones of shading, crisp edges, friendly and calm, not hyper-cute.",
].join(" ");

const VARIANTS = {
  mascot: `${CHARACTER} Full body, three-quarter view, swimming happily. A single hand-drawn navy ink loop trails from the pencil tail and circles around the fish, like a pen circling a word on paper. Centered with generous padding, plain transparent background, no text.`,
  icon: `${CHARACTER} A square mobile app icon with rounded corners. Background: soft ocean blue to light aqua. The clownfish's face and front half fill the lower two thirds, looking up. A loose white hand-drawn circle loops around its face. Very simple shapes that stay readable at 32 pixels. No text.`,
  wordmark: `${CHARACTER} A horizontal logo: the word "A-Note" in a rounded, bold, geometric sans-serif, deep navy letters, perfectly spelled. The small clownfish replaces the hyphen, swimming between "A" and "Note". Clean, balanced spacing, transparent background, no other text.`,
  peek: `${CHARACTER} The clownfish peeks over the top edge of a white lined notebook page, holding a yellow pencil in one fin and waving with the other. A small navy pen circle is drawn around one word-shaped scribble on the page. Centered, transparent background, no readable text.`,
};

const model = process.argv[2] ?? "gpt-image-2.5-sunburst";
const wanted = process.argv.slice(3);
const variants = wanted.length ? wanted : Object.keys(VARIANTS);
const outDir = path.join(process.cwd(), "brand", "drafts");
await mkdir(outDir, { recursive: true });

async function generate(variant) {
  const prompt = VARIANTS[variant];
  if (!prompt) throw new Error(`unknown variant "${variant}"`);
  const attempts = [
    { model, prompt, size: "1024x1024", quality: "high", background: "transparent", n: 1 },
    { model, prompt, size: "1024x1024", n: 1 },
  ];
  for (const body of attempts) {
    const started = Date.now();
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      console.warn(`${variant}: ${res.status} ${JSON.stringify(json.error?.message ?? json).slice(0, 200)}`);
      if (res.status === 400) continue;
      return;
    }
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) {
      console.warn(`${variant}: no image in response`);
      return;
    }
    const file = path.join(outDir, `${model}-${variant}.png`);
    await writeFile(file, Buffer.from(b64, "base64"));
    console.log(`${variant}: saved ${path.relative(process.cwd(), file)} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
}

await Promise.all(variants.map((v) => generate(v).catch((e) => console.warn(`${v}: ${e.message}`))));
