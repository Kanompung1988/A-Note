// Cuts the recorded takes to the voiceover and renders the demo video: video-out/A-Note-demo.mp4.
// App scenes sit in a frame with the scene label, the Meta models at work and captions; waits on the
// real models are sped up and badged as such. Needs voice.mjs, music.mjs, record.mjs and cards.mjs first.
// Usage: FFMPEG=path/to/ffmpeg node scripts/video/compose.mjs [--plan] [--scenes hook,title,…] [--name A-Note-x] [--reuse-scenes]
// (--scenes makes a shorter cut, e.g. for X, which plays up to 2:20; --reuse-scenes keeps scene files already rendered)

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { LEAD, SCENES, TAIL } from "./narration.mjs";
import { FULL_FRAME, launch, newContext } from "./recorder.mjs";
import { loadVoice } from "./timing.mjs";

const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const FPS = 30;
const XFADE = 0.4;
const OUT = "video-out";
const BUILD = path.join(OUT, "build");
const WINDOW = { x: 160, y: 84 };
const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const planOnly = args.includes("--plan");
const reuseScenes = args.includes("--reuse-scenes");
const only = option("--scenes")?.split(",");
const NAME = option("--name") ?? "A-Note-demo";
mkdirSync(BUILD, { recursive: true });

const ff = (args) => execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "inherit", "inherit"] });
const slash = (p) => path.resolve(p).replace(/\\/g, "/");

const takes = {};
function take(name) {
  takes[name] ??= JSON.parse(readFileSync(path.join(OUT, "takes", name, "take.json"), "utf8"));
  return takes[name];
}
/** Seconds into a take for "mark" or "mark+1.5" / "mark-2". */
function at(name, spec) {
  const [, mark, offset] = spec.match(/^([a-z0-9]+)([+-][\d.]+)?$/);
  const { marks } = take(name);
  if (marks[mark] == null) throw new Error(`${name} has no mark "${mark}"`);
  return marks[mark] - marks.start + Number(offset ?? 0);
}
const has = (name, mark) => take(name).marks[mark] != null;

// How each app scene is cut. A clip runs `from`→`to` in one take; `elastic` clips are model waits that
// absorb whatever time the voiceover leaves; `speed` plays a clip faster; `fit` fills a voiceover window.
const EDITS = {
  create: () => [
    { take: "create", from: "start", to: "wait" },
    { take: "create", from: "wait", to: "ready", elastic: true },
    { take: "create", from: "ready", to: "end" },
  ],
  ask: () => [
    { take: "ask", from: "start", to: "wait1", speed: 1.3 },
    { take: "ask", from: "wait1", to: "hint", elastic: true },
    { take: "ask", from: "hint", to: "wait2", speed: 1.25 },
    { take: "ask", from: "wait2", to: "reply", elastic: true },
    ...(has("ask", "picture")
      ? [
          { take: "ask", from: "reply", to: "wait3" },
          { take: "ask", from: "wait3", to: "picture", elastic: true },
          { take: "ask", from: "picture", to: "end" },
        ]
      : [{ take: "ask", from: "reply", to: "end" }]),
  ],
  check: () => [
    { take: "check", from: "start", to: "written", speed: 3 },
    { take: "check", from: "written", to: "wait1" },
    { take: "check", from: "wait1", to: "result", elastic: true },
    { take: "check", from: "result", to: "result+3" },
    { take: "check", from: "result+3", to: "rewritten", speed: 3.2 },
    { take: "check", from: "rewritten", to: "wait2" },
    { take: "check", from: "wait2", to: "ticks", elastic: true },
    { take: "check", from: "ticks", to: "end", speed: 1.5 },
  ],
  dashboard: () => [{ take: "dashboard", from: "start", to: "end", speed: 1.25 }],
  copilot: () => [
    { take: "copilot", from: "start", to: "wait" },
    { take: "copilot", from: "wait", to: "done", elastic: true },
    { take: "copilot", from: "done", to: "end" },
  ],
  foryou: () => [{ take: "foryou", from: "start", to: "end", speed: 1.3 }],
  platform: (voice) => [
    { take: "tools", from: "start", to: "end", fit: LEAD + voice.at("worksheets") - 0.1 },
    { take: "pdf", from: "start", to: "end", fit: voice.at("and every") - voice.at("worksheets") },
    { take: "progress", from: "start", to: "end", fit: Math.max(3.5, voice.end - voice.at("and every") + TAIL + 0.1) },
  ],
};

