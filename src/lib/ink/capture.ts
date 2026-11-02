import { pageBandAt, type PageBand, type Sheet } from "@/lib/sheets";
import { expandBox, type Box, type Stroke } from "./geometry";
import { drawStroke } from "./render";

export type Capture = {
  sheetId: string;
  /** the loop's bounding box in page space */
  loop: Box;
  /** the region sent for the close-up, in page space */
  region: Box;
  /** close-up of the circled region with the learner's ink, JPEG data URL */
  crop: string;
  /** the whole page with ink, downscaled, JPEG data URL */
  page: string;
  /** size of `page` in pixels and how it maps back to page space (`top`: where it starts on the sheet) */
  pageImage: { width: number; height: number; scale: number; top: number };
};

const PAGE_MAX_WIDTH = 1280;

/** The page the box is on, downscaled: the whole sheet for one page, that page alone for a PDF. */
function pageImage(full: HTMLCanvasElement, sheet: Sheet, box: Box): { canvas: HTMLCanvasElement; band: PageBand; scale: number } {
  const band = pageBandAt(sheet, box);
  const scale = Math.min(1, PAGE_MAX_WIDTH / sheet.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sheet.width * scale);
  canvas.height = Math.round(band.height * scale);
  canvas.getContext("2d")!.drawImage(full, 0, band.top, sheet.width, band.height, 0, 0, canvas.width, canvas.height);
  return { canvas, band, scale };
}

/** Renders the sheet with its ink and cuts out the circled region plus a page overview. */
export async function captureRegion(sheet: Sheet, strokes: Stroke[], loop: Box): Promise<Capture> {
  const img = new Image();
  img.src = sheet.src;
  await img.decode();

  const full = document.createElement("canvas");
  full.width = sheet.width;
  full.height = sheet.height;
  const ctx = full.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, full.width, full.height);
  ctx.drawImage(img, 0, 0, sheet.width, sheet.height);
  for (const stroke of strokes) drawStroke(ctx, stroke);

  const pad = Math.max(sheet.width * 0.04, Math.max(loop.w, loop.h) * 0.2);
  const region = expandBox(loop, pad, sheet);
  const crop = document.createElement("canvas");
  crop.width = Math.round(region.w);
  crop.height = Math.round(region.h);
  crop.getContext("2d")!.drawImage(full, region.x, region.y, region.w, region.h, 0, 0, crop.width, crop.height);

  const { canvas: page, band, scale } = pageImage(full, sheet, loop);

  return {
    sheetId: sheet.id,
    loop,
    region,
    crop: crop.toDataURL("image/jpeg", 0.92),
    page: page.toDataURL("image/jpeg", 0.85),
    pageImage: { width: page.width, height: page.height, scale, top: band.top },
  };
}

export type WorkCapture = {
  /** close-up of the working (and the question above it) with a numbered tag beside each line */
  crop: string;
  page: string;
  /** the region of the close-up, in page space */
  region: Box;
};

export const TAG_COLOR = "#2563eb";

/** Renders the page with ink and cuts out the block of working, tagging line i with the number i + 1. */
export async function captureWork(sheet: Sheet, strokes: Stroke[], lines: Box[], context?: Box | null): Promise<WorkCapture> {
  const img = new Image();
  img.src = sheet.src;
  await img.decode();

  const full = document.createElement("canvas");
  full.width = sheet.width;
  full.height = sheet.height;
  const ctx = full.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, full.width, full.height);
  ctx.drawImage(img, 0, 0, sheet.width, sheet.height);
  for (const stroke of strokes) drawStroke(ctx, stroke);

  const { canvas: page } = pageImage(full, sheet, lines[lines.length - 1] ?? { x: 0, y: 0, w: 1, h: 1 });

  // Tags go on a copy, so the page overview shows the work as the learner wrote it.
  const radius = Math.max(16, sheet.width * 0.014);
  lines.forEach((line, i) => {
    const cx = Math.min(line.x + line.w + radius * 1.8, sheet.width - radius - 4);
    const cy = line.y + line.h / 2;
    ctx.fillStyle = TAG_COLOR;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(radius * 1.2)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), cx, cy + 1);
  });

  const all = [...lines, ...(context ? [context] : [])];
  const x0 = Math.min(...all.map((b) => b.x));
  const y0 = Math.min(...all.map((b) => b.y));
  const x1 = Math.max(...all.map((b) => b.x + b.w), ...lines.map((l) => l.x + l.w + radius * 3));
  const y1 = Math.max(...all.map((b) => b.y + b.h));
  const region = expandBox({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, sheet.width * 0.03, sheet);
  const crop = document.createElement("canvas");
  const cropScale = Math.min(1, 1600 / region.w);
  crop.width = Math.round(region.w * cropScale);
  crop.height = Math.round(region.h * cropScale);
  crop.getContext("2d")!.drawImage(full, region.x, region.y, region.w, region.h, 0, 0, crop.width, crop.height);

  return { crop: crop.toDataURL("image/jpeg", 0.92), page: page.toDataURL("image/jpeg", 0.85), region };
}
