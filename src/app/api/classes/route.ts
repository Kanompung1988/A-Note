import { z } from "zod";
import { errorResponse } from "@/lib/ai/http";
import { createClass } from "@/lib/store/classes";

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  teacherName: z.string().trim().min(1).max(80),
});

/** Creates a class. The response carries the teacher key once; the teacher's browser keeps it. */
export async function POST(request: Request) {
  try {
    const classRoom = await createClass(Body.parse(await request.json()));
    return Response.json({ code: classRoom.code, name: classRoom.name, teacherKey: classRoom.teacherKey });
  } catch (error) {
    return errorResponse(error);
  }
}
