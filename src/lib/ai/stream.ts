import "server-only";
import { MetaApiError } from "@/lib/meta/client";

// Long model pipelines (writing a worksheet, the class co-pilot) stream newline-delimited JSON,
// so the teacher watches each step land instead of staring at a spinner for a minute.

export type Send = (event: Record<string, unknown>) => void;

export function ndjson(run: (send: Send) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: Send = (event) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await run(send);
      } catch (error) {
        if (error instanceof MetaApiError) console.error(`[meta] ${error.status}: ${error.body.slice(0, 300)}`);
        else console.error(error);
        send({ type: "error", error: error instanceof MetaApiError ? "model_unavailable" : "server_error" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
