import { notFound } from "@/lib/ai/http";
import { publicClass } from "@/lib/store/classes";

/** What a learner sees about a class: its name and the worksheets assigned to them (`?student=`). */
export async function GET(request: Request, ctx: RouteContext<"/api/classes/[code]">) {
  const { code } = await ctx.params;
  const student = new URL(request.url).searchParams.get("student");
  const classRoom = await publicClass(code, student);
  return classRoom ? Response.json(classRoom, { headers: { "Cache-Control": "no-store" } }) : notFound("class_not_found");
}
