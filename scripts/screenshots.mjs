// Takes the README screenshots from a running server (real models): docs/screenshots/*.png
// Usage: node scripts/screenshots.mjs [baseUrl] [ask|check|teacher ...]

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { write } from "./handwriting.mjs";

const [baseUrl = "http://localhost:3000"] = process.argv.slice(2);
const out = path.join("docs", "screenshots");
mkdirSync(out, { recursive: true });
const executablePath = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
  .filter(Boolean)
  .find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath, headless: true });
const shot = (page, name, options = {}) => page.screenshot({ path: path.join(out, `${name}.png`), ...options }).then(() => console.log(`saved ${name}.png`));

/** Runs one section; a failure is reported and the next section still runs. */
async function section(name, run) {
  try {
    await run();
  } catch (error) {
    console.error(`${name} failed: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
  }
}
const only = process.argv.slice(3);
const wanted = (name) => !only.length || only.includes(name);

const settle = (page) => page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 30_000 }).then(() => page.waitForTimeout(800));

// 1. Circle to ask: SAM outline and the first hint on the page
if (wanted("ask")) await section("ask", async () => {
  const page = await browser.newPage({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 2 });
  await page.goto(`${baseUrl}/study`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  const box = await page.locator("canvas").last().boundingBox();
  const s = box.width / 1240;
  const [cx, cy, rx, ry] = [box.x + 335 * s, box.y + 585 * s, 215 * s, 50 * s];
  await page.mouse.move(cx + rx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 48; i++) await page.mouse.move(cx + rx * Math.cos((i / 48) * 2 * Math.PI * 1.05), cy + ry * Math.sin((i / 48) * 2 * Math.PI * 1.05));
  await page.mouse.up();
  await page.getByRole("button", { name: "Ask here" }).click();
  await page.locator('svg path[fill="#fb923c"]').first().waitFor({ timeout: 40_000 });
  await page.getByText(/^Hint 1 of \d/).first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1200);
  await shot(page, "ask");
  const showMe = page.getByRole("button", { name: "Show me a picture" });
  if (await showMe.isVisible()) {
    await showMe.click();
    await page.getByAltText("A picture of the idea").waitFor({ timeout: 60_000 });
    await settle(page);
    await shot(page, "show-me");
  }
  await page.close();
});

// 2. Check my work: the red pen
if (wanted("check")) await section("check", async () => {
  const page = await browser.newPage({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 2 });
  await page.goto(`${baseUrl}/study`, { waitUntil: "networkidle" });
  const strokes = [...write("5x - 2 = 3x + 4", 600, 557, 32), ...write("2x = 6", 600, 603, 32), ...write("x = 3", 600, 649, 32)];
  await page.evaluate((st) => localStorage.setItem("a-note:ink:linear-equations", JSON.stringify(st)), strokes);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Check my work" }).click();
  await page.getByRole("button", { name: /Ask about line/ }).waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1800);
  await shot(page, "check");
  await page.close();
});

// 3. Teacher: create with A-Note, then the co-pilot, on a seeded class
if (wanted("teacher")) await section("teacher", async () => {
  const seed = execFileSync("node", [path.join("scripts", "seed-demo.mjs"), baseUrl]).toString();
  const seatLink = seed.match(/(\S+#seat=\S+)/)[1];
  const page = await browser.newPage({ viewport: { width: 1440, height: 940 }, deviceScaleFactor: 2 });
  await page.goto(seatLink, { waitUntil: "domcontentloaded" });
  await page.getByText("Plan tomorrow with the co-pilot").waitFor({ timeout: 30_000 });
  await settle(page);
  await shot(page, "dashboard");

  await page.getByRole("button", { name: "+ Assign a worksheet" }).click();
  await page.getByPlaceholder(/two-step equations/).fill("Fractions of a pizza and a chocolate bar, with word problems");
  await page.getByRole("button", { name: "Write it" }).click();
  await page.getByText(/answers confirmed by an independent Muse Wonder solve/).waitFor({ timeout: 150_000 });
  await settle(page);
  await shot(page, "create");
  await page.getByRole("button", { name: "Discard" }).click();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Run the co-pilot" }).click();
  await page.getByText("Exit ticket").waitFor({ timeout: 240_000 });
  await settle(page);
  // the sticky top bar would cover the panel in an element screenshot
  await page.addStyleTag({ content: "header { position: static !important; }" });
  const panel = page.locator("div.rounded-3xl.bg-slate-900").first();
  await panel.screenshot({ path: path.join(out, "copilot.png") });
  console.log("saved copilot.png");
  await page.close();
});

await browser.close();