/** Works out every clip's speed and place, the scene length, and the sped-up windows. */
function plan(scene) {
  const voice = loadVoice(scene.id);
  const target = LEAD + voice.end + (scene.tail ?? TAIL);
  const clips = (scene.card ? [{ take: scene.id, from: "start", to: "end" }] : EDITS[scene.id](voice)).map((c) => {
    const from = at(c.take, c.from);
    const to = at(c.take, c.to);
    return { ...c, start: from, end: to, length: to - from, speed: c.fit ? (to - from) / c.fit : (c.speed ?? 1) };
  });
  const fixed = clips.filter((c) => !c.elastic).reduce((s, c) => s + c.length / c.speed, 0);
  const elastic = clips.filter((c) => c.elastic);
  if (elastic.length) {
    const budget = Math.max(elastic.length * 1.3, target - fixed);
    const raw = elastic.reduce((s, c) => s + c.length, 0);
    for (const c of elastic) c.speed = Math.max(1, c.length / Math.max(1.3, (budget * c.length) / raw));
  }
  let t = 0;
  for (const c of clips) {
    c.out = t;
    t += c.length / c.speed;
  }
  const length = Math.max(target, t);
  const badges = elastic.filter((c) => c.speed >= 1.8).map((c) => ({ from: c.out + 0.15, to: c.out + c.length / c.speed - 0.1, speed: Math.round(c.speed) }));
  const captions = scene.card ? [] : voice.captions().map((c) => ({ text: c.text, from: LEAD + c.start, to: Math.min(length, LEAD + c.until) }));
  return { scene, voice, clips, length, content: t, badges, captions };
}

const plans = SCENES.filter((s) => !only || only.includes(s.id)).map(plan);
for (const p of plans) {
  const parts = p.clips.map((c) => `${c.take}:${c.from}→${c.to} ${c.length.toFixed(1)}s${c.speed !== 1 ? ` ×${c.speed.toFixed(1)}` : ""}`);
  console.log(`${p.scene.id.padEnd(9)} ${p.length.toFixed(1).padStart(5)} s (voice ${p.voice.end.toFixed(1)}, cut ${p.content.toFixed(1)})  ${parts.join(" | ")}`);
}
const total = plans.reduce((s, p) => s + p.length, 0) - XFADE * (plans.length - 1);
console.log(`total ${total.toFixed(1)} s`);
if (planOnly) process.exit(0);

// 1. each take as a constant-frame-rate video
for (const name of new Set(plans.flatMap((p) => p.clips.map((c) => c.take)))) {
  const file = path.join(BUILD, `take-${name}.mp4`);
  const source = path.join(OUT, "takes", name, "take.json");
  if (existsSync(file) && statSync(file).mtimeMs > statSync(source).mtimeMs) continue;
  const { frames, marks } = take(name);
  const items = frames.map((f) => ({ file: slash(path.join(OUT, "takes", name, "frames", f.file)), t: Math.max(0, f.t - marks.start) }));
  const lines = ["ffconcat version 1.0"];
  items.forEach((item, i) => {
    const next = i + 1 < items.length ? items[i + 1].t : marks.end - marks.start;
    if (next - item.t > 0.0005) lines.push(`file '${item.file}'`, `duration ${(next - item.t).toFixed(4)}`);
  });
  lines.push(`file '${items.at(-1).file}'`);
  writeFileSync(path.join(BUILD, `take-${name}.txt`), lines.join("\n"));
  ff(["-f", "concat", "-safe", "0", "-i", path.join(BUILD, `take-${name}.txt`), "-vf", `fps=${FPS},format=yuv420p`, "-c:v", "libx264", "-preset", "fast", "-crf", "12", file]);
  console.log(`take ${name}`);
}

// 2. overlays: frames, captions, speed badges (transparent PNGs from overlay.html)
const browser = await launch();
const page = await (await newContext(browser, FULL_FRAME)).newPage();
await page.goto(pathToFileURL(path.resolve("scripts", "video", "overlay.html")).href, { waitUntil: "networkidle" });
async function png(file, kind, data) {
  await page.evaluate(([k, d]) => window.render(k, d), [kind, data]);
  await page.screenshot({ path: file, omitBackground: true });
  return file;
}
for (const p of plans) {
  if (p.scene.card) continue;
  p.framePng = await png(path.join(BUILD, `frame-${p.scene.id}.png`), "frame", { side: p.scene.side, label: p.scene.label, models: p.scene.models });
  for (const [i, c] of p.captions.entries()) c.png = await png(path.join(BUILD, `cap-${p.scene.id}-${i}.png`), "caption", { text: c.text });
  for (const [i, b] of p.badges.entries()) b.png = await png(path.join(BUILD, `badge-${p.scene.id}-${i}.png`), "badge", { speed: b.speed });
}
await browser.close();

