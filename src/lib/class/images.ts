import type { Cluster } from "@/lib/class/cluster";
import type { Sheet } from "@/lib/sheets";

const MAX_UPLOAD_WIDTH = 1800;

/** Shrinks a worksheet photo to a sensible size and returns it as JPEG with its dimensions. */
export async function prepareUpload(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_UPLOAD_WIDTH / img.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.88),
    );
    return { blob, width: canvas.width, height: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The worksheet with each stuck spot boxed and numbered, for the class-insight model call. */
export async function renderSpots(sheet: Sheet, clusters: Cluster[]): Promise<string> {
  const img = new Image();
  img.src = sheet.src;
  await img.decode();
  const scale = Math.min(1, 1280 / sheet.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sheet.width * scale);
  canvas.height = Math.round(sheet.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  for (const c of clusters) {
    const pad = 8;
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 5;
    ctx.strokeRect(c.box.x - pad, c.box.y - pad, c.box.w + pad * 2, c.box.h + pad * 2);
    const r = 24;
    const cx = c.box.x + c.box.w + pad;
    const cy = c.box.y - pad;
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(c.id), cx, cy + 1);
  }
  return canvas.toDataURL("image/jpeg", 0.85);
}
