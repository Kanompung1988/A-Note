import type { Box } from "@/lib/ink/geometry";

/** SAM's mask of a circled region, in page space. The path is in mask raster space and stretches over `box`. */
export type PageRegion = { box: Box; path: string; maskWidth: number; maskHeight: number };

/** The raw SAM result in the pixels of the image that was sent. */
export type ImageRegion = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  path: string;
  maskWidth: number;
  maskHeight: number;
};

/** `top` is where the sent image starts on the sheet (non-zero when only one page of a long sheet was sent). */
export function toPageSpace(region: ImageRegion, scale: number, top = 0): PageRegion {
  return {
    box: {
      x: region.left / scale,
      y: top + region.top / scale,
      w: (region.right - region.left) / scale,
      h: (region.bottom - region.top) / scale,
    },
    path: region.path,
    maskWidth: region.maskWidth,
    maskHeight: region.maskHeight,
  };
}

/** SVG transform that stretches a mask path over its page box. */
export function regionTransform(region: PageRegion): string {
  const { box, maskWidth, maskHeight } = region;
  return `translate(${box.x} ${box.y}) scale(${box.w / maskWidth} ${box.h / maskHeight})`;
}
