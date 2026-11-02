import { z } from "zod";
import { errorResponse, forbidden, notFound, teacherKey } from "@/lib/ai/http";
import { readWork, setFeedback, teacherClass } from "@/lib/store/classes";

/** One learner's page (ink and status) for the teacher. */
export async function GET(request: Request, ctx: RouteContext<"/api/classes/[code]/work">) {
  const { code } = await ctx.params;
  const classRoom = await teacherClass(code, teacherKey(request));
  if (!classRoom) return forbidden();
  const params = new URL(request.url).searchParams;
  const assignmentId = params.get("assignmentId") ?? "";
  const studentId = params.get("studentId") ?? "";
  if (!assignmentId || !studentId) return Response.json({ error: "bad_request" }, { status: 400 });
  return Response.json(await readWork(classRoom.id, assignmentId, studentId), { headers: { "Cache-Control": "no-store" } });
}

const Feedback = z.object({
  assignmentId: z.string().min(1).max(40),
  studentId: z.string().min(1).max(40),
  feedback: z.string().max(1000),
});

/** The teacher's note back to a learner. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/classes/[code]/work">) {
  try {
    const { code } = await ctx.params;
    const classRoom = await teacherClass(code, teacherKey(request));
    if (!classRoom) return forbidden();
    const { assignmentId, studentId, feedback } = Feedback.parse(await request.json());
    const work = await setFeedback(classRoom.id, assignmentId, studentId, feedback);
    return work ? Response.json({ work }) : notFound();
  } catch (error) {
    return errorResponse(error);
  }
}
