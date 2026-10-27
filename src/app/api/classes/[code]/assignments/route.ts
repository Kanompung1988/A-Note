import { z } from "zod";
import { errorResponse, forbidden, notFound, teacherKey } from "@/lib/ai/http";
import { SAMPLE_SHEETS } from "@/lib/sheets";
import { addAssignment, removeAssignment, teacherClass } from "@/lib/store/classes";

const Body = z.union([
  z.object({ sampleId: z.string() }),
  z.object({
    upload: z.object({
      fileId: z.string().regex(/^[A-Za-z0-9_-]+\.(png|jpg|webp)$/),
      title: z.string().trim().min(1).max(120),
      width: z.number().int().positive().max(10000),
      height: z.number().int().positive().max(10000),
    }),
  }),
]);

export async function POST(request: Request, ctx: RouteContext<"/api/classes/[code]/assignments">) {
  try {
    const { code } = await ctx.params;
    const classRoom = await teacherClass(code, teacherKey(request));
    if (!classRoom) return forbidden();
    const body = Body.parse(await request.json());
    if ("sampleId" in body) {
      const sample = SAMPLE_SHEETS.find((s) => s.id === body.sampleId);
      if (!sample) return notFound("sheet_not_found");
      return Response.json(await addAssignment(classRoom.id, sample));
    }
    const { fileId, title, width, height } = body.upload;
    return Response.json(await addAssignment(classRoom.id, { id: fileId, title, src: `/api/files/${fileId}`, width, height }));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/classes/[code]/assignments">) {
  const { code } = await ctx.params;
  const classRoom = await teacherClass(code, teacherKey(request));
  if (!classRoom) return forbidden();
  const assignmentId = new URL(request.url).searchParams.get("id") ?? "";
  return (await removeAssignment(classRoom.id, assignmentId)) ? new Response(null, { status: 204 }) : notFound();
}
