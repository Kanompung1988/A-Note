// Recording helpers for the demo video. A "take" is a Chrome screencast of one page (1080p JPEG frames
// with timestamps) plus named marks; compose.mjs cuts takes together. `human()` moves the mouse like a
// person: eased glides, clicks with a ripple, handwriting from the test font, smooth scrolls. Headless
// Chrome draws no cursor, so every page gets a fake one.

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

// The app is recorded 1:1 and framed inside the 1920×1080 video; title cards fill the frame.
export const VIEWPORT = { width: 1600, height: 900 };
export const FULL_FRAME = { width: 1920, height: 1080 };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CURSOR = `(() => {
  if (window.top !== window) return;
  const arrow = '<svg width="30" height="30" viewBox="0 0 30 30"><path d="M3 2 L3 24 L9 18.5 L13 27 L17 25.2 L13 17 L21 17 Z" fill="#0f172a" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>';
  const pen = '<svg width="34" height="34" viewBox="0 0 34 34"><g stroke="white" stroke-width="1.6" stroke-linejoin="round"><path d="M2 2 L9 5 L30 26 L26 30 L5 9 Z" fill="#f97316"/><path d="M2 2 L9 5 L5 9 Z" fill="#0f172a"/></g></svg>';
  let el, mode = "", last = null;
  function ensure() {
    if (el && el.isConnected) return;
    el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = "position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;will-change:transform;transform:translate(-100px,-100px)";
    document.documentElement.appendChild(el);
    mode = "";
    if (last) place(last);
  }
  function place(e) {
    ensure();
    const want = e.target instanceof HTMLCanvasElement ? "pen" : "arrow";
    if (want !== mode) { el.innerHTML = want === "pen" ? pen : arrow; mode = want; }
    el.style.transform = "translate(" + (e.clientX - 2) + "px," + (e.clientY - 2) + "px)";
  }
  addEventListener("pointermove", (e) => { last = { clientX: e.clientX, clientY: e.clientY, target: e.target }; place(last); }, true);
  addEventListener("pointerdown", (e) => {
    if (e.target instanceof HTMLCanvasElement) return;
    const r = document.createElement("div");
    r.style.cssText = "position:fixed;z-index:2147483646;pointer-events:none;width:44px;height:44px;border-radius:50%;border:3px solid rgba(249,115,22,.85);background:rgba(249,115,22,.18);left:" + (e.clientX - 22) + "px;top:" + (e.clientY - 22) + "px;transition:transform .45s ease-out,opacity .45s ease-out;transform:scale(.3);opacity:1";
    document.documentElement.appendChild(r);
    requestAnimationFrame(() => requestAnimationFrame(() => { r.style.transform = "scale(1.4)"; r.style.opacity = "0"; }));
    setTimeout(() => r.remove(), 600);
  }, true);
  setInterval(ensure, 400);
})();`;

export async function launch() {
  const executablePath = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(
    (p) => p && existsSync(p),
  );
  return chromium.launch({ executablePath, headless: true, args: ["--hide-scrollbars"] });
}

export async function newContext(browser, viewport = VIEWPORT) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(CURSOR);
  return context;
}

