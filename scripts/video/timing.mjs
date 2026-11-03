// Reads a scene's voice clip timings (from voice.mjs) and turns them into words, phrase cues and captions.

import { readFileSync } from "node:fs";
import path from "node:path";
import { CAPTION_FIXES } from "./narration.mjs";

export function loadVoice(id) {
  const v = JSON.parse(readFileSync(path.join("video-out", "voice", `${id}.json`), "utf8"));
  const end = v.ends.at(-1);
  /** Seconds into the clip where `phrase` starts being spoken. */
  const at = (phrase) => {
    const i = v.text.indexOf(phrase);
    if (i < 0) throw new Error(`"${phrase}" is not in the ${id} narration`);
    return v.starts[i];
  };
  return { ...v, end, at, captions: () => captions(v) };
}

/** Caption chunks of about one line, broken at punctuation where possible. */
function captions(v) {
  const words = [];
  let current = null;
  for (let i = 0; i < v.chars.length; i++) {
    const ch = v.chars[i];
    if (ch === " ") {
      current = null;
      continue;
    }
    if (!current) words.push((current = { text: "", start: v.starts[i], end: v.ends[i] }));
    current.text += ch;
    current.end = v.ends[i];
  }
  // spoken forms that should read differently ("SAM three point one" → "SAM 3.1") become one word
  for (const [spoken, shown] of CAPTION_FIXES) {
    const n = spoken.split(" ").length;
    for (let i = 0; i + n <= words.length; i++) {
      const run = words.slice(i, i + n);
      if (run.map((w) => w.text).join(" ") === spoken) words.splice(i, n, { text: shown, start: run[0].start, end: run.at(-1).end });
    }
  }
  // sentences, each split into as few balanced lines as fit, breaking after a comma where one is close
  const sentences = [];
  let sentence = [];
  for (const w of words) {
    sentence.push(w);
    if (/[.?!]$/.test(w.text)) {
      sentences.push(sentence);
      sentence = [];
    }
  }
  if (sentence.length) sentences.push(sentence);
  // a very short sentence ("Stuck?") shares a line with the next one
  for (let i = 0; i < sentences.length - 1; i++) {
    const both = [...sentences[i], ...sentences[i + 1]];
    if (joined(sentences[i]).length < 18 && joined(both).length <= MAX_LINE) sentences.splice(i--, 2, both);
  }
  const chunks = sentences.flatMap((s) => split(s));
  // each chunk stays up until the next begins
  return chunks.map((c, i) => ({ ...c, until: chunks[i + 1]?.start ?? c.end + 0.5 }));
}

const MAX_LINE = 60;
const joined = (words) => words.map((w) => w.text).join(" ");

function split(words) {
  const lines = Math.ceil(joined(words).length / MAX_LINE);
  if (lines <= 1) return [chunk(words)];
  const target = joined(words).length / lines;
  // the break nearest the ideal length, preferring one after punctuation
  let best = 1;
  let bestScore = Infinity;
  for (let i = 1; i < words.length; i++) {
    const length = joined(words.slice(0, i)).length;
    if (length > MAX_LINE) break;
    const score = Math.abs(length - target) - (/[,:;—]$/.test(words[i - 1].text) ? 14 : 0);
    if (score < bestScore) [best, bestScore] = [i, score];
  }
  return [chunk(words.slice(0, best)), ...split(words.slice(best))];
}

const chunk = (words) => ({ text: joined(words), start: words[0].start, end: words.at(-1).end });
