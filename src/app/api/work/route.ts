import { z } from "zod";
import { errorResponse, notFound, strokesBody } from "@/lib/ai/http";
import { learnerWork, saveWork } from "@/lib/store/classes";

const Seat = z.object({
  code: z.string().min(1).max(20),
  studentId: z.string().min(1).max(40),
  assignmentId: z.string().min(1).max(40),
});

/** The learner's own saved work on an assignment, so it follows them to another device. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const seat = Seat.parse({ code: params.get("code"), studentId: params.get("studentId"), assignmentId: params.get("assignmentId") });
    const found = await learnerWork(seat);
    return found ? Response.json(found, { headers: { "Cache-Control": "no-store" } }) : notFound();
  } catch (error) {
    return errorResponse(error);
  }
}

const Body = Seat.extend({ strokes: strokesBody, handIn: z.boolean().optional() });

/** Saves the learner's ink (the board autosaves); `handIn` hands it in to the teacher. */
export async function PUT(request: Request) {
  try {
    const { strokes, handIn, ...seat } = Body.parse(await request.json());
    const work = await saveWork(seat, strokes, Boolean(handIn));
    return work ? Response.json({ work }) : notFound();
  } catch (error) {
    return errorResponse(error);
  }
}
