import { forbidden, teacherKey } from "@/lib/ai/http";
import { dashboard, teacherClass } from "@/lib/store/classes";

/** Everything the teacher's dashboard shows. The dashboard polls this for live updates. */
export async function GET(request: Request, ctx: RouteContext<"/api/classes/[code]/dashboard">) {
  const { code } = await ctx.params;
  const classRoom = await teacherClass(code, teacherKey(request));
  if (!classRoom) return forbidden();
  return Response.json(await dashboard(classRoom), { headers: { "Cache-Control": "no-store" } });
}
