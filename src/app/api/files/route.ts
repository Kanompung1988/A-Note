import { forbidden, teacherKey } from "@/lib/ai/http";
import { teacherClass } from "@/lib/store/classes";
import { isAllowedType, MAX_FILE_BYTES, saveFile } from "@/lib/store/files";

/** A teacher uploads a worksheet image (PDF pages arrive already rendered to PNG). */
export async function POST(request: Request) {
  const code = new URL(request.url).searchParams.get("code") ?? "";
  if (!(await teacherClass(code, teacherKey(request)))) return forbidden();
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "bad_request" }, { status: 400 });
  if (!isAllowedType(file.type)) return Response.json({ error: "unsupported_type" }, { status: 415 });
  if (file.size > MAX_FILE_BYTES) return Response.json({ error: "too_large" }, { status: 413 });
  const id = await saveFile(new Uint8Array(await file.arrayBuffer()), file.type);
  return Response.json({ id, url: `/api/files/${id}` });
}
