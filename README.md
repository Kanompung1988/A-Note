<p align="center"><img src="public/brand/wordmark.png" alt="A-Note" width="420"></p>

# A-Note

**Circle what you don't get. A-Note sees exactly what you circled and walks you through it, step by step, in Thai.**
Teachers see where the whole class is stuck before the test.

Built for the [Meta Global AI Developer Hackathon](https://cerebralvalley.ai/e/meta-ai-developer-hackathon) ·
Problem statement: **Build for Your World**

> All code in this repository was written during the hackathon (Oct 27 – Nov 4, 2026), starting from the first commit.

## Meta models

| Model | What it does in A-Note |
|---|---|
| **Muse Spark 1.3** | Reads the circled handwriting, equation or figure in context of the page and tutors step by step (hint first, answer last). |
| **SAM 3.1** | Turns a rough pen circle into a precise mask of the question, figure or term the learner meant. |
| **Muse Voice Transcribe** | Lets learners ask out loud in Thai. |

All model calls go through [`src/lib/meta/client.ts`](src/lib/meta/client.ts).

## Status

| Part | State |
|---|---|
| Next.js 16 app, Meta Model API client, `/api/health` | ✅ |
| Pen canvas on a worksheet, circle to ask | 🚧 |
| SAM 3.1 region isolation | 🚧 |
| Muse Spark tutor | 🚧 |
| Thai voice questions | 🚧 |
| Teacher view: where the class is stuck | 🚧 |

## Run locally

```bash
npm install
cp .env.example .env.local   # add your META_API_KEY
npm run check:meta           # confirms the key works
npm run dev                  # http://localhost:3000
```

## Other tools

Brand assets (logo, mascot, app icon) are drawn offline with OpenAI image generation
([`scripts/brand/generate-logo.mjs`](scripts/brand/generate-logo.mjs)). No OpenAI model runs in the app.
The mascot is an original clownfish whose tail is a pencil tip.
