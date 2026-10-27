// Browser smoke test for /study: draws a loop with the mouse, taps "Ask here" and checks the tutor flow.
// Pass --ai to also wait for the real Meta model calls (SAM highlight, first hint, a reply).
// Needs a running server. Usage: node scripts/smoke-study.mjs [baseUrl] [screenshotDir] [--ai]
// Uses the system Chrome (or CHROME_PATH), so no browser download is needed.

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const withAi = args.includes("--ai");
const [baseUrl = "http://localhost:3000", shots = "smoke-shots"] = args.filter((a) => !a.startsWith("--"));
mkdirSync(shots, { recursive: true });

const candidates = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);
const executablePath = candidates.find((p) => existsSync(p));
if (!executablePath) throw new Error("No Chrome or Edge found; set CHROME_PATH");

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));

let failed = false;
function check(ok, label) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed = true;
}
const visible = (locator, timeout) => locator.first().waitFor({ timeout }).then(() => true, () => false);

try {
  await page.goto(`${baseUrl}/study`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  const canvas = page.locator("canvas").last();
  await canvas.waitFor({ timeout: 10_000 });
  const box = await canvas.boundingBox();
  check(box && box.width > 300, `worksheet canvas is on screen (${Math.round(box?.width ?? 0)}px wide)`);

  // Problem 1 sits around x 150–420, y 405–460 in the 1240px-wide sample sheet.
  const s = box.width / 1240;
  const cx = box.x + 285 * s;
  const cy = box.y + 432 * s;
  const rx = 165 * s;
  const ry = 48 * s;
  const askButton = page.getByRole("button", { name: "Ask here" });

  // A short underline first: it must not offer to ask.
  await page.mouse.move(box.x + 150 * s, box.y + 470 * s);
  await page.mouse.down();
  await page.mouse.move(box.x + 420 * s, box.y + 472 * s, { steps: 12 });
  await page.mouse.up();
  check((await askButton.count()) === 0, "an underline does not pop the ask chip");

  // Now a loop around problem 1.
  await page.mouse.move(cx + rx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 48; i++) {
    const a = (i / 48) * 2 * Math.PI * 1.05;
    await page.mouse.move(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
  }
  await page.mouse.up();
  check(await visible(askButton, 3_000), "a loop pops the ask chip");
  await page.screenshot({ path: path.join(shots, "1-loop.png") });

  if (await askButton.isVisible()) {
    await askButton.click();
    check(await visible(page.getByAltText("What you circled"), 5_000), "tapping it opens the panel with the close-up");
    check(await visible(page.getByText("Looking at what you circled…"), 3_000), "the tutor's note appears on the page while it thinks");
    await page.screenshot({ path: path.join(shots, "2-thinking.png") });

    if (withAi) {
      check(await visible(page.locator('svg path[fill="#fb923c"]'), 30_000), "SAM 3.1 highlight is drawn on the page");
      check(await visible(page.getByText(/^Hint 1 of \d/), 60_000), "Muse Spark's first hint is written on the page");
      await page.screenshot({ path: path.join(shots, "3-hint.png") });
      await page.getByRole("button", { name: "Next hint" }).click();
      check(await visible(page.getByText(/^Hint 2 of \d/), 3_000), "Next hint moves the note to hint 2");
      await page.getByPlaceholder("Type or say your answer…").fill("I subtract 7 from both sides so 3x = 15, then x = 5");
      await page.getByRole("button", { name: "Send" }).click();
      check(await visible(page.getByText("You got it"), 60_000), "a correct answer is recognised");
      await page.screenshot({ path: path.join(shots, "4-solved.png") });
    }
  }

  await page.reload({ waitUntil: "networkidle" });
  await page.locator("canvas").last().waitFor();
  const saved = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("a-note:ink:")).length);
  check(saved === 1, "ink survives a reload");

  // Next keeps visited pages alive in the background; coming back must not lose the canvases.
  await page.getByRole("link", { name: "A-Note" }).first().click();
  await page.waitForURL(`${baseUrl}/`);
  await page.goBack();
  await page.waitForTimeout(1500);
  check((await page.locator("canvas").count()) === 2, "leaving and coming back keeps the worksheet working");
} finally {
  check(problems.length === 0, `no page errors${problems.length ? `:\n  ${problems.join("\n  ")}` : ""}`);
  await browser.close();
}
process.exit(failed ? 1 : 0);
