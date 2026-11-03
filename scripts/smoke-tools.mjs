// Browser smoke test for the board tools on /study (no model calls): pen sizes, shapes, typed text,
// undo/redo, lasso select + duplicate + delete, eraser, zoom and tool shortcuts.
// Usage: node scripts/smoke-tools.mjs [baseUrl] [screenshotDir]

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { write } from "./handwriting.mjs";

const [baseUrl = "http://localhost:3000", shots = "smoke-shots"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
mkdirSync(shots, { recursive: true });
const executablePath = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
  .filter(Boolean)
  .find((p) => existsSync(p));

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));

let failed = false;
function check(ok, label) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed = true;
}
const ink = () => page.evaluate(() => JSON.parse(localStorage.getItem("a-note:ink:linear-equations") ?? "[]"));
const tool = (name) => page.getByRole("button", { name, exact: true }).click();

try {
  await page.goto(`${baseUrl}/study`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  const canvas = page.locator("canvas").last();
  await canvas.waitFor();
  let box = await canvas.boundingBox();
  let s = box.width / 1240;
  const at = (x, y) => [box.x + x * s, box.y + y * s];
  async function drag(from, to, steps = 12) {
    await page.mouse.move(...at(...from));
    await page.mouse.down();
    await page.mouse.move(...at(...to), { steps });
    await page.mouse.up();
  }

  // bold pen
  await tool("Bold line");
  await drag([600, 420], [800, 430]);
  let strokes = await ink();
  check(strokes.length === 1 && strokes[0].size > 1240 * 0.005, "the bold pen draws a thick stroke");

  // shapes
  await tool("Shapes (S)");
  await tool("Rectangle");
  await drag([600, 560], [900, 640]);
  strokes = await ink();
  check(strokes.at(-1)?.shape === "rect" && strokes.at(-1).points.length === 5, "the shape tool draws a rectangle");
  await tool("Arrow");
  await drag([950, 600], [1100, 600]);
  check((await ink()).at(-1)?.shape === "arrow", "and an arrow");

  // typed text
  await tool("Text (T)");
  await page.mouse.click(...at(560, 900));
  await page.getByLabel("Type on the page").fill("3x = 15");
  await page.keyboard.press("Enter");
  strokes = await ink();
  const text = strokes.find((st) => st.tool === "text");
  check(text?.text === "3x = 15" && text.points.length === 2, "the text tool places typed text on the page");

  // undo / redo
  await page.getByRole("button", { name: "Undo (Ctrl+Z)" }).click();
  check(!(await ink()).some((st) => st.tool === "text"), "undo removes the text");
  await page.keyboard.press("Control+Shift+Z");
  check((await ink()).some((st) => st.tool === "text"), "Ctrl+Shift+Z brings it back");

  // edit text in place
  await tool("Text (T)");
  await page.mouse.click(...at(text.points[0].x + 10, text.points[0].y + 10));
  await page.getByLabel("Type on the page").fill("3x = 15 so x = 5");
  await page.keyboard.press("Enter");
  check((await ink()).filter((st) => st.tool === "text").map((st) => st.text).join() === "3x = 15 so x = 5", "clicking text edits it");

  // lasso: select the rectangle, duplicate, delete
  await page.keyboard.press("l");
  check((await page.getByRole("button", { name: "Select and move (L)" }).getAttribute("aria-pressed")) === "true", "the L key picks the lasso");
  const before = (await ink()).length;
  await page.mouse.move(...at(570, 540));
  await page.mouse.down();
  for (const [x, y] of [[930, 540], [930, 660], [570, 660], [570, 545]]) await page.mouse.move(...at(x, y), { steps: 6 });
  await page.mouse.up();
  check(await page.getByText("1 selected · drag to move").isVisible(), "the lasso selects the rectangle");
  await drag([750, 600], [750, 700]);
  const moved = (await ink()).find((st) => st.shape === "rect");
  check(Math.round(moved.points[0].y) === 660, "dragging the selection moves it");
  await page.getByRole("button", { name: "Duplicate" }).click();
  check((await ink()).length === before + 1, "duplicate copies it");
  await page.keyboard.press("Delete");
  check((await ink()).length === before, "Delete removes the selection");

  // eraser on the arrow
  await tool("Eraser (E)");
  await drag([1000, 590], [1000, 610], 4);
  check(!(await ink()).some((st) => st.shape === "arrow"), "the eraser removes the arrow");

  // zoom
  const w1 = (await canvas.boundingBox()).width;
  await page.getByRole("button", { name: "Zoom in" }).click();
  const w2 = (await canvas.boundingBox()).width;
  check(w2 > w1 * 1.2, `zoom in widens the page (${Math.round(w1)} → ${Math.round(w2)}px)`);
  await page.getByRole("button", { name: "125%" }).click();
  check(Math.round((await canvas.boundingBox()).width) === Math.round(w1), "the zoom label fits the page again");

  // pen still draws after zooming back
  box = await canvas.boundingBox();
  s = box.width / 1240;
  await tool("Pen (P)");
  await drag([600, 330], [700, 340]);
  const after = await ink();
  check(after.length === before && after.at(-1).tool === "pen" && !after.at(-1).shape, `the pen draws after zooming (${after.map((st) => st.shape ?? st.tool).join(", ")})`);
  await page.screenshot({ path: path.join(shots, "tools.png") });

  // a laptop-width screen with the check panel open (a stubbed check, so no model call): the toolbar
  // scrolls instead of pushing the page under the panel, and switching tools does not move the page
  const narrow = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  narrow.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  await narrow.route("**/api/check", (r) =>
    r.fulfill({ json: { grounded: false, check: { question: "3x + 7 = 22", lines: [{ n: 1, read: "3x = 22 + 7", ok: false }], first_slip: 1, slip: "7 was added", hint: "Undo + 7", all_correct: false, praise: "" } } }),
  );
  await narrow.goto(`${baseUrl}/study`, { waitUntil: "networkidle" });
  const lines = [...write("3x = 22 + 7", 560, 405, 34), ...write("3x = 29", 560, 452, 34), ...write("x = 29/3", 560, 499, 34)];
  await narrow.evaluate((st) => localStorage.setItem("a-note:ink:linear-equations", JSON.stringify(st)), lines);
  await narrow.reload({ waitUntil: "networkidle" });
  await narrow.getByRole("button", { name: "Check my work" }).click();
  await narrow.getByRole("button", { name: "Check again" }).waitFor();
  const panelWidth = await narrow.getByRole("button", { name: "Check again" }).evaluate((el) => el.closest("aside")?.getBoundingClientRect().width ?? 0);
  const page1 = await narrow.locator("canvas").last().boundingBox();
  await narrow.getByRole("button", { name: "Eraser (E)", exact: true }).click();
  const page2 = await narrow.locator("canvas").last().boundingBox();
  check(Math.round(panelWidth) === 400 && Math.round(page1.width) === Math.round(page2.width), `with the panel open the page keeps its size across tools (panel ${Math.round(panelWidth)} px, page ${Math.round(page1.width)} → ${Math.round(page2.width)} px)`);
  const k = page2.width / 1240;
  const sweep = [422, 469, 516].flatMap((y, row) => Array.from({ length: 120 }, (_, i) => [page2.x + (row % 2 ? 905 - i * 3 : 545 + i * 3) * k, page2.y + y * k]));
  await narrow.mouse.move(...sweep[0]);
  await narrow.mouse.down();
  for (const p of sweep) await narrow.mouse.move(...p);
  await narrow.mouse.up();
  const left = await narrow.evaluate(() => JSON.parse(localStorage.getItem("a-note:ink:linear-equations") ?? "[]").length);
  check(left === 0, `an eraser swipe clears all three lines (${left} of ${lines.length} strokes left)`);
} finally {
  check(problems.length === 0, `no page errors${problems.length ? `:\n  ${problems.join("\n  ")}` : ""}`);
  await browser.close();
}
process.exit(failed ? 1 : 0);
