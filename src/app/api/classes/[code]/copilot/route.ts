import { z } from "zod";
import { runCopilot } from "@/lib/ai/copilot";
import { errorResponse, forbidden, imageDataUrl, teacherKey } from "@/lib/ai/http";
import { rateLimit } from "@/lib/ai/rate-limit";
import { ndjson } from "@/lib/ai/stream";
import { dashboard, newId, saveRun, teacherClass } from "@/lib/store/classes";
import type { CopilotRun } from "@/lib/store/types";

export const maxDuration = 300;

const Body = z.object({
  assignmentId: z.string().min(1).max(40),
  /** the worksheet with numbered spot boxes, rendered by the teacher's browser */
  page: imageDataUrl,
});

/** The class co-pilot. Streams each step of the agent as it happens and keeps the run for the dashboard. */
export async function POST(request: Request, ctx: RouteContext<"/api/classes/[code]/copilot">) {
  const limited = rateLimit(request, "copilot");
  if (limited) return limited;
  try {
    const { code } = await ctx.params;
    const classRoom = await teacherClass(code, teacherKey(request));
    if (!classRoom) return forbidden();
    const { assignmentId, page } = Body.parse(await request.json());
    const data = await dashboard(classRoom);
    const assignment = data.assignments.find((a) => a.id === assignmentId);
    if (!assignment) return Response.json({ error: "assignment_not_found" }, { status: 404 });

    const run: CopilotRun = {
      id: newId(),
      classId: classRoom.id,
      assignmentId,
      status: "running",
      steps: [],
      plan: null,
      createdAssignmentIds: [],
      createdAt: new Date().toISOString(),
      finishedAt: null,
    };
    await saveRun(run);
    // saves run one after another, so an early save never lands after a later one
    let saving: Promise<unknown> = Promise.resolve();
    const persist = () => (saving = saving.then(() => saveRun(run)).catch(() => undefined));

    return ndjson(async (send) => {
      send({ type: "run", runId: run.id });
      try {
        const result = await runCopilot({ classRoom, assignment, data, page }, (event) => {
          if ("step" in event) {
            run.steps.push(event.step);
            void persist();
            send({ type: "step", step: event.step });
          } else {
            run.createdAssignmentIds.push(event.assignment.id);
            send({ type: "assignment", assignment: event.assignment });
          }
        });
        run.plan = result.plan;
        run.status = result.plan ? "done" : "failed";
      } catch (error) {
        run.status = "failed";
        run.steps.push({ at: new Date().toISOString(), kind: "error", title: "The co-pilot hit an error" });
        throw error;
      } finally {
        run.finishedAt = new Date().toISOString();
        await persist();
        send({ type: "done", run });
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
