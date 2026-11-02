// Browser smoke test for handing work in (no model calls): a learner writes, it autosaves and is handed
// in; the teacher opens the learner's page, sends a note; the learner sees the note, and their page
// follows them to a second device.
// Usage: node scripts/smoke-handin.mjs [baseUrl] [screenshotDir]

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { write } from "./handwriting.mjs";

const [baseUrl = "http://localhost:3000", shots = "smoke-shots"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
mkdirSync(shots, { recursive: true });
const executablePath = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
  .filter(Boolean)
  .find((p) => existsSync(p));

const seed = execFileSync("node", [path.join("scripts", "seed-demo.mjs"), baseUrl]).toString();
const seatLink = seed.match(/(\S+#seat=\S+)/)[1];
const code = JSON.parse(decodeURIComponent(seatLink.split("#seat=")[1])).code;

const browser = await chromium.launch({ executablePath, headless: true });
let failed = false;
const problems = [];
function check(ok, label) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed = true;
}
const visible = (locator, timeout) => locator.first().waitFor({ timeout }).then(() => true, () => false);
const watch = (page) => {
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("response", (r) => r.status() >= 500 && problems.push(`HTTP ${r.status()} ${r.url()}`));
};

async function joinAs(context, name) {
  const page = await context.newPage();
  watch(page);
  await page.goto(`${baseUrl}/join?code=${code}`, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("First name is fine").fill(name);
  await page.getByRole("button", { name: "Join" }).click();
  await page.waitForURL(new RegExp(`/class/${code}$`));
  return page;
}

try {
  // Learner writes and hands in
  const tablet = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const kai = await joinAs(tablet, "Kai");
  await kai.getByText("Open →").first().click();
  await kai.getByRole("button", { name: "Hand in" }).waitFor({ timeout: 20_000 });
  const sheetKey = await kai.evaluate(() => location.pathname.split("/").pop());
  const strokes = [...write("5x - 10 = 3x + 4", 600, 557, 32), ...write("2x = 14", 600, 603, 32)];
  await kai.evaluate(([k, s]) => localStorage.setItem(`a-note:ink:assignment-${k}`, JSON.stringify(s)), [sheetKey, strokes]);
  await kai.reload({ waitUntil: "domcontentloaded" });
  await kai.getByRole("button", { name: "Hand in" }).waitFor({ timeout: 20_000 });
  // one more stroke by hand, so the autosave runs
  const canvas = kai.locator("canvas").last();
  const box = await canvas.boundingBox();
  const s = box.width / 1240;
  await kai.mouse.move(box.x + 600 * s, box.y + 660 * s);
  await kai.mouse.down();
  await kai.mouse.move(box.x + 660 * s, box.y + 662 * s, { steps: 8 });
  await kai.mouse.up();
  check(await visible(kai.getByText("Saved"), 10_000), "the page autosaves");
  await kai.getByRole("button", { name: "Hand in" }).click();
  check(await visible(kai.getByRole("button", { name: "Handed in ✓" }), 10_000), "Hand in marks it handed in");

  // Teacher sees it and sends a note
  const teacher = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  watch(teacher);
  await teacher.goto(seatLink, { waitUntil: "domcontentloaded" });
  await teacher.waitForURL(new RegExp(`/teacher/${code}$`));
  check(await visible(teacher.getByText(/Handed in 1\/\d+/), 20_000), "the dashboard counts the hand-in");
  await teacher.getByRole("button", { name: "Handed in ✓" }).first().click();
  check(await visible(teacher.getByText("Kai", { exact: true }), 5_000), "the teacher opens Kai's page");
  await teacher.waitForTimeout(1500);
  const inkPixels = await teacher.evaluate(() => {
    const c = [...document.querySelectorAll("[role=dialog] canvas")][0];
    if (!c) return 0;
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  });
  check(inkPixels > 500, `Kai's ink is drawn on the teacher's copy (${inkPixels} px)`);
  await teacher.screenshot({ path: path.join(shots, "handin-teacher.png") });
  await teacher.getByLabel("Note to Kai").fill("Nice: you expanded the brackets correctly. Finish the last step.");
  await teacher.getByRole("button", { name: "Send note" }).click();
  check(await visible(teacher.getByRole("button", { name: "Sent ✓" }), 10_000), "the note is sent");

  // Kai sees the note
  await kai.reload({ waitUntil: "domcontentloaded" });
  check(await visible(kai.getByText(/Note from Kru Ploy/), 20_000), "Kai sees the teacher's note on the worksheet");

  // Kai on another device: the page follows
  const laptop = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const kai2 = await joinAs(laptop, "Kai");
  check(await visible(kai2.getByText("Handed in ✓"), 10_000), "the class page shows it handed in");
  await kai2.getByText("Continue →").first().click();
  await kai2.getByRole("button", { name: /Handed in|Hand in/ }).waitFor({ timeout: 20_000 });
  await kai2.waitForTimeout(800);
  const restored = await kai2.evaluate((k) => JSON.parse(localStorage.getItem(`a-note:ink:assignment-${k}`) ?? "[]").length, sheetKey);
  check(restored === strokes.length + 1, `the page follows Kai to a second device (${restored} strokes)`);
} finally {
  check(problems.length === 0, `no page errors${problems.length ? `:\n  ${problems.join("\n  ")}` : ""}`);
  await browser.close();
}
process.exit(failed ? 1 : 0);
