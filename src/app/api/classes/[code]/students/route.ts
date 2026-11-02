import { forbidden, notFound, teacherKey } from "@/lib/ai/http";
import { removeStudent, teacherClass } from "@/lib/store/classes";

/** The teacher removes a learner (`?id=`) and their work from the class. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/classes/[code]/students">) {
  const { code } = await ctx.params;
  const classRoom = await teacherClass(code, teacherKey(request));
  if (!classRoom) return forbidden();
  const id = new URL(request.url).searchParams.get("id") ?? "";
  return (await removeStudent(classRoom.id, id)) ? new Response(null, { status: 204 }) : notFound();
}
