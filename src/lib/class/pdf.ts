import type { PageBand } from "@/lib/sheets";

// Turns a PDF into one tall worksheet image in the browser (pdf.js): every page rendered at the sample
// sheets' width and stacked with a grey gap. Ink, SAM, the heatmap and hand-in then work unchanged;
// the page bands tell the tutor which page a circle is on.

export const PDF_PAGE_WIDTH = 1240;
const GAP = 28;
/** browsers cap canvas height around 16k pixels; eight A4 pages fit comfortably */
export const MAX_PDF_PAGES = 8;

export type RenderedPdf = { blob: Blob; width: number; height: number; pages: PageBand[]; pageCount: number; truncated: boolean };

const MAX_BYTES = 3.8 * 1024 * 1024;

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality));
}

export function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export async function renderPdf(file: File): Promise<RenderedPdf> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    const count = Math.min(doc.numPages, MAX_PDF_PAGES);
    const rendered: HTMLCanvasElement[] = [];
    for (let i = 1; i <= count; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: PDF_PAGE_WIDTH / base.width });
      const canvas = document.createElement("canvas");
      canvas.width = PDF_PAGE_WIDTH;
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      rendered.push(canvas);
      page.cleanup();
    }

    const height = rendered.reduce((sum, c) => sum + c.height, 0) + GAP * (rendered.length - 1);
    const sheet = document.createElement("canvas");
    sheet.width = PDF_PAGE_WIDTH;
    sheet.height = height;
    const ctx = sheet.getContext("2d")!;
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    const pages: PageBand[] = [];
    let top = 0;
    for (const canvas of rendered) {
      ctx.drawImage(canvas, 0, top);
      pages.push({ top, height: canvas.height });
      top += canvas.height + GAP;
    }
    // stay well under the 4.5 MB request limit of the host: long PDFs are encoded a little softer
    let blob = await encode(sheet, rendered.length <= 3 ? 0.86 : 0.8);
    if (blob.size > MAX_BYTES) blob = await encode(sheet, 0.66);
    return { blob, width: sheet.width, height, pages, pageCount: doc.numPages, truncated: doc.numPages > count };
  } finally {
    void doc.destroy();
  }
}
