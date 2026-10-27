import type { Sheet } from "@/lib/sheets";
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
  /** size of `page` in pixels and how it maps back to page space */
  pageImage: { width: number; height: number; scale: number };
};

const PAGE_MAX_WIDTH = 1280;

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

  const scale = Math.min(1, PAGE_MAX_WIDTH / sheet.width);
  const page = document.createElement("canvas");
  page.width = Math.round(sheet.width * scale);
  page.height = Math.round(sheet.height * scale);
  page.getContext("2d")!.drawImage(full, 0, 0, page.width, page.height);

  return {
    sheetId: sheet.id,
    loop,
    region,
    crop: crop.toDataURL("image/jpeg", 0.92),
    page: page.toDataURL("image/jpeg", 0.85),
    pageImage: { width: page.width, height: page.height, scale },
  };
}
