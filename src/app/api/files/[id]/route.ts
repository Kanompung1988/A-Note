import { notFound } from "@/lib/ai/http";
import { loadFile } from "@/lib/store/files";

export async function GET(_request: Request, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  const file = await loadFile(id);
  if (!file) return notFound();
  return new Response(new Uint8Array(file.bytes), {
    headers: { "Content-Type": file.type, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
