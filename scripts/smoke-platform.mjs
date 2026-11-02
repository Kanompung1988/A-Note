// End-to-end smoke test for the classroom loop, with the real models:
//   1. seed a class (scripts/seed-demo.mjs), open the teacher dashboard from its seat link
//   2. "Create with A-Note": write a worksheet, review the verified key, assign it
//   3. run the co-pilot and wait for practice sheets and the plan
//   4. a targeted learner sees "Made for you" and opens it; a learner outside the group does not
// Usage: node scripts/smoke-platform.mjs [baseUrl] [screenshotDir]

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const [baseUrl = "http://localhost:3000", shots = "smoke-shots"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
mkdirSync(shots, { recursive: true });
const executablePath = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
  .filter(Boolean)
  .find((p) => existsSync(p));
if (!executablePath) throw new Error("No Chrome found; set CHROME_PATH");

const seed = execFileSync("node", [path.join("scripts", "seed-demo.mjs"), baseUrl]).toString();
const seatLink = seed.match(/(\S+#seat=\S+)/)[1];
const code = JSON.parse(decodeURIComponent(seatLink.split("#seat=")[1])).code;
console.log(`seeded class ${code}`);

const browser = await chromium.launch({ executablePath, headless: true });
let failed = false;
const problems = [];
function check(ok, label) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed = true;
}
const visible = (locator, timeout) => locator.first().waitFor({ timeout }).then(() => true, () => false);
function watch(page) {
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("response", (r) => r.status() >= 500 && problems.push(`HTTP ${r.status()} ${r.url()}`));
}

try {
  const teacher = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  watch(teacher);
  await teacher.goto(seatLink, { waitUntil: "domcontentloaded" });
  await teacher.waitForURL(new RegExp(`/teacher/${code}$`), { timeout: 30_000 });
  check(await visible(teacher.getByText("Plan tomorrow with the co-pilot"), 20_000), "the seat link opens the dashboard with the co-pilot");

  // Create with A-Note
  await teacher.getByRole("button", { name: "+ Assign a worksheet" }).click();
  await teacher.getByPlaceholder(/two-step equations/).fill("Area and perimeter of rectangles in a school garden");
  await teacher.getByRole("button", { name: "Write it" }).click();
  check(await visible(teacher.getByText(/Muse Spark is writing/), 10_000), "progress streams while A-Note writes");
  check(await visible(teacher.getByText(/answers confirmed by an independent Muse Wonder solve/), 150_000), "the draft comes back with a verified key");
  await teacher.screenshot({ path: path.join(shots, "platform-1-draft.png") });
  await teacher.getByRole("button", { name: "Assign to class" }).click();
  check(await visible(teacher.getByText("Written by A-Note"), 10_000), "the new worksheet is assigned and labelled");

  // Back to the seeded worksheet and run the co-pilot
  await teacher.getByRole("button", { name: /Worksheet 3 · Linear/ }).click();
  await teacher.getByRole("button", { name: "Run the co-pilot" }).click();
  check(await visible(teacher.getByText("Read the class"), 30_000), "the co-pilot reads the class");
  check(await visible(teacher.getByText(/Muse Wonder verified/), 180_000), "Muse Wonder verifies the practice it writes");
  check(await visible(teacher.getByText("Exit ticket"), 240_000), "the co-pilot finishes with a plan");
  await teacher.screenshot({ path: path.join(shots, "platform-2-copilot.png"), fullPage: true });

  // Learners: the co-pilot targets groups, so check who sees "Made for you"
  const dash = await teacher.evaluate(async (c) => {
    const seat = JSON.parse(localStorage.getItem("a-note:teacher"))[0];
    return (await fetch(`/api/classes/${c}/dashboard`, { headers: { "x-teacher-key": seat.teacherKey } })).json();
  }, code);
  const targeted = dash.assignments.filter((a) => a.origin === "copilot");
  check(targeted.length > 0, `the co-pilot assigned ${targeted.length} practice sheets`);
  const insider = dash.students.find((s) => targeted[0]?.studentIds.includes(s.id));
  const outsider = dash.students.find((s) => !targeted.some((a) => a.studentIds.includes(s.id)));

  for (const [who, expect] of [
    [insider, true],
    [outsider, false],
  ]) {
    if (!who) continue;
    const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
    const learner = await ctx.newPage();
    watch(learner);
    await learner.goto(`${baseUrl}/join?code=${code}`, { waitUntil: "domcontentloaded" });
    await learner.getByPlaceholder(/name/i).fill(who.name);
    await learner.getByRole("button", { name: /join/i }).click();
    await learner.waitForURL(new RegExp(`/class/${code}$`), { timeout: 20_000 });
    const sees = await visible(learner.getByText("Made for you"), 10_000);
    check(sees === expect, `${who.name} ${expect ? "sees" : "does not see"} "Made for you"`);
    if (expect && sees) {
      await learner.screenshot({ path: path.join(shots, "platform-3-learner.png") });
      await learner.getByText("Start →").first().click();
      check(await visible(learner.getByRole("button", { name: "Check my work" }), 20_000), "the practice sheet opens on the worksheet");
    }
    await ctx.close();
  }
} finally {
  check(problems.length === 0, `no page errors${problems.length ? `:\n  ${problems.join("\n  ")}` : ""}`);
  await browser.close();
}
process.exit(failed ? 1 : 0);
