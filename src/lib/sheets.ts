import type { Box } from "@/lib/ink/geometry";

/** Where a numbered question sits on the page, in page pixels. */
export type QuestionBox = { n: number; box: Box };

/** One page of a multi-page sheet (a PDF), as the band of the tall sheet image it occupies. */
export type PageBand = { top: number; height: number };

export type Sheet = {
  id: string;
  title: string;
  src: string;
  /** natural size in pixels; ink is stored in this coordinate space */
  width: number;
  height: number;
  /** uploaded sheets live only in this tab, so their ink is not saved */
  local?: boolean;
  subject?: string;
  /** known for worksheets A-Note lays out itself */
  questions?: QuestionBox[];
  /** set for multi-page sheets: the pages stacked top to bottom */
  pages?: PageBand[];
};

/** Question boxes spanning the page width from [top, bottom] pairs. */
function rows(spans: [number, number][]): QuestionBox[] {
  return spans.map(([top, bottom], i) => ({ n: i + 1, box: { x: 80, y: top, w: 1080, h: bottom - top } }));
}

export const SAMPLE_SHEETS: Sheet[] = [
  {
    id: "linear-equations",
    title: "Worksheet 3 · Linear Equations",
    src: "/sheets/linear-equations.svg",
    width: 1240,
    height: 1754,
    subject: "Math",
    questions: rows([[400, 540], [545, 690], [695, 860], [865, 1010], [1100, 1295], [1320, 1700]]),
  },
  {
    id: "simple-circuits",
    title: "Worksheet 5 · Simple Circuits",
    src: "/sheets/simple-circuits.svg",
    width: 1240,
    height: 1754,
    subject: "Science",
    questions: rows([[830, 980], [990, 1140], [1150, 1300], [1310, 1460], [1470, 1625]]),
  },
  {
    id: "mangrove-reading",
    title: "Reading 2 · The Mangrove Wall",
    src: "/sheets/mangrove-reading.svg",
    width: 1240,
    height: 1754,
    subject: "English",
    questions: rows([[1040, 1180], [1190, 1330], [1340, 1480], [1490, 1630]]),
  },
];

const SUBJECT_STYLES: Record<string, string> = {
  Math: "bg-blue-50 text-blue-700 ring-blue-200",
  Science: "bg-teal-50 text-teal-700 ring-teal-200",
  English: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function subjectStyle(subject: string): string {
  return SUBJECT_STYLES[subject] ?? "bg-amber-50 text-amber-700 ring-amber-200";
}

/** The question a loop or block of work belongs to: the one its box overlaps most. */
export function questionAt(sheet: Pick<Sheet, "questions">, box: Box): number | null {
  let best: { n: number; area: number } | null = null;
  for (const q of sheet.questions ?? []) {
    const w = Math.min(box.x + box.w, q.box.x + q.box.w) - Math.max(box.x, q.box.x);
    const h = Math.min(box.y + box.h, q.box.y + q.box.h) - Math.max(box.y, q.box.y);
    const area = w > 0 && h > 0 ? w * h : 0;
    if (area > 0 && (!best || area > best.area)) best = { n: q.n, area };
  }
  return best?.n ?? null;
}

/** The page a box sits on, for multi-page sheets; the whole sheet otherwise. */
export function pageBandAt(sheet: Pick<Sheet, "pages" | "height">, box: Box): PageBand {
  const middle = box.y + box.h / 2;
  return sheet.pages?.find((p) => middle >= p.top && middle < p.top + p.height) ?? { top: 0, height: sheet.height };
}

/** Builds a sheet from an image or PDF the learner picked. */
export async function sheetFromFile(file: File): Promise<Sheet> {
  const title = file.name.replace(/\.[^.]+$/, "");
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const { renderPdf } = await import("@/lib/class/pdf");
    const pdf = await renderPdf(file);
    return { id: `upload-${Date.now().toString(36)}`, title, src: URL.createObjectURL(pdf.blob), width: pdf.width, height: pdf.height, pages: pdf.pages, local: true };
  }
  const src = URL.createObjectURL(file);
  const img = new Image();
  img.src = src;
  await img.decode();
  return {
    id: `upload-${Date.now().toString(36)}`,
    title,
    src,
    width: img.naturalWidth,
    height: img.naturalHeight,
    local: true,
  };
}
