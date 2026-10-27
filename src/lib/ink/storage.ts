import type { Stroke } from "./geometry";

// Ink is a per-device convenience for now, so it lives in localStorage. Storage can be
// unavailable (private mode, blocked site data), which simply means nothing is restored.

const key = (sheetId: string) => `a-note:ink:${sheetId}`;

export function loadStrokes(sheetId: string): Stroke[] {
  try {
    const raw = localStorage.getItem(key(sheetId));
    return raw ? (JSON.parse(raw) as Stroke[]) : [];
  } catch {
    return [];
  }
}

export function saveStrokes(sheetId: string, strokes: Stroke[]): void {
  try {
    if (strokes.length) localStorage.setItem(key(sheetId), JSON.stringify(strokes));
    else localStorage.removeItem(key(sheetId));
  } catch {
    // storage full or blocked; the ink stays on screen for this session
  }
}

export function newId(): string {
  // crypto.randomUUID needs a secure context, which an iPad testing over the LAN does not have.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
