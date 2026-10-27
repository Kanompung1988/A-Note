import { notFound } from "@/lib/ai/http";
import { publicClass } from "@/lib/store/classes";

/** What a learner sees about a class: its name and the worksheets assigned to it. */
export async function GET(_request: Request, ctx: RouteContext<"/api/classes/[code]">) {
  const { code } = await ctx.params;
  const classRoom = await publicClass(code);
  return classRoom ? Response.json(classRoom) : notFound("class_not_found");
}
