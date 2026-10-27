import { listModels, MODELS } from "@/lib/meta/client";

// Reports whether the server can reach the Meta Model API and sees every model A-Note needs.
export async function GET() {
  try {
    const available = await listModels();
    const required = Object.values(MODELS);
    const missing = required.filter((id) => !available.includes(id));
    return Response.json({ ok: missing.length === 0, required, missing }, { status: missing.length ? 503 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return Response.json({ ok: false, error: message }, { status: 503 });
  }
}
