import "server-only";

// Best-effort, per-instance sliding window. It keeps a public demo from burning the Meta key;
// a multi-instance deployment would move this to a shared store.

type Bucket = number[];
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;

export const LIMITS = {
  segment: 30,
  tutor: 15,
  reply: 30,
  transcribe: 20,
  insights: 6,
} as const;

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

/** Returns a 429 response when the caller is over the limit for `name`, otherwise null. */
export function rateLimit(request: Request, name: keyof typeof LIMITS): Response | null {
  const key = `${name}:${clientKey(request)}`;
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMITS[name]) {
    buckets.set(key, recent);
    const retryAfter = Math.ceil((WINDOW_MS - (now - recent[0])) / 1000);
    return Response.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  }
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 10_000) {
    for (const [k, times] of buckets) if (!times.some((t) => now - t < WINDOW_MS)) buckets.delete(k);
  }
  return null;
}
