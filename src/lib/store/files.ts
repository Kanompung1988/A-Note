import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR, supabase } from "./db";

// Uploaded worksheet images, generated worksheet pages and pictures. Kept in the Supabase `files`
// bucket when Supabase is configured, otherwise next to the local JSON data. Served by /api/files/[id].

const DIR = path.join(DATA_DIR, "files");
const BUCKET = "files";
const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml" };
const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };

export const MAX_FILE_BYTES = 12 * 1024 * 1024;
export const FILE_ID = /^[A-Za-z0-9_-]+\.(png|jpg|webp|svg)$/;

/** What teachers may upload. SVG is only ever written by A-Note itself. */
export function isAllowedType(type: string): boolean {
  return type in EXTENSIONS && type !== "image/svg+xml";
}

export async function saveFile(bytes: Uint8Array, type: string): Promise<string> {
  const ext = EXTENSIONS[type];
  if (!ext) throw new Error(`unsupported type ${type}`);
  const id = `${randomBytes(12).toString("base64url")}.${ext}`;
  const sb = supabase();
  if (sb) {
    const { error } = await sb.storage.from(BUCKET).upload(id, bytes, { contentType: type, upsert: false });
    if (error) throw new Error(`upload failed: ${error.message}`);
  } else {
    await mkdir(DIR, { recursive: true });
    await writeFile(path.join(DIR, id), bytes);
  }
  return id;
}

export async function loadFile(id: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  if (!FILE_ID.test(id)) return null;
  const type = TYPES[id.split(".").pop()!];
  const sb = supabase();
  try {
    if (sb) {
      const { data, error } = await sb.storage.from(BUCKET).download(id);
      if (error || !data) return null;
      return { bytes: new Uint8Array(await data.arrayBuffer()), type };
    }
    return { bytes: new Uint8Array(await readFile(path.join(DIR, id))), type };
  } catch {
    return null;
  }
}
