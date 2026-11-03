// Records the title cards (cards.html) as takes, their animations cued to the voiceover:
// video-out/takes/<scene>/. Run voice.mjs first.
// Usage: node scripts/video/cards.mjs [sceneId ...]

import path from "node:path";
import { pathToFileURL } from "node:url";
import { LEAD, SCENES, TAIL } from "./narration.mjs";
import { FULL_FRAME, launch, newContext, sleep, startTake } from "./recorder.mjs";
import { loadVoice } from "./timing.mjs";

const only = process.argv.slice(2);
const browser = await launch();
const page = await (await newContext(browser, FULL_FRAME)).newPage();
const url = pathToFileURL(path.resolve("scripts", "video", "cards.html")).href;

try {
  for (const scene of SCENES.filter((s) => s.card && (!only.length || only.includes(s.id)))) {
    const voice = loadVoice(scene.id);
    const cues = { start: 0.1 };
    for (const [name, phrase] of Object.entries(scene.cues)) cues[name] = Math.max(0.1, LEAD + voice.at(phrase) - 0.15);
    await page.goto(`${url}?card=${scene.id}`, { waitUntil: "networkidle" });
    await page.evaluate(() => window.ready);
    const take = await startTake(page, scene.id);
    await page.evaluate((c) => window.play(c), cues);
    await sleep((LEAD + voice.end + (scene.tail ?? TAIL)) * 1000);
    await take.stop();
  }
} finally {
  await browser.close();
}
