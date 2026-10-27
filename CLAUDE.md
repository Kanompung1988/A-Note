# CLAUDE.md: working on A-Note

@AGENTS.md

A-Note is a Thai-first study app built for the Meta Global AI Developer Hackathon
(building period Oct 27 – Nov 4, 2026; submissions due Wed Nov 4, 9:00 PM ET = Thu Nov 5, 09:00 Bangkok).
A learner circles what they don't understand on a worksheet; A-Note isolates exactly that region and
teaches step by step. Teachers see where the class is stuck.

## Hard rules
1. **Every AI call in the app goes to the Meta Model API** through `src/lib/meta/client.ts`
   (Muse Spark, SAM 3.1, Muse Voice Transcribe). No other model provider in `src/`.
2. `OPEN_AI_API_KEY` is only for offline brand-asset scripts under `scripts/brand/`. Never import it in `src/`.
3. **All code here is written fresh during the hackathon.** Never copy code from other projects.
4. Secrets live only in `.env.local` (gitignored) and the host's env settings. Never print, log or commit them;
   when inspecting env files, show names and lengths only.
5. Never send learner data to `-contributor` models (Meta may train on contributor-mode traffic).
6. Next.js here is 16.x and differs from older versions. Read `node_modules/next/dist/docs/` before using an API.

## Commands
```bash
npm run dev          # http://localhost:3000
npm run typecheck    # tsc --noEmit
npm run lint
npm run check:meta   # smoke-test the Meta key (prints model ids and one reply, never the key)
npm test             # vitest unit tests
npm run smoke -- <baseUrl> <shotsDir> [--ai]        # Chrome drives /study; --ai also calls the real models
npm run smoke:class -- <baseUrl> <shotsDir> [--ai]  # a teacher and two learners end to end
```

## Map
- `src/lib/meta/client.ts`: the only Meta Model API client. `src/lib/ai/*`: SAM, tutor, insights, transcribe, rate limits.
- `src/lib/ink/*`: pure ink geometry (loop detection, tested), rendering, capture of the circled region.
- `src/lib/store/*`: class data behind `read`/`write` in `db.ts` (a JSON file in `.data/` for now; swap here for a hosted DB).
- `src/lib/class/*`: spot clustering (tested), browser API calls, this browser's teacher/learner seats (localStorage).
- Pages: `/` landing, `/study` solo, `/join` → `/class/[code]` → `/class/[code]/[assignmentId]`, `/teacher` → `/teacher/[code]`.
  Screens that read localStorage load through `src/components/ClientOnly.tsx` (no server render).
`GET /api/health` reports whether the server reaches the Meta API and sees every required model.

## Language
Everything in the app is English: UI, sample worksheets, tutor default. The tutor answers in the learner's
own language when they write in another one. Code, comments and the README are in English.

## Product shape
Web-first for both learners and teachers: a whiteboard where the tutor writes on the same page
(SAM 3.1 shading of the circled region, hint notes pinned beside it), not just a side chat.
