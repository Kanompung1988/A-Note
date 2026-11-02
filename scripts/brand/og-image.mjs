// Renders the social share card (src/app/opengraph-image.png, twitter-image.png) from HTML with Chrome.
// Offline brand script: node scripts/brand/og-image.mjs
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const icon = `data:image/png;base64,${readFileSync("public/brand/icon.png").toString("base64")}`;
const html = `<!doctype html><html><head><style>
  body { margin: 0; width: 1200px; height: 630px; font-family: "Segoe UI", Helvetica, Arial, sans-serif;
         background: linear-gradient(160deg, #e0f2fe 0%, #f0f9ff 45%, #fff7ed 100%); display: flex; overflow: hidden; }
  .left { padding: 70px 0 0 72px; width: 640px; }
  .brand { display: flex; align-items: center; gap: 16px; font-size: 40px; font-weight: 700; color: #0f172a; }
  .brand img { width: 72px; height: 72px; border-radius: 20px; }
  h1 { font-size: 52px; line-height: 1.08; margin: 36px 0 0; color: #0f172a; letter-spacing: -1.5px; }
  h1 span { color: #f97316; }
  p { font-size: 22px; line-height: 1.45; color: #475569; margin: 22px 0 0; width: 560px; }
  .models { position: absolute; left: 72px; bottom: 48px; font-size: 20px; color: #0c4a6e; font-weight: 600; }
  .sheet { position: absolute; right: 60px; top: 60px; width: 430px; height: 510px; background: #fff; border-radius: 18px;
           box-shadow: 0 30px 60px rgba(15, 23, 42, .15); padding: 34px 36px; box-sizing: border-box; }
  .sheet h2 { margin: 0; font-size: 26px; color: #1f2937; }
  .q { font-family: Cambria, "Times New Roman", serif; font-style: italic; font-size: 28px; color: #1f2937; margin-top: 22px; }
  .hand { font-family: "Segoe Print", "Comic Sans MS", cursive; font-size: 26px; color: #1e293b; margin: 8px 0 0 40px; }
  .note { position: absolute; right: 26px; bottom: 22px; width: 250px; background: #fff1f2; border: 2px solid #fda4af;
          border-radius: 16px; padding: 14px 16px; font-size: 18px; color: #334155; }
  .note b { color: #be123c; font-size: 14px; letter-spacing: 1px; }
</style></head><body>
  <div class="left">
    <div class="brand"><img src="${icon}"> A-Note</div>
    <h1>Circle what you <span>don't get.</span><br>Get it, one hint at a time.</h1>
    <p>The AI classroom on a worksheet: write one in a line, check handwritten work, and let the co-pilot plan tomorrow.</p>
  </div>
  <div class="models">Muse Spark · Muse Wonder · Muse Image · SAM 3.1 · Voice Transcribe</div>
  <div class="sheet">
    <h2>Two-step equations</h2>
    <div class="q">1.&nbsp; 3x + 7 = 22</div>
    <div class="hand" style="position:relative">3x = 22 + 7
      <svg width="250" height="70" style="position:absolute;left:-22px;top:-12px" viewBox="0 0 250 70"><path d="M230 14 C 200 -2, 40 2, 14 22 C -4 40, 60 64, 140 60 C 220 56, 250 40, 222 16" fill="none" stroke="#dc2626" stroke-width="4" stroke-linecap="round"/></svg>
    </div>
    <div class="hand">3x = 29</div>
    <div class="q">2.&nbsp; 5(x − 2) = 3x + 4</div>
    <div class="hand">5x − 10 = 3x + 4 <span style="color:#16a34a">✓</span></div>
    <div class="note"><b>LOOK AT LINE 1</b><br>7 was added instead of subtracted. What undoes +7?</div>
  </div>
</body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
for (const out of ["src/app/opengraph-image.png", "src/app/twitter-image.png"]) await page.screenshot({ path: out });
await browser.close();
console.log("wrote src/app/opengraph-image.png and twitter-image.png");
