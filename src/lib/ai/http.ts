import "server-only";
import { z } from "zod";
import { MetaApiError } from "@/lib/meta/client";

// Base64 images from the browser; 8 MB of text is far above a 1280px JPEG page.
export const imageDataUrl = z
  .string()
  .max(8_000_000)
  .regex(/^data:image\/(jpeg|png|webp);base64,/);

export const box = z.object({ x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive() });

export const pageRegion = z.object({
  box,
  path: z.string().max(200_000),
  maskWidth: z.number().int().positive(),
  maskHeight: z.number().int().positive(),
});

export function notFound(what = "not_found"): Response {
  return Response.json({ error: what }, { status: 404 });
}

export function forbidden(): Response {
  return Response.json({ error: "forbidden" }, { status: 403 });
}

export function teacherKey(request: Request): string | null {
  return request.headers.get("x-teacher-key");
}

export function errorResponse(error: unknown): Response {
  if (error instanceof z.ZodError || error instanceof SyntaxError) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (error instanceof MetaApiError) {
    console.error(`[meta] ${error.status}: ${error.body.slice(0, 300)}`);
    return Response.json({ error: "model_unavailable" }, { status: 502 });
  }
  console.error(error);
  return Response.json({ error: "server_error" }, { status: 500 });
}
