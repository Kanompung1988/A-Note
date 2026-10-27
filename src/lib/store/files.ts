import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "./db";

// Uploaded worksheet images. Stored next to the JSON data; served by /api/files/[id].

const DIR = path.join(DATA_DIR, "files");
const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };
const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export const MAX_FILE_BYTES = 12 * 1024 * 1024;

export function isAllowedType(type: string): boolean {
  return type in EXTENSIONS;
}

export async function saveFile(bytes: Uint8Array, type: string): Promise<string> {
  const ext = EXTENSIONS[type];
  if (!ext) throw new Error(`unsupported type ${type}`);
  await mkdir(DIR, { recursive: true });
  const id = `${randomBytes(12).toString("base64url")}.${ext}`;
  await writeFile(path.join(DIR, id), bytes);
  return id;
}

export async function loadFile(id: string): Promise<{ bytes: Buffer; type: string } | null> {
  if (!/^[A-Za-z0-9_-]+\.(png|jpg|webp)$/.test(id)) return null;
  try {
    const bytes = await readFile(path.join(DIR, id));
    return { bytes, type: TYPES[id.split(".").pop()!] };
  } catch {
    return null;
  }
}
