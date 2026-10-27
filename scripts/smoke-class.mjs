// Classroom smoke test: a teacher creates a class and assigns a worksheet, two learners join and
// circle the same problem, and the dashboard shows the spot live. --ai also asks Muse Spark for
// the class insight. Needs a running server.
// Usage: node scripts/smoke-class.mjs [baseUrl] [screenshotDir] [--ai]

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const withAi = args.includes("--ai");
const [baseUrl = "http://localhost:3000", shots = "smoke-shots"] = args.filter((a) => !a.startsWith("--"));
mkdirSync(shots, { recursive: true });

const executablePath = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((p) => p && existsSync(p));
if (!executablePath) throw new Error("No Chrome or Edge found; set CHROME_PATH");

const browser = await chromium.launch({ executablePath, headless: true });
const problems = [];
let failed = false;
function check(ok, label) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed = true;
}
const visible = (locator, timeout) => locator.first().waitFor({ timeout }).then(() => true, () => false);

async function newPage(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()} @ ${m.location().url}`));
  page.on("response", (r) => r.status() >= 400 && problems.push(`HTTP ${r.status()} ${r.request().method()} ${r.url()}`));
  return page;
}

// Problem 2 on the sample sheet, 5(x − 2) = 3x + 4, sits around x 150–480, y 560–615.
async function circleProblemTwo(page) {
  const canvas = page.locator("canvas").last();
  await canvas.waitFor({ timeout: 15_000 });
  const box = await canvas.boundingBox();
  const s = box.width / 1240;
  const cx = box.x + 315 * s;
  const cy = box.y + 588 * s;
  await page.mouse.move(cx + 190 * s, cy);
  await page.mouse.down();
  for (let i = 1; i <= 48; i++) {
    const a = (i / 48) * 2 * Math.PI * 1.05;
    await page.mouse.move(cx + 190 * s * Math.cos(a), cy + 50 * s * Math.sin(a));
  }
  await page.mouse.up();
  await page.getByRole("button", { name: "Ask here" }).click();
}

try {
  // Teacher creates a class and assigns the equations sheet.
  const teacher = await newPage({ width: 1440, height: 960 });
  await teacher.goto(`${baseUrl}/teacher`, { waitUntil: "networkidle" });
  await teacher.getByPlaceholder("Grade 7/2 Math").fill("Grade 7/2 Math");
  await teacher.getByPlaceholder("Kru Ann").fill("Kru Ann");
  await teacher.getByRole("button", { name: "Create class" }).click();
  await teacher.waitForURL(/\/teacher\/[A-Z0-9]{6}$/, { timeout: 10_000 });
  const code = teacher.url().split("/").pop();
  check(Boolean(code), `teacher created class ${code}`);
  await teacher.getByRole("button", { name: "Choose a worksheet" }).click();
  await teacher.getByRole("button", { name: /Worksheet 3 · Linear Equations/ }).click();
  check(await visible(teacher.getByRole("heading", { name: "Worksheet 3 · Linear Equations" }), 5_000), "worksheet assigned and shown on the dashboard");

  // Two learners join and circle the same problem.
  for (const name of ["Nok", "Ploy"]) {
    const learner = await newPage({ width: 1180, height: 820 });
    await learner.goto(`${baseUrl}/join?code=${code}`, { waitUntil: "networkidle" });
    await learner.getByPlaceholder("First name is fine").fill(name);
    await learner.getByRole("button", { name: "Join" }).click();
    await learner.waitForURL(new RegExp(`/class/${code}$`), { timeout: 10_000 });
    check(await visible(learner.getByText(`Hi ${name}`), 5_000), `${name} joined and sees the class home`);
    await learner.getByText("Worksheet 3 · Linear Equations").first().click();
    await learner.waitForURL(new RegExp(`/class/${code}/`), { timeout: 10_000 });
    await circleProblemTwo(learner);
    check(await visible(learner.getByAltText("What you circled"), 5_000), `${name} asked about problem 2`);
    if (withAi) {
      check(await visible(learner.getByText(/^Hint 1 of \d/), 60_000), `${name} got a first hint`);
      await learner.screenshot({ path: path.join(shots, `class-${name}.png`) });
    }
  }

  // The dashboard picks the spot up on its next poll.
  check(await visible(teacher.getByRole("button", { name: "Spot 1: 2 learners" }), 15_000), "dashboard shows one spot circled by 2 learners");
  await teacher.screenshot({ path: path.join(shots, "class-dashboard.png"), fullPage: true });

  if (withAi) {
    // wait for the learners' tutor results to be recorded, then ask for the class read
    await teacher.waitForTimeout(5_000);
    await teacher.getByRole("button", { name: "Ask A-Note" }).click();
    check(await visible(teacher.getByText(/^First,/), 60_000), "Muse Spark explains where the class is stuck");
    await teacher.screenshot({ path: path.join(shots, "class-insight.png"), fullPage: true });
  }
} finally {
  check(problems.length === 0, `no page errors${problems.length ? `:\n  ${problems.join("\n  ")}` : ""}`);
  await browser.close();
}
process.exit(failed ? 1 : 0);
