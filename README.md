<p align="center"><img src="public/brand/wordmark.png" alt="A-Note" width="420"></p>

# A-Note

**Circle what you don't get. A-Note sees exactly what you circled and walks you through it, one hint at a time.**
A web whiteboard where the learner and the tutor write on the same worksheet. Teachers see where the whole class is stuck.

Built for the [Meta Global AI Developer Hackathon](https://cerebralvalley.ai/e/meta-ai-developer-hackathon) ·
Problem statement: **Build for Your World**

> All code in this repository was written during the hackathon (Oct 27 – Nov 4, 2026), starting from the first commit.

## Meta models

| Model | What it does in A-Note |
|---|---|
| **SAM 3.1** | The learner's rough pen loop becomes a box prompt; SAM returns a precise mask of the equation, figure or word they meant, which A-Note shades on the page. |
| **Muse Spark 1.3** | Reads the circled close-up together with the whole page, then tutors with structured, step-by-step hints (never the final answer). Follow-ups keep the page in context via `previous_response_id`. |
| **Muse Voice Transcribe** | Lets learners ask out loud (planned). |

All model calls go through [`src/lib/meta/client.ts`](src/lib/meta/client.ts):
[`segment.ts`](src/lib/ai/segment.ts) (SAM 3.1, parsed with Meta's `@meta-sam/parser`) and [`tutor.ts`](src/lib/ai/tutor.ts) (Muse Spark, JSON-schema output).

## How it works

1. The learner writes on a worksheet in the browser (Apple Pencil, mouse or trackpad).
2. Drawing a loop around something offers **Ask here** (loop detection is pure geometry, unit-tested).
3. A-Note captures a close-up and the whole page with the learner's ink, then calls in parallel:
   - `POST /api/segment` → SAM 3.1 shades exactly what was circled,
   - `POST /api/tutor` → Muse Spark writes hint 1 on a note pinned beside it.
4. The learner reveals more hints or types an answer; `POST /api/tutor/reply` checks it and marks the problem solved.

## Status

| Part | State |
|---|---|
| Next.js 16 app, Meta Model API client, `/api/health` | ✅ |
| Pen canvas on a worksheet, circle to ask | ✅ |
| SAM 3.1 highlight of the circled region | ✅ |
| Muse Spark hints written on the page, answer checking | ✅ |
| Voice questions (Muse Voice Transcribe) | 🚧 |
| Teacher view: assign sheets, see where the class is stuck | 🚧 |

## Run locally

```bash
npm install
cp .env.example .env.local   # add your META_API_KEY
npm run check:meta           # confirms the key works
npm run dev                  # http://localhost:3000
npm test                     # unit tests
npm run smoke -- http://localhost:3000 smoke-shots --ai   # drives Chrome through the whole flow
```

## Other tools

Brand assets (logo, mascot, app icon) are drawn offline with OpenAI image generation
([`scripts/brand/generate-logo.mjs`](scripts/brand/generate-logo.mjs)). No OpenAI model runs in the app.
The mascot is an original clownfish whose tail is a pencil tip.