// 3. each scene: cut, speed, hold, frame, captions
for (const p of plans) {
  const names = [...new Set(p.clips.map((c) => c.take))];
  const inputs = names.flatMap((n) => ["-i", path.join(BUILD, `take-${n}.mp4`)]);
  const graph = [];
  names.forEach((n, i) => {
    const uses = p.clips.filter((c) => c.take === n).length;
    graph.push(`[${i}:v]split=${uses}${Array.from({ length: uses }, (_, k) => `[t${i}_${k}]`).join("")}`);
  });
  const used = {};
  p.clips.forEach((c, k) => {
    const i = names.indexOf(c.take);
    used[i] = (used[i] ?? -1) + 1;
    graph.push(`[t${i}_${used[i]}]trim=start=${c.start.toFixed(3)}:end=${c.end.toFixed(3)},setpts=(PTS-STARTPTS)/${c.speed.toFixed(4)},fps=${FPS}[c${k}]`);
  });
  const hold = Math.max(0, p.length - p.content) + 0.5;
  graph.push(`${p.clips.map((_, k) => `[c${k}]`).join("")}concat=n=${p.clips.length}:v=1:a=0,tpad=stop_mode=clone:stop_duration=${hold.toFixed(3)},setsar=1[raw]`);
  let last = "raw";
  if (!p.scene.card) {
    const images = [p.framePng, ...p.captions.map((c) => c.png), ...p.badges.map((b) => b.png)];
    images.forEach((file) => inputs.push("-i", file));
    let n = names.length;
    graph.push(`color=c=0xf8fafc:s=1920x1080:r=${FPS}:d=${(p.length + 0.5).toFixed(3)}[base]`, `[base][raw]overlay=${WINDOW.x}:${WINDOW.y}[w]`, `[w][${n++}:v]overlay=0:0[f]`);
    last = "f";
    for (const [i, o] of [...p.captions, ...p.badges].entries()) {
      graph.push(`[${last}][${n++}:v]overlay=0:0:enable='between(t,${o.from.toFixed(3)},${o.to.toFixed(3)})'[o${i}]`);
      last = `o${i}`;
    }
  }
  graph.push(`[${last}]format=yuv420p[v]`);
  const script = path.join(BUILD, `scene-${p.scene.id}.graph`);
  writeFileSync(script, graph.join(";\n"));
  p.file = path.join(BUILD, `scene-${p.scene.id}.mp4`);
  if (reuseScenes && existsSync(p.file)) continue;
  ff([...inputs, "-filter_complex_script", script, "-map", "[v]", "-t", p.length.toFixed(3), "-r", String(FPS), "-c:v", "libx264", "-preset", "fast", "-crf", "12", p.file]);
  console.log(`scene ${p.scene.id}`);
}

// 4. join with crossfades; voice on each scene, music under it, ducked
const inputs = plans.flatMap((p) => ["-i", p.file]);
const graph = [];
let offset = 0;
let video = "0:v";
plans.forEach((p, i) => {
  p.at = offset;
  if (i > 0) {
    graph.push(`[${video}][${i}:v]xfade=transition=fade:duration=${XFADE}:offset=${offset.toFixed(3)}[x${i}]`);
    video = `x${i}`;
  }
  offset += p.length - XFADE;
});
plans.forEach((p, i) => {
  inputs.push("-i", path.join(OUT, "voice", `${p.scene.id}.mp3`));
  graph.push(`[${plans.length + i}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=${Math.round((p.at + LEAD) * 1000)}:all=1[a${i}]`);
});
inputs.push("-i", path.join(OUT, "music.mp3"));
const music = plans.length * 2;
graph.push(
  `${plans.map((_, i) => `[a${i}]`).join("")}amix=inputs=${plans.length}:normalize=0:dropout_transition=0,atrim=0:${total.toFixed(3)},loudnorm=I=-15:TP=-1.5:LRA=11,aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[voice][key]`,
  `[${music}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${total.toFixed(3)},loudnorm=I=-29:TP=-8,aformat=sample_rates=48000:channel_layouts=stereo,afade=t=in:d=1.2,afade=t=out:st=${(total - 4).toFixed(3)}:d=4[bed]`,
  `[bed][key]sidechaincompress=threshold=0.03:ratio=4:attack=20:release=450[ducked]`,
  `[voice][ducked]amix=inputs=2:normalize=0:dropout_transition=0,alimiter=limit=0.94[a]`,
);
// Chrome's frames are full-range JPEG; deliver standard (TV) range so every player shows the same colours
graph.push(`[${video}]scale=in_range=full:out_range=tv,format=yuv420p[vout]`);
video = "vout";
const script = path.join(BUILD, "final.graph");
writeFileSync(script, graph.join(";\n"));
const final = path.join(OUT, `${NAME}.mp4`);
ff([
  ...inputs,
  "-filter_complex_script", script,
  "-map", `[${video}]`, "-map", "[a]",
  "-t", total.toFixed(3),
  "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-profile:v", "high", "-pix_fmt", "yuv420p", "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-r", String(FPS),
  "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
  "-movflags", "+faststart",
  final,
]);
writeFileSync(
  path.join(OUT, `${NAME}.srt`),
  plans
    .flatMap((p) => p.captions.map((c) => ({ ...c, from: p.at + c.from, to: p.at + c.to })))
    .map((c, i) => `${i + 1}\n${srt(c.from)} --> ${srt(c.to)}\n${c.text}\n`)
    .join("\n"),
);
console.log(`wrote ${final} (${total.toFixed(1)} s)`);

function srt(s) {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
}
