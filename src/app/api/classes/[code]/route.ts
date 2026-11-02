import { z } from "zod";
import { errorResponse, forbidden, notFound, teacherKey } from "@/lib/ai/http";
import { deleteClass, publicClass, renameClass, teacherClass } from "@/lib/store/classes";

/** What a learner sees about a class: its name and the worksheets assigned to them (`?student=`). */
export async function GET(request: Request, ctx: RouteContext<"/api/classes/[code]">) {
  const { code } = await ctx.params;
  const student = new URL(request.url).searchParams.get("student");
  const classRoom = await publicClass(code, student);
  return classRoom ? Response.json(classRoom, { headers: { "Cache-Control": "no-store" } }) : notFound("class_not_found");
}

const Rename = z.object({
  name: z.string().trim().min(1).max(80),
  teacherName: z.string().trim().min(1).max(80),
});

/** The teacher renames the class or themselves. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/classes/[code]">) {
  try {
    const { code } = await ctx.params;
    const classRoom = await teacherClass(code, teacherKey(request));
    if (!classRoom) return forbidden();
    const { name, teacherName } = await renameClass(classRoom, Rename.parse(await request.json()));
    return Response.json({ code: classRoom.code, name, teacherName });
  } catch (error) {
    return errorResponse(error);
  }
}

/** The teacher deletes the class with all its worksheets, learners and work. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/classes/[code]">) {
  const { code } = await ctx.params;
  const classRoom = await teacherClass(code, teacherKey(request));
  if (!classRoom) return forbidden();
  await deleteClass(classRoom);
  return new Response(null, { status: 204 });
}
