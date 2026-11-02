// Browser smoke test for PDF worksheets: makes a three-page PDF from the sample sheets, opens it on
// /study, circles an equation on page 2 (SAM + tutor see only that page), then a teacher assigns the
// same PDF to a seeded class. Calls the real models once.
// Usage: node scripts/smoke-pdf.mjs [baseUrl] [screenshotDir]

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const [baseUrl = "http://localhost:3000", shots = "smoke-shots"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
mkdirSync(shots, { recursive: true });
const executablePath = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
  .filter(Boolean)
  .find((p) => existsSync(p));

const browser = await chromium.launch({ executablePath, headless: true });
let failed = false;
const problems = [];
function check(ok, label) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed = true;
}
const visible = (locator, timeout) => locator.first().waitFor({ timeout }).then(() => true, () => false);

// A three-page A4 PDF: circuits, linear equations, mangrove reading.
const pdfPath = path.resolve(shots, "three-sheets.pdf");
{
  const page = await browser.newPage();
  const img = (name) => `<img src="${baseUrl}/sheets/${name}.svg" style="width:210mm;height:297mm;display:block;page-break-after:always">`;
  await page.setContent(`<html><body style="margin:0">${img("simple-circuits")}${img("linear-equations")}${img("mangrove-reading")}</body></html>`, { waitUntil: "networkidle" });
  writeFileSync(pdfPath, await page.pdf({ format: "A4", margin: { top: 0, right: 0, bottom: 0, left: 0 } }));
  await page.close();
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  let segmentSize = null;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/segment")) segmentSize = JSON.parse(r.postData() ?? "{}").size ?? null;
  });
  await page.goto(`${baseUrl}/study`, { waitUntil: "networkidle" });
  await page.locator('input[type="file"]').setInputFiles(pdfPath);
  check(await visible(page.getByText("three-sheets"), 30_000), "the PDF opens as a worksheet");
  const canvas = page.locator("canvas").last();
  await canvas.waitFor();
  let box = await canvas.boundingBox();
  check(box.height / box.width > 3.9, `all three pages are on the sheet (${Math.round(box.height / box.width * 100) / 100} : 1)`);

  // Scroll page 2's first equation into view and circle it.
  const ratio = box.width / 1240;
  const pageHeight = 1754;
  const top2 = pageHeight + 28;
  await page.evaluate((y) => document.querySelector(".overflow-auto.bg-slate-100")?.scrollTo(0, y), (top2 + 300) * ratio);
  await page.waitForTimeout(300);
  box = await canvas.boundingBox();
  const s = box.width / 1240;
  const [cx, cy, rx, ry] = [box.x + 285 * s, box.y + (top2 + 432) * s, 165 * s, 48 * s];
  await page.mouse.move(cx + rx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 48; i++) await page.mouse.move(cx + rx * Math.cos((i / 48) * 2 * Math.PI * 1.05), cy + ry * Math.sin((i / 48) * 2 * Math.PI * 1.05));
  await page.mouse.up();
  await page.getByRole("button", { name: "Ask here" }).click();
  check(await visible(page.getByText(/^Hint 1 of \d/), 60_000), "the tutor answers about the circle on page 2");
  check(segmentSize && segmentSize.height < 2000, `SAM gets only that page (${segmentSize?.width}×${segmentSize?.height})`);
  check(await visible(page.getByText(/3x \+ 7 = 22|3x\+7=22/), 5_000), "the tutor read the right equation");
  await page.screenshot({ path: path.join(shots, "pdf-study.png") });
  await page.close();

  // Teacher assigns the PDF
  const seed = execFileSync("node", [path.join("scripts", "seed-demo.mjs"), baseUrl]).toString();
  const seatLink = seed.match(/(\S+#seat=\S+)/)[1];
  const teacher = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  teacher.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  await teacher.goto(seatLink, { waitUntil: "domcontentloaded" });
  await teacher.getByRole("button", { name: "+ Assign a worksheet" }).waitFor({ timeout: 30_000 });
  await teacher.getByRole("button", { name: "+ Assign a worksheet" }).click();
  await teacher.locator('[role=dialog] input[type="file"]').setInputFiles(pdfPath);
  check(await visible(teacher.getByRole("heading", { name: "three-sheets" }), 60_000), "a teacher assigns the PDF to the class");
} finally {
  check(problems.length === 0, `no page errors${problems.length ? `:\n  ${problems.join("\n  ")}` : ""}`);
  await browser.close();
}
process.exit(failed ? 1 : 0);
