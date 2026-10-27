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
```
`GET /api/health` reports whether the server reaches the Meta API and sees every required model.

## Language
UI is Thai first, English second. Code, comments and the README are in English (judges read them).
