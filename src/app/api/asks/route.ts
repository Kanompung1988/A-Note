import { z } from "zod";
import { box, errorResponse, notFound } from "@/lib/ai/http";
import { createAsk } from "@/lib/store/classes";

const Body = z.object({
  code: z.string().min(1).max(20),
  studentId: z.string().min(1).max(40),
  assignmentId: z.string().min(1).max(40),
  loop: box,
  kind: z.enum(["ask", "check"]).optional(),
});

/** Records that a learner in a class circled something and asked, or asked A-Note to check their work. */
export async function POST(request: Request) {
  try {
    const ask = await createAsk(Body.parse(await request.json()));
    return ask ? Response.json({ id: ask.id }) : notFound();
  } catch (error) {
    return errorResponse(error);
  }
}
