import { z } from "zod";
import { errorResponse, notFound } from "@/lib/ai/http";
import { joinClass } from "@/lib/store/classes";

const Body = z.object({ name: z.string().trim().min(1).max(40) });

export async function POST(request: Request, ctx: RouteContext<"/api/classes/[code]/join">) {
  try {
    const { code } = await ctx.params;
    const joined = await joinClass(code, Body.parse(await request.json()).name);
    return joined ? Response.json(joined) : notFound("class_not_found");
  } catch (error) {
    return errorResponse(error);
  }
}