/** Starts a screencast take of `page` into video-out/takes/<name>. */
export async function startTake(page, name) {
  const dir = path.join("video-out", "takes", name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(path.join(dir, "frames"), { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  const marks = {};
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    const file = `${String(frames.length).padStart(6, "0")}.jpg`;
    writeFileSync(path.join(dir, "frames", file), Buffer.from(data, "base64"));
    frames.push({ file, t: metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  const started = Date.now();
  const take = {
    mark(label) {
      marks[label] = Date.now() / 1000;
      console.log(`  ${name} · ${label} at ${((Date.now() - started) / 1000).toFixed(1)} s`);
    },
    async stop() {
      take.mark("end");
      await sleep(250);
      await cdp.send("Page.stopScreencast").catch(() => {});
      writeFileSync(path.join(dir, "take.json"), JSON.stringify({ frames, marks }));
      await cdp.detach().catch(() => {});
      console.log(`  ${name}: ${frames.length} frames`);
    },
  };
  // the screencast sends its first frame on the next paint; nudge one so the take starts on a picture
  await page.evaluate(() => document.documentElement.animate([{ opacity: 1 }, { opacity: 0.999 }], 50)).catch(() => {});
  await sleep(150);
  take.mark("start");
  return take;
}

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Person-like input on one page. */
export function human(page) {
  let pos = { x: VIEWPORT.width * 0.62, y: VIEWPORT.height * 0.55 };

  async function glide(x, y, ms = 520) {
    const from = { ...pos };
    const steps = Math.max(10, Math.round(ms / 14));
    for (let i = 1; i <= steps; i++) {
      const k = ease(i / steps);
      await page.mouse.move(from.x + (x - from.x) * k, from.y + (y - from.y) * k);
      await sleep(ms / steps / 2);
    }
    pos = { x, y };
  }

  async function centre(locator) {
    const el = locator.first();
    await el.waitFor({ timeout: 30_000 });
    await el.scrollIntoViewIfNeeded();
    const b = await el.boundingBox();
    return [b.x + b.width / 2, b.y + b.height / 2];
  }

  return {
    glide,
    async show() {
      await page.mouse.move(pos.x, pos.y);
    },
    async click(locator, { ms = 520, pause = 160 } = {}) {
      const [x, y] = await centre(locator);
      await glide(x, y, ms);
      await sleep(pause);
      await page.mouse.down();
      await sleep(60);
      await page.mouse.up();
    },
    async hover(locator, ms = 520) {
      const [x, y] = await centre(locator);
      await glide(x, y, ms);
    },
    async type(text, delay = 42) {
      for (const ch of text) {
        await page.keyboard.type(ch);
        await sleep(delay * (0.6 + Math.random() * 0.8));
      }
    },
    /** A stroke through screen points; `gap` ms between points. */
    async stroke(points, gap = 2) {
      await glide(points[0].x, points[0].y, 160);
      await page.mouse.down();
      for (const p of points.slice(1)) {
        await page.mouse.move(p.x, p.y);
        if (gap) await sleep(gap);
      }
      await page.mouse.up();
      pos = { ...points.at(-1) };
    },
    /** Writes test-font strokes (sheet coordinates) onto the canvas on screen. */
    async write(strokes, canvas, sheetWidth = 1240) {
      const box = await canvas.boundingBox();
      const s = box.width / sheetWidth;
      for (const st of strokes) {
        const points = st.points.map((p) => ({ x: box.x + p.x * s, y: box.y + p.y * s }));
        await this.stroke(points, 1);
        await sleep(12);
      }
    },
    /** A hand-drawn loop around (cx, cy) in sheet coordinates. */
    async loop(canvas, cx, cy, rx, ry, sheetWidth = 1240) {
      const box = await canvas.boundingBox();
      const s = box.width / sheetWidth;
      const points = [];
      for (let i = 0; i <= 56; i++) {
        const a = -0.3 + (i / 56) * 2 * Math.PI * 1.08;
        const wobble = 1 + Math.sin(i * 0.7) * 0.025;
        points.push({ x: box.x + (cx + rx * wobble * Math.cos(a)) * s, y: box.y + (cy + ry * wobble * Math.sin(a)) * s });
      }
      await this.stroke(points, 9);
    },
    /** Drags through sheet-coordinate points (the eraser, a shape). */
    async drag(canvas, sheetPoints, gap = 8, sheetWidth = 1240) {
      const box = await canvas.boundingBox();
      const s = box.width / sheetWidth;
      const points = [];
      for (let i = 0; i < sheetPoints.length - 1; i++) {
        const [a, b] = [sheetPoints[i], sheetPoints[i + 1]];
        for (let k = 0; k < 14; k++) points.push({ x: box.x + (a[0] + ((b[0] - a[0]) * k) / 14) * s, y: box.y + (a[1] + ((b[1] - a[1]) * k) / 14) * s });
      }
      const end = sheetPoints.at(-1);
      points.push({ x: box.x + end[0] * s, y: box.y + end[1] * s });
      await this.stroke(points, gap);
    },
  };
}

/** Smoothly scrolls the window (or the element matching `selector`) to `top`. */
export async function scrollTo(page, top, { selector = null, wait = 1000 } = {}) {
  await page.evaluate(
    ([sel, y]) => (sel ? document.querySelector(sel) : window).scrollTo({ top: y, behavior: "smooth" }),
    [selector, top],
  );
  await sleep(wait);
}

/** Smoothly scrolls `locator` into view, `block` as in scrollIntoView. */
export async function scrollToElement(locator, block = "start", wait = 1000) {
  await locator.first().evaluate((el, b) => el.scrollIntoView({ behavior: "smooth", block: b }), block);
  await sleep(wait);
}

export const settle = (page) =>
  page
    .waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 30_000 })
    .catch(() => {})
    .then(() => sleep(500));
