// Browser smoke test for "Check my work" on /study. Writes working on the linear-equations sample with
// the test handwriting font, taps "Check my work" and waits for Muse Spark's line-by-line marking:
// a wrong block must be circled on the right line, a correct block must come back all correct.
// Usage: node scripts/smoke-check.mjs [baseUrl] [screenshotDir]   (always calls the real models)

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { write } from "./handwriting.mjs";

const [baseUrl = "http://localhost:3000", shots = "smoke-shots"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
mkdirSync(shots, { recursive: true });

const executablePath = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]
  .filter(Boolean)
  .find((p) => existsSync(p));
if (!executablePath) throw new Error("No Chrome or Edge found; set CHROME_PATH");

// Question 1 is 3x + 7 = 22. Line 1 adds 7 instead of subtracting it.
const wrong = [...write("3x = 22 + 7", 560, 405, 34), ...write("3x = 29", 560, 452, 34), ...write("x = 29/3", 560, 499, 34)];
// Question 4 is 2x − 3 = −x + 12, solved correctly.
const right = [...write("3x - 3 = 12", 600, 885, 34), ...write("3x = 15", 600, 932, 34), ...write("x = 5", 600, 979, 34)];

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("response", (r) => r.status() >= 400 && problems.push(`HTTP ${r.status()} ${r.request().method()} ${r.url()}`));

let failed = false;
function check(ok, label) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed = true;
}
const visible = (locator, timeout) => locator.first().waitFor({ timeout }).then(() => true, () => false);

async function runCheck(strokes, name) {
  await page.evaluate((s) => localStorage.setItem("a-note:ink:linear-equations", JSON.stringify(s)), strokes);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("canvas").last().waitFor();
  const started = Date.now();
  const response = page.waitForResponse((r) => r.url().endsWith("/api/check"), { timeout: 90_000 });
  await page.getByRole("button", { name: "Check my work" }).click();
  check(await visible(page.getByText(/of your handwriting/), 5_000), `${name}: the panel shows A-Note reading the lines`);
  const res = await response;
  const body = await res.json().catch(() => ({}));
  console.log(`      ${Date.now() - started} ms`, JSON.stringify(body.check?.lines ?? body), "slip:", body.check?.first_slip, "grounded:", body.grounded);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(shots, `check-${name}.png`) });
  return body.check;
}

try {
  await page.goto(`${baseUrl}/study`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());

  const a = await runCheck([...right, ...wrong], "wrong");
  check(a?.first_slip === 1, "the slip is found on line 1 (7 added instead of subtracted)");
  check(await visible(page.locator('svg path[stroke="#dc2626"]'), 3_000), "a red ring is drawn around the slip");
  check(await visible(page.getByRole("button", { name: /Ask about line/ }), 2_000), "the learner can ask about that line");

  const b = await runCheck([...wrong, ...right], "right");
  check(b?.all_correct === true, "correct working comes back all correct");
  check(await visible(page.locator('svg path[stroke="#16a34a"]'), 3_000), "green ticks are drawn");
} finally {
  check(problems.length === 0, `no page errors${problems.length ? `:\n  ${problems.join("\n  ")}` : ""}`);
  await browser.close();
}
process.exit(failed ? 1 : 0);
