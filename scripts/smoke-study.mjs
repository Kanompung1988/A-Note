// Browser smoke test for /study: draws a loop with the mouse, taps "ถามตรงนี้" and checks the close-up.
// Needs a running server. Usage: node scripts/smoke-study.mjs [baseUrl] [screenshotDir]
// Uses the system Chrome (or CHROME_PATH), so no browser download is needed.

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const baseUrl = process.argv[2] ?? "http://localhost:3000";
const shots = process.argv[3] ?? "smoke-shots";
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

  // A short underline first: it must not offer to ask.
  await page.mouse.move(box.x + 150 * s, box.y + 470 * s);
  await page.mouse.down();
  await page.mouse.move(box.x + 420 * s, box.y + 472 * s, { steps: 12 });
  await page.mouse.up();
  check((await page.getByRole("button", { name: "ถามตรงนี้" }).count()) === 0, "an underline does not pop the ask chip");

  // Now a loop around problem 1.
  await page.mouse.move(cx + rx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 48; i++) {
    const a = (i / 48) * 2 * Math.PI * 1.05;
    await page.mouse.move(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
  }
  await page.mouse.up();
  const chip = page.getByRole("button", { name: "ถามตรงนี้" });
  await chip.waitFor({ timeout: 3_000 }).catch(() => {});
  check(await chip.isVisible(), "a loop pops the ask chip");
  await page.screenshot({ path: path.join(shots, "1-loop.png") });

  if (await chip.isVisible()) {
    await chip.click();
    const crop = page.getByAltText("ส่วนที่วงไว้");
    await crop.waitFor({ timeout: 5_000 }).catch(() => {});
    check(await crop.isVisible(), "tapping it opens the panel with the close-up");
    await page.screenshot({ path: path.join(shots, "2-panel.png") });
  }

  await page.reload({ waitUntil: "networkidle" });
  await page.locator("canvas").last().waitFor();
  const saved = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("a-note:ink:")).length);
  check(saved === 1, "ink survives a reload");
} finally {
  check(problems.length === 0, `no page errors${problems.length ? `:\n  ${problems.join("\n  ")}` : ""}`);
  await browser.close();
}
process.exit(failed ? 1 : 0);
