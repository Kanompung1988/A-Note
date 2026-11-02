import { z } from "zod";
import { errorResponse, forbidden, notFound, teacherKey } from "@/lib/ai/http";
import { SAMPLE_KEYS } from "@/lib/sample-keys";
import { SAMPLE_SHEETS } from "@/lib/sheets";
import { addAssignment, publishAssignment, removeAssignment, teacherClass } from "@/lib/store/classes";
import { FILE_ID } from "@/lib/store/files";

const Body = z.union([
  z.object({ sampleId: z.string() }),
  z.object({
    upload: z.object({
      fileId: z.string().regex(FILE_ID),
      title: z.string().trim().min(1).max(120),
      width: z.number().int().positive().max(10000),
      height: z.number().int().positive().max(20000),
      pages: z.array(z.object({ top: z.number().min(0), height: z.number().positive() })).max(8).optional(),
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
      return Response.json(await addAssignment(classRoom.id, sample, { origin: "sample", key: SAMPLE_KEYS[sample.id] }));
    }
    const { fileId, title, width, height, pages } = body.upload;
    return Response.json(await addAssignment(classRoom.id, { id: fileId, title, src: `/api/files/${fileId}`, width, height, pages }, { origin: "upload" }));
  } catch (error) {
    return errorResponse(error);
  }
}

/** Publishes a draft A-Note wrote, once the teacher has reviewed it. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/classes/[code]/assignments">) {
  try {
    const { code } = await ctx.params;
    const classRoom = await teacherClass(code, teacherKey(request));
    if (!classRoom) return forbidden();
    const { id } = z.object({ id: z.string().min(1).max(40), publish: z.literal(true) }).parse(await request.json());
    const assignment = await publishAssignment(classRoom.id, id);
    return assignment ? Response.json(assignment) : notFound();
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
