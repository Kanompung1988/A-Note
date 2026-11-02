import type { QuestionBox } from "@/lib/sheets";

// Lays out a worksheet A-Note wrote as an A4-proportioned SVG page (same size and look as the
// sample sheets) and reports where each numbered question sits, so circles and checked work map
// back to a question and its answer key. Pure: no DOM, no fonts to load; text is measured with a
// character-width table and wrapped with Intl.Segmenter, which also splits Thai into words.

export const PAGE_WIDTH = 1240;
export const PAGE_HEIGHT = 1754;
const MARGIN = 90;
const TEXT_X = 150;
const TEXT_RIGHT = 1150;

export type LayoutQuestion = { prompt: string; kind: "short" | "working" | "explain" };

export type LayoutInput = {
  title: string;
  subtitle: string;
  instructions: string;
  questions: LayoutQuestion[];
  picture?: { dataUrl: string; width: number; height: number } | null;
  footer: string;
};

export type Layout = { svg: string; width: number; height: number; questions: QuestionBox[] };

const SIZES = { title: 46, sub: 28, section: 32, q: 32 } as const;
/** bold text runs about 8% wider than the regular widths in the table */
const BOLD = 1.08;
const LINE = { q: 46, section: 44 } as const;
type Spacing = { work: Record<LayoutQuestion["kind"], { lines: number; gap: number }>; pictureHeight: number; between: number };

/** ruled answer lines below each kind of question, and the gap between them */
const ROOMY: Spacing = {
  work: { short: { lines: 1, gap: 72 }, working: { lines: 3, gap: 68 }, explain: { lines: 3, gap: 64 } },
  pictureHeight: 400,
  between: 52,
};

/** used when the roomy layout runs past one page */
const COMPACT: Spacing = {
  work: { short: { lines: 1, gap: 64 }, working: { lines: 2, gap: 62 }, explain: { lines: 2, gap: 60 } },
  pictureHeight: 300,
  between: 40,
};

// Thai vowels and tone marks that sit above or below the consonant take no width.
const COMBINING = /[ัิ-ฺ็-๎̀-ͯ]/;

/** Approximate advance width of one character in ems for a humanist sans like Segoe UI. */
function charWidth(ch: string): number {
  if (COMBINING.test(ch)) return 0;
  if (/[฀-๿]/.test(ch)) return 0.58;
  if (" ".includes(ch)) return 0.27;
  if (/[il.,:;'|!()\[\]]/.test(ch)) return 0.28;
  if (/[fjrt1]/.test(ch)) return 0.36;
  if (/[mwMW]/.test(ch)) return 0.86;
  if (/[A-Z]/.test(ch)) return 0.64;
  if (/[0-9]/.test(ch)) return 0.55;
  if (/[−+=×÷<>]/.test(ch)) return 0.6;
  return 0.52;
}

export function measure(text: string, size: number): number {
  let width = 0;
  for (const ch of text) width += charWidth(ch);
  return width * size;
}

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "word" }) : null;

function words(text: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(text), (s) => s.segment);
  return text.split(/(\s+)/);
}

/** Greedy wrap into lines no wider than `max` pixels. */
export function wrap(text: string, size: number, max: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    let line = "";
    for (const word of words(paragraph.trim())) {
      const next = line + word;
      if (line && measure(next.trimEnd(), size) > max) {
        out.push(line.trimEnd());
        line = word.trimStart();
      } else {
        line = next;
      }
    }
    if (line.trim()) out.push(line.trimEnd());
  }
  return out.length ? out : [""];
}

export function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}

/** Lays the page out roomy; if that runs past one A4 page, tries a compact spacing before growing the page. */
export function layoutWorksheet(input: LayoutInput): Layout {
  const roomy = layoutWith(input, ROOMY);
  if (roomy.height <= PAGE_HEIGHT) return roomy;
  return layoutWith(input, COMPACT);
}

