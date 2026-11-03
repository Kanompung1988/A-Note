// Records the demo video's app takes from the live site with the real models, in story order:
// a seeded class → the teacher creates a worksheet → Mint circles, checks and hands in → the teacher's
// dashboard → the co-pilot → "Made for you" → board tools, a PDF, a learner's progress.
// Takes land in video-out/takes/<name>/ (frames + marks); compose.mjs cuts them to the voiceover.
// A model call can fail now and then: --from <take> carries on with the same class (video-out/class.json).
// Usage: node scripts/video/record.mjs [baseUrl] [--from create|ask|check|dashboard|copilot|foryou|montage]

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { write } from "../handwriting.mjs";
import { human, launch, newContext, scrollTo, scrollToElement, settle, sleep, startTake } from "./recorder.mjs";

const args = process.argv.slice(2);
const baseUrl = args.find((a) => a.startsWith("http")) ?? "https://a-note-five.vercel.app";
const from = args.includes("--from") ? args[args.indexOf("--from") + 1] : "create";
const LEARNER = "Mint";
const STATE = path.join("video-out", "class.json");

let state;
if (from === "create") {
  const seed = execFileSync("node", [path.join("scripts", "seed-demo.mjs"), baseUrl]).toString();
  const seatLink = seed.match(/(\S+#seat=\S+)/)[1];
  state = { seatLink, code: JSON.parse(decodeURIComponent(seatLink.split("#seat=")[1])).code };
  mkdirSync("video-out", { recursive: true });
  writeFileSync(STATE, JSON.stringify(state));
  console.log(`seeded class ${state.code}`);
} else {
  state = JSON.parse(readFileSync(STATE, "utf8"));
  console.log(`carrying on from ${from} with class ${state.code}`);
}
const { code, seatLink } = state;

const browser = await launch();
/** Prints failed API calls, so a failed take says why. */
function watch(page) {
  page.on("response", async (r) => {
    if (r.status() >= 400 && r.url().includes("/api/")) console.log(`  HTTP ${r.status()} ${r.request().method()} ${r.url().split("/api/")[1]}: ${(await r.text().catch(() => "")).slice(0, 300)} ← ${(r.request().postData() ?? "").slice(0, 300)}`);
  });
  page.on("pageerror", (e) => console.log(`  pageerror: ${e.message}`));
}
const visible = (locator, timeout) => locator.first().waitFor({ timeout }).then(() => true, () => false);

async function joinAs(context, name) {
  const page = await context.newPage();
  watch(page);
  await page.goto(`${baseUrl}/join?code=${code}`, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("First name is fine").fill(name);
  await page.getByRole("button", { name: "Join" }).click();
  await page.waitForURL(new RegExp(`/class/${code}$`));
  return page;
}

const teacherCtx = await newContext(browser);
const T = await teacherCtx.newPage();
watch(T);
T.on("dialog", (d) => void d.accept());
const t = human(T);
const learnerCtx = await newContext(browser);
const L = await joinAs(learnerCtx, LEARNER);
L.on("dialog", (d) => void d.accept());
const l = human(L);
const sheetCanvas = () => L.locator("canvas").last();

async function teacherDashboard() {
  await T.goto(seatLink, { waitUntil: "domcontentloaded" });
  await T.waitForURL(new RegExp(`/teacher/${code}$`), { timeout: 30_000 });
  await T.getByText("Plan tomorrow with the co-pilot").waitFor({ timeout: 30_000 });
  await T.getByRole("button", { name: /Worksheet 3 · Linear/ }).click();
  await settle(T);
  await scrollTo(T, 0, { wait: 400 });
}

async function openLinearSheet() {
  await L.goto(`${baseUrl}/class/${code}`, { waitUntil: "domcontentloaded" });
  await L.locator("a", { hasText: "Linear Equations" }).first().click();
  await L.getByRole("button", { name: /Hand(ed)? in/ }).waitFor({ timeout: 30_000 });
  await sheetCanvas().waitFor();
  await settle(L);
}

const TAKES = {
  // ── Teacher: create a worksheet in one line ─────────────────────────────────────
  async create() {
    await teacherDashboard();
    await t.show();
    const take = await startTake(T, "create");
    await sleep(900);
    await t.click(T.getByRole("button", { name: "+ Assign a worksheet" }));
    await sleep(800);
    await t.click(T.getByPlaceholder(/two-step equations/));
    await t.type("Two-step equations with market word problems");
    await sleep(500);
    await t.click(T.getByRole("button", { name: "Write it" }));
    take.mark("wait");
    await T.getByText(/answers confirmed by an independent Muse Wonder solve/).waitFor({ timeout: 240_000 });
    await settle(T);
    take.mark("ready");
    await sleep(1200);
    await t.hover(T.getByText(/answers confirmed by an independent Muse Wonder solve/), 700);
    await sleep(1500);
    await t.hover(T.getByText(/Answer key/i), 600);
    await sleep(1400);
    await t.click(T.getByRole("button", { name: "Assign to class" }));
    await T.getByText("Written by A-Note").first().waitFor({ timeout: 20_000 });
    await sleep(2000);
    await take.stop();
  },

  // ── Learner: circle to ask ───────────────────────────────────────────────────────
  async ask() {
    // a clean page, in case an earlier attempt left a circle on it
    await openLinearSheet();
    const clear = L.getByRole("button", { name: "Clear page" });
    if (await clear.isEnabled()) await clear.click();
    await L.goto(`${baseUrl}/class/${code}`, { waitUntil: "domcontentloaded" });
    await L.getByText("Linear Equations").first().waitFor({ timeout: 20_000 });
    await settle(L);
    await l.show();
    const take = await startTake(L, "ask");
    await sleep(1000);
    await l.click(L.locator("a", { hasText: "Linear Equations" }).first());
    await L.getByRole("button", { name: /Hand(ed)? in/ }).waitFor({ timeout: 30_000 });
    await sheetCanvas().waitFor();
    await settle(L);
    await sleep(700);
    // question 2: 5(x − 2) = 3x + 4
    await l.loop(sheetCanvas(), 340, 586, 220, 52);
    await sleep(350);
    await l.click(L.getByRole("button", { name: "Ask here" }));
    take.mark("wait1");
    await L.locator('svg path[fill="#fb923c"]').first().waitFor({ timeout: 90_000 });
    await L.getByText(/^Hint 1 of \d/).first().waitFor({ timeout: 90_000 });
    await sleep(500);
    take.mark("hint");
    await sleep(2600);
    await l.click(L.getByPlaceholder("Type or say your answer…"));
    await l.type("can you just tell me the answer?", 38);
    await sleep(300);
    await L.keyboard.press("Enter");
    take.mark("wait2");
    const reply = L.locator("p.rounded-bl-sm");
    const failed = L.getByText("That didn't send");
    await Promise.race([reply.first().waitFor({ timeout: 90_000 }), failed.waitFor({ timeout: 90_000 })]);
    if (await failed.isVisible()) throw new Error("the tutor reply failed; run again with --from ask");
    await sleep(400);
    take.mark("reply");
    await sleep(3200);
    const showMe = L.getByRole("button", { name: "Show me a picture" });
    if (await showMe.isVisible()) {
      await l.click(showMe);
      take.mark("wait3");
      await L.getByAltText("A picture of the idea").waitFor({ timeout: 90_000 });
      await settle(L);
      await L.getByAltText("A picture of the idea").evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center" }));
      take.mark("picture");
      await sleep(3200);
    } else {
      console.log("  (no picture brief in the hints; skipped Show me)");
    }
    await take.stop();
  },

  // ── Learner: check my work, fix it, hand in ──────────────────────────────────────
  async check() {
    if (from === "check") await openLinearSheet();
    const take = await startTake(L, "check");
    await sleep(500);
    const close = L.getByRole("button", { name: "Close" });
    if (await close.isVisible()) {
      await l.click(close);
      await sleep(800);
    }
    await l.write([...write("5x - 2 = 3x + 4", 600, 557, 32), ...write("2x = 6", 600, 603, 32), ...write("x = 3", 600, 649, 32)], sheetCanvas());
    take.mark("written");
    await sleep(400);
    await l.click(L.getByRole("button", { name: "Check my work" }));
    take.mark("wait1");
    await L.getByRole("button", { name: /Ask about line/ }).waitFor({ timeout: 90_000 });
    await sleep(1200);
    take.mark("result");
    await sleep(3400);
    // fix it: erase the three lines, write them again
    await l.click(L.getByRole("button", { name: "Eraser (E)", exact: true }));
    await l.drag(sheetCanvas(), [[585, 575], [1010, 575], [585, 620], [1010, 620], [585, 666], [900, 666]], 4);
    await sleep(300);
    await l.click(L.getByRole("button", { name: "Pen (P)", exact: true }));
    await l.write([...write("5x - 10 = 3x + 4", 600, 557, 32), ...write("2x = 14", 600, 603, 32), ...write("x = 7", 600, 649, 32)], sheetCanvas());
    take.mark("rewritten");
    await sleep(300);
    await l.click(L.getByRole("button", { name: "Check again" }));
    take.mark("wait2");
    await L.locator('svg path[stroke="#16a34a"]').first().waitFor({ timeout: 90_000 });
    await sleep(900);
    take.mark("ticks");
    await sleep(2000);
    await l.click(L.getByRole("button", { name: /^Hand in/ }));
    await L.getByRole("button", { name: "Handed in ✓" }).waitFor({ timeout: 20_000 });
    await sleep(1800);
    await take.stop();
  },

  // ── Teacher: the live dashboard, Mint's page, a note back ───────────────────────
  async dashboard() {
    await teacherDashboard();
    await t.show();
    const take = await startTake(T, "dashboard");
    await sleep(800);
    await scrollToElement(T.getByText("Why are they stuck?"), "center", 1100);
    await t.click(T.getByText(/brackets|parenthes|distribut/i).first());
    await sleep(2200);
    await scrollToElement(T.getByText("Tap a name for their progress"), "start", 1100);
    await t.click(T.getByRole("button", { name: "Handed in ✓" }));
    await T.getByLabel(`Note to ${LEARNER}`).waitFor({ timeout: 10_000 });
    await settle(T);
    await sleep(2600);
    await t.click(T.getByLabel(`Note to ${LEARNER}`));
    await t.type("Great fix on the brackets! Try the practice next.", 26);
    await t.click(T.getByRole("button", { name: /Send note|Update note/ }));
    await T.getByRole("button", { name: "Sent ✓" }).waitFor({ timeout: 10_000 });
    await sleep(1600);
    await take.stop();
    await T.keyboard.press("Escape");
    await sleep(500);
  },

  // ── Teacher: the co-pilot ───────────────────────────────────────────────────────
  async copilot() {
    if (from === "copilot") await teacherDashboard();
    await scrollTo(T, 0, { wait: 600 });
    await t.show();
    const take = await startTake(T, "copilot");
    await sleep(700);
    await t.click(T.getByRole("button", { name: /Run the co-pilot|Run again/ }));
    take.mark("wait");
    const panel = T.locator("div.rounded-3xl.bg-slate-900").first();
    await T.getByText("Read the class").first().waitFor({ timeout: 60_000 });
    const deadline = Date.now() + 300_000;
    while (!(await T.getByRole("button", { name: "Run again" }).isVisible())) {
      if (Date.now() > deadline) throw new Error("the co-pilot did not finish; run again with --from copilot");
      // follow the trace as it grows
      await T.evaluate(() => {
        const items = document.querySelectorAll("div.rounded-3xl.bg-slate-900 ol > li");
        const last = items[items.length - 1];
        if (last && last.getBoundingClientRect().bottom > innerHeight - 60) scrollBy({ top: last.getBoundingClientRect().bottom - innerHeight + 140, behavior: "smooth" });
      });
      await sleep(1200);
    }
    if (!(await T.getByText("Exit ticket").isVisible())) throw new Error("the co-pilot finished without a plan; run again with --from copilot");
    await settle(T);
    take.mark("done");
    await panel.evaluate((el) => scrollTo({ top: el.getBoundingClientRect().top + scrollY - 80, behavior: "smooth" }));
    await sleep(1400);
    await t.hover(T.getByText("Practice it assigned"), 700);
    await sleep(2600);
    await T.evaluate(() => scrollBy({ top: 420, behavior: "smooth" }));
    await sleep(1200);
    await t.hover(T.getByText("Exit ticket"), 700);
    await sleep(2600);
    await take.stop();
  },

  // ── Learner: practice made for them ─────────────────────────────────────────────
  async foryou() {
    if (!T.url().includes(`/teacher/${code}`)) await teacherDashboard();
    const dash = await T.evaluate(async (c) => {
      const seat = JSON.parse(localStorage.getItem("a-note:teacher")).find((s) => s.code === c);
      return (await fetch(`/api/classes/${c}/dashboard`, { headers: { "x-teacher-key": seat.teacherKey } })).json();
    }, code);
    const targeted = dash.assignments.filter((a) => a.origin === "copilot");
    const mint = dash.students.find((s) => s.name === LEARNER);
    const forMint = targeted.some((a) => a.studentIds.includes(mint?.id));
    const who = forMint ? LEARNER : dash.students.find((s) => targeted[0]?.studentIds.includes(s.id))?.name;
    console.log(`  co-pilot made ${targeted.length} sheets; "Made for you" shown as ${who}`);
    const P = forMint ? L : await joinAs(await newContext(browser), who);
    const p = forMint ? l : human(P);
    await P.goto(`${baseUrl}/class/${code}`, { waitUntil: "domcontentloaded" });
    await P.getByText("Made for you").waitFor({ timeout: 20_000 });
    await settle(P);
    await p.show();
    const take = await startTake(P, "foryou");
    await sleep(1600);
    await p.click(P.getByText("Start →").first());
    await P.getByRole("button", { name: "Check my work" }).waitFor({ timeout: 30_000 });
    await settle(P);
    await sleep(2200);
    await take.stop();
  },

  // ── Montage: board tools, a PDF, a learner's progress ───────────────────────────
  async montage() {
    const S = await (await newContext(browser)).newPage();
    const s = human(S);
    await S.goto(`${baseUrl}/study`, { waitUntil: "networkidle" });
    await S.evaluate(() => localStorage.clear());
    await S.reload({ waitUntil: "networkidle" });
    const board = S.locator("canvas").last();
    await board.waitFor();
    await settle(S);
    await s.show();
    const take = await startTake(S, "tools");
    await sleep(500);
    await s.click(S.getByRole("button", { name: "Highlighter (H)", exact: true }), { ms: 380 });
    await s.drag(board, [[175, 438], [520, 436]], 6);
    await s.click(S.getByRole("button", { name: "Shapes (S)", exact: true }), { ms: 380 });
    await s.click(S.getByRole("button", { name: "Arrow", exact: true }), { ms: 300 });
    await s.drag(board, [[560, 434], [700, 434]], 8);
    await s.click(S.getByRole("button", { name: "Text (T)", exact: true }), { ms: 380 });
    const box = await board.boundingBox();
    const k = box.width / 1240;
    await s.glide(box.x + 725 * k, box.y + 420 * k, 380);
    await S.mouse.down();
    await S.mouse.up();
    await S.getByLabel("Type on the page").waitFor();
    await s.type("subtract 7 first", 30);
    await S.keyboard.press("Enter");
    await sleep(300);
    await s.click(S.getByRole("button", { name: "Select and move (L)", exact: true }), { ms: 380 });
    await s.drag(board, [[545, 395], [1050, 395], [1050, 475], [545, 475], [545, 398]], 3);
    await sleep(250);
    await s.drag(board, [[800, 436], [800, 470]], 10);
    await sleep(500);
    await s.click(S.getByRole("button", { name: "Zoom in" }), { ms: 380 });
    await sleep(900);
    await take.stop();

    // a three-page PDF opened as one worksheet
    const pdf = path.resolve("video-out", "Week 9 homework pack.pdf");
    {
      const maker = await browser.newPage();
      const img = (name) => `<img src="${baseUrl}/sheets/${name}.svg" style="width:210mm;height:297mm;display:block;page-break-after:always">`;
      await maker.setContent(`<html><body style="margin:0">${img("linear-equations")}${img("simple-circuits")}${img("mangrove-reading")}</body></html>`, { waitUntil: "networkidle" });
      writeFileSync(pdf, await maker.pdf({ format: "A4", margin: { top: 0, right: 0, bottom: 0, left: 0 } }));
      await maker.close();
    }
    await S.evaluate(() => localStorage.clear());
    await S.reload({ waitUntil: "networkidle" });
    await settle(S);
    await s.show();
    const pdfTake = await startTake(S, "pdf");
    await sleep(500);
    const chooser = S.waitForEvent("filechooser");
    await s.click(S.getByRole("button", { name: /Open a photo/ }));
    await (await chooser).setFiles(pdf);
    await S.getByText("Week 9 homework pack").first().waitFor({ timeout: 30_000 });
    await settle(S);
    pdfTake.mark("open");
    await sleep(600);
    const sheetHeight = await S.locator("canvas").last().evaluate((c) => c.getBoundingClientRect().height);
    await scrollTo(S, sheetHeight * 0.36, { selector: ".overflow-auto.bg-slate-100", wait: 1300 });
    await scrollTo(S, sheetHeight * 0.7, { selector: ".overflow-auto.bg-slate-100", wait: 1300 });
    await pdfTake.stop();

    // the teacher: a learner's progress, then export
    await teacherDashboard();
    await scrollToElement(T.getByText("Tap a name for their progress"), "start", 900);
    await t.show();
    const progress = await startTake(T, "progress");
    await sleep(400);
    await t.click(T.getByRole("button", { name: "Nina", exact: true }));
    await T.getByText("To practise next").waitFor({ timeout: 10_000 });
    await sleep(2600);
    await T.keyboard.press("Escape");
    await sleep(500);
    await t.click(T.getByRole("button", { name: "Class settings" }));
    await sleep(500);
    const download = T.waitForEvent("download").catch(() => null);
    await t.click(T.getByRole("menuitem", { name: "Export results (CSV)" }));
    await download;
    await sleep(1200);
    await progress.stop();
  },
};

try {
  const order = Object.keys(TAKES);
  if (!order.includes(from)) throw new Error(`--from must be one of ${order.join(", ")}`);
  for (const name of order.slice(order.indexOf(from))) await TAKES[name]();
} finally {
  await browser.close();
}
