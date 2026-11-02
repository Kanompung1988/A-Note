// Browser smoke test for managing a class (no model calls): rename, export results as CSV, a learner's
// progress with the skills to practise, removing a learner, deleting the class.
// Usage: node scripts/smoke-manage.mjs [baseUrl] [screenshotDir]

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const [baseUrl = "http://localhost:3000", shots = "smoke-shots"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
mkdirSync(shots, { recursive: true });
const executablePath = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
  .filter(Boolean)
  .find((p) => existsSync(p));

const seed = execFileSync("node", [path.join("scripts", "seed-demo.mjs"), baseUrl]).toString();
const seatLink = seed.match(/(\S+#seat=\S+)/)[1];
const { code } = JSON.parse(decodeURIComponent(seatLink.split("#seat=")[1]));

const browser = await chromium.launch({ executablePath, headless: true });
let failed = false;
const problems = [];
function check(ok, label) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed = true;
}
const visible = (locator, timeout) => locator.first().waitFor({ timeout }).then(() => true, () => false);

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, acceptDownloads: true });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("dialog", (d) => void d.accept(d.type() === "prompt" ? code : undefined));
  await page.goto(seatLink, { waitUntil: "domcontentloaded" });
  await page.waitForURL(new RegExp(`/teacher/${code}$`));
  await page.getByRole("button", { name: "Class settings" }).waitFor({ timeout: 30_000 });

  // rename
  await page.getByRole("button", { name: "Class settings" }).click();
  await page.getByRole("menuitem", { name: "Rename class" }).click();
  await page.getByRole("dialog").getByLabel("Class name").fill("Grade 7/3 · Algebra");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  check(await visible(page.getByText("Grade 7/3 · Algebra"), 10_000), "the class is renamed");

  // export
  await page.getByRole("button", { name: "Class settings" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Export results (CSV)" }).click();
  const file = path.join(shots, "results.csv");
  await (await download).saveAs(file);
  const lines = readFileSync(file, "utf8").replace(/^\ufeff/, "").trim().split(/\r\n/);
  check(lines[0].startsWith("Learner,Worksheet,Status") && lines.length === 11, `the CSV has a header and a row per learner (${lines.length - 1})`);
  check(lines.some((l) => l.startsWith("Nina,") && l.includes(",1,0,4,0,1,")), "Nina's row has her asks, hints and slip");

  // progress
  await page.getByRole("button", { name: "Nina", exact: true }).click();
  check(await visible(page.getByText("To practise next"), 5_000), "a learner's progress opens");
  check(await page.getByRole("dialog").getByText("equations with brackets").first().isVisible(), "it names the skill to practise from the answer key");
  await page.screenshot({ path: path.join(shots, "progress.png") });
  await page.getByRole("button", { name: "Page", exact: true }).first().click();
  check(await visible(page.getByLabel("Note to Nina"), 5_000), "Page opens her worksheet");
  await page.keyboard.press("Escape");

  // remove a learner
  await page.getByRole("button", { name: "Pim", exact: true }).click();
  await page.getByRole("button", { name: "Remove from class" }).click();
  await page.waitForTimeout(1500);
  check((await page.getByRole("button", { name: "Pim", exact: true }).count()) === 0, "a learner can be removed");

  // delete the class
  await page.getByRole("button", { name: "Class settings" }).click();
  await page.getByRole("menuitem", { name: "Delete class" }).click();
  await page.waitForURL(`${baseUrl}/teacher`, { timeout: 15_000 });
  const gone = await fetch(`${baseUrl}/api/classes/${code}`);
  check(gone.status === 404, "deleting the class removes it");
} finally {
  check(problems.length === 0, `no page errors${problems.length ? `:\n  ${problems.join("\n  ")}` : ""}`);
  await browser.close();
}
process.exit(failed ? 1 : 0);