function layoutWith(input: LayoutInput, spacing: Spacing): Layout {
  const parts: string[] = [];
  const questions: QuestionBox[] = [];
  const t = (x: number, y: number, cls: string, value: string, anchor = "") =>
    parts.push(`<text x="${x}" y="${y}" class="${cls}"${anchor ? ` text-anchor="${anchor}"` : ""}>${escapeXml(value)}</text>`);

  let y = 130;
  for (const line of wrap(input.title, SIZES.title * BOLD, TEXT_RIGHT - MARGIN)) {
    t(MARGIN, y, "title", line);
    y += 56;
  }
  y -= 4;
  t(MARGIN, y, "sub", input.subtitle);
  y += 68;
  t(MARGIN, y, "q", "Name .................................................. Class .......... No. ..........");
  y += 40;
  parts.push(`<line x1="${MARGIN}" y1="${y}" x2="${TEXT_RIGHT}" y2="${y}" stroke="#1e3a8a" stroke-width="3"/>`);
  y += 76;

  for (const line of wrap(input.instructions, SIZES.section * BOLD, TEXT_RIGHT - MARGIN)) {
    t(MARGIN, y, "section", line);
    y += LINE.section;
  }
  y += 16;

  if (input.picture) {
    const maxW = TEXT_RIGHT - MARGIN;
    const maxH = spacing.pictureHeight;
    const scale = Math.min(maxW / input.picture.width, maxH / input.picture.height);
    const w = Math.round(input.picture.width * scale);
    const h = Math.round(input.picture.height * scale);
    const x = Math.round((PAGE_WIDTH - w) / 2);
    parts.push(`<image x="${x}" y="${y}" width="${w}" height="${h}" href="${input.picture.dataUrl}" preserveAspectRatio="xMidYMid meet"/>`);
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="none" stroke="#e5e7eb" stroke-width="3"/>`);
    y += h + 56;
  }

  input.questions.forEach((q, i) => {
    const n = i + 1;
    const top = y - 42;
    const lines = wrap(q.prompt, SIZES.q, TEXT_RIGHT - TEXT_X);
    t(MARGIN, y, "num", `${n}.`);
    for (const line of lines) {
      t(TEXT_X, y, "q", line);
      y += LINE.q;
    }
    const work = spacing.work[q.kind] ?? spacing.work.short;
    y += work.gap - LINE.q + 8;
    for (let k = 0; k < work.lines; k++) {
      parts.push(`<line x1="${TEXT_X}" y1="${y}" x2="${TEXT_RIGHT}" y2="${y}" class="rule"/>`);
      y += work.gap;
    }
    questions.push({ n, box: { x: MARGIN - 10, y: top, w: TEXT_RIGHT - MARGIN + 20, h: y - work.gap + 14 - top } });
    y += spacing.between;
  });

  const height = Math.max(PAGE_HEIGHT, y + 60);
  t(TEXT_RIGHT, height - 24, "small", input.footer, "end");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_WIDTH}" height="${height}" viewBox="0 0 ${PAGE_WIDTH} ${height}">
  <style>
    text { font-family: "Segoe UI", "Leelawadee UI", "Helvetica Neue", Thonburi, Helvetica, Arial, "Noto Sans Thai", sans-serif; fill: #1f2937; }
    .title { font-size: ${SIZES.title}px; font-weight: 700; }
    .sub { font-size: ${SIZES.sub}px; fill: #4b5563; }
    .section { font-size: ${SIZES.section}px; font-weight: 700; fill: #1e3a8a; }
    .q { font-size: ${SIZES.q}px; }
    .num { font-size: 34px; font-weight: 700; }
    .small { font-size: 22px; fill: #9ca3af; }
    .rule { stroke: #d1d5db; stroke-width: 2; }
  </style>
  <rect width="${PAGE_WIDTH}" height="${height}" fill="#ffffff"/>
  ${parts.join("\n  ")}
</svg>`;
  return { svg, width: PAGE_WIDTH, height, questions };
}
