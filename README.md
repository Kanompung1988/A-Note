<p align="center"><img src="public/brand/wordmark.png" alt="A-Note" width="420"></p>

# A-Note

**Circle what you don't get. A-Note sees exactly what you circled and walks you through it, one hint at a time.**
A web whiteboard where the learner and the tutor write on the same worksheet, and the teacher sees where the whole class is stuck while they work.

Built for the [Meta Global AI Developer Hackathon](https://cerebralvalley.ai/e/meta-ai-developer-hackathon) ·
Problem statement: **Build for Your World**

> All code in this repository was written during the hackathon (Oct 27 – Nov 4, 2026), starting from the first commit.

## Why

Many learners never raise their hand. They'd rather stay confused than ask in front of the class, and teachers only find out
at the test. A-Note makes asking as small as drawing a circle, keeps the help honest (hints, never answers), and turns
every private question into a live map of where the class needs the teacher.

## Meta models

| Model | What it does in A-Note |
|---|---|
| **SAM 3.1** | The learner's rough pen loop becomes a box prompt. SAM returns a precise mask of the equation, figure or word they meant, which A-Note shades on the page and uses to map the whole class. |
| **Muse Spark 1.3** | Reads the circled close-up with the whole page and tutors in structured, step-by-step hints (never the final answer). Follow-ups keep the page in context via `previous_response_id`. For teachers it reads the class's numbered spots and returns the likely misconception and a five-minute re-teach for each. |
| **Muse Voice Transcribe** | Learners tap the mic and ask out loud; the browser records, resamples to 16 kHz WAV and the question becomes text in about three seconds. |

Every model call goes through [`src/lib/meta/client.ts`](src/lib/meta/client.ts):
[`segment.ts`](src/lib/ai/segment.ts) (SAM 3.1, parsed with Meta's `@meta-sam/parser`),
[`tutor.ts`](src/lib/ai/tutor.ts) and [`insights.ts`](src/lib/ai/insights.ts) (Muse Spark, JSON-schema output),
[`transcribe.ts`](src/lib/ai/transcribe.ts) (Muse Voice Transcribe).

## How it works

**Learner** (`/join` → `/class/[code]` → a worksheet, or `/study` for solo practice)
1. Write on the worksheet in the browser with Apple Pencil, a mouse or a trackpad. Fingers scroll; the pencil never does.
2. Draw a loop around anything: **Ask here** pops up. (Loop detection is pure geometry and unit-tested, so underlines and scribbles don't trigger it.)
3. A-Note captures a close-up and the whole page with the learner's ink, then calls in parallel:
   `POST /api/segment` (SAM 3.1 shades exactly what was circled) and `POST /api/tutor` (Muse Spark pins hint 1 on the page beside it).
4. The learner reveals more hints, or types or says an answer; `POST /api/tutor/reply` checks it and marks it solved only when they got there themselves.

**Teacher** (`/teacher` → `/teacher/[code]`)
1. Create a class and put the six-letter code on the projector.
2. Assign a sample worksheet or upload a photo of your own.
3. The dashboard updates every few seconds: every learner's circle lands on the teacher's copy (SAM masks), grouped into numbered spots that glow brighter as more learners circle them, with who asked, hints used and who solved it.
4. **Ask A-Note** sends the worksheet with numbered spots to Muse Spark, which explains why the class is stuck and what to re-teach first.

## Status

| Part | State |
|---|---|
| Pen worksheet, circle to ask, ink saved per sheet | ✅ |
| SAM 3.1 outline of the circled region on the page | ✅ |
| Muse Spark hints pinned on the page, answer checking | ✅ |
| Voice questions with Muse Voice Transcribe | ✅ |
| Classes: join code, assign worksheets, photo upload | ✅ |
| Live teacher dashboard: stuck-spot map, learners table | ✅ |
| Class insight: misconception and re-teach per spot | ✅ |
| PDF worksheets | 🚧 (photos and images today) |
| Hosted database | 🚧 (a JSON file in `.data/` today, behind `src/lib/store`) |

## Run locally

```bash
npm install
cp .env.example .env.local   # add your META_API_KEY
npm run check:meta           # confirms the key works
npm run dev                  # http://localhost:3000
```

Tests:

```bash
npm test                                                     # unit tests (vitest)
npm run smoke -- http://localhost:3000 smoke-shots --ai      # Chrome drives a learner through the whole flow
npm run smoke:class -- http://localhost:3000 smoke-shots --ai  # a teacher and two learners, end to end
```

Class data is stored in `.data/` (override with `A_NOTE_DATA_DIR`). Model routes are rate-limited per IP.

## Other tools

Brand assets (logo, mascot, app icon) are drawn offline with OpenAI image generation
([`scripts/brand/generate-logo.mjs`](scripts/brand/generate-logo.mjs)). No OpenAI model runs in the app.
The mascot is an original clownfish whose tail is a pencil tip. The sample worksheets are original.
