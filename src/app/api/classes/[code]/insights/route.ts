import { z } from "zod";
import { errorResponse, forbidden, imageDataUrl, teacherKey } from "@/lib/ai/http";
import { classInsight } from "@/lib/ai/insights";
import { rateLimit } from "@/lib/ai/rate-limit";
import { clusterAsks } from "@/lib/class/cluster";
import { dashboard, teacherClass } from "@/lib/store/classes";

export const maxDuration = 60;

const Body = z.object({
  assignmentId: z.string().min(1),
  /** the worksheet with numbered spot boxes drawn on it, rendered by the teacher's browser */
  page: imageDataUrl,
});

/** Muse Spark reads the class's circled spots and tells the teacher what to re-teach. */
export async function POST(request: Request, ctx: RouteContext<"/api/classes/[code]/insights">) {
  const limited = rateLimit(request, "insights");
  if (limited) return limited;
  try {
    const { code } = await ctx.params;
    const classRoom = await teacherClass(code, teacherKey(request));
    if (!classRoom) return forbidden();
    const { assignmentId, page } = Body.parse(await request.json());
    const data = await dashboard(classRoom);
    const assignment = data.assignments.find((a) => a.id === assignmentId);
    if (!assignment) return Response.json({ error: "assignment_not_found" }, { status: 404 });

    const spots = clusterAsks(data.asks.filter((a) => a.assignmentId === assignmentId)).map((c) => ({
      id: c.id,
      learners: c.studentIds.length,
      asks: c.askIds.length,
      solved: c.solved,
      circled: c.circled.slice(0, 3),
      topics: c.topics.slice(0, 3),
    }));
    if (!spots.length) return Response.json({ error: "no_asks_yet" }, { status: 409 });

    const insight = await classInsight({
      page,
      sheetTitle: assignment.sheet.title,
      learnersInClass: data.students.length,
      spots,
    });
    return Response.json({ insight, spotCount: spots.length, at: new Date().toISOString() });
  } catch (error) {
    return errorResponse(error);
  }
}
