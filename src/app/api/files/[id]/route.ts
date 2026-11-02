import { notFound } from "@/lib/ai/http";
import { loadFile } from "@/lib/store/files";

export async function GET(_request: Request, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  const file = await loadFile(id);
  if (!file) return notFound();
  const headers: Record<string, string> = { "Content-Type": file.type, "Cache-Control": "public, max-age=31536000, immutable" };
  // Generated pages are SVG; never let one run script or load anything beyond its own inline images.
  if (file.type === "image/svg+xml") headers["Content-Security-Policy"] = "default-src 'none'; img-src data:; style-src 'unsafe-inline'";
  return new Response(file.bytes as BodyInit, { headers });
}
