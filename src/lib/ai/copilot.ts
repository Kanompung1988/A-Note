import "server-only";
import { z } from "zod";
import { clusterAsks } from "@/lib/class/cluster";
import { createResponse, functionCalls, MODELS, outputText, type FunctionTool, type MetaResponse } from "@/lib/meta/client";
import { questionAt } from "@/lib/sheets";
import { addAssignment } from "@/lib/store/classes";
import type { Assignment, ClassRoom, Dashboard, LessonPlan, RunStep } from "@/lib/store/types";
import { drawPicture, publishSheet, settle, verifyAndRepair, type QuestionDraft } from "./worksheet";

// The class co-pilot: an agent on Muse Spark with tool calls. After a lesson it reads what the class
// circled and where their checked work went wrong, finds the misconceptions that matter, writes a short
// practice sheet for each group of learners, and assigns it only to them. Every answer key it writes is
// verified by an independent Muse Wonder solve inside the tool, and the tool refuses sheets that fail,
// so the agent has to fix them before anything reaches a learner. It finishes with tomorrow's plan.

const MAX_TURNS = 10;

const INSTRUCTIONS = `You are A-Note's class co-pilot. A teacher has just taught with the worksheet in the image.
Numbered orange boxes on it mark the spots learners circled to ask the A-Note tutor for help.
Your job is to turn what happened into tomorrow's lesson, and to do the work, not just describe it.

1. Call read_class first. Look closer at individual learners with look_at_learner only when it changes a decision.
2. Find the one to three misconceptions that matter most. Use only the data: what learners circled, the slips found
   in their checked work, hints used and who solved what.
3. Group the learners who showed each misconception (each learner in at most one group; use their ids).
   Leave out learners who showed no trouble.
4. For each group call create_practice with three or four short questions aimed exactly at that misconception,
   easiest first, each answerable from its own text, with the answer and worked steps, in the worksheet's language.
   The tool checks every answer with an independent solver. If it refuses a sheet, fix the questions it names and call it again.
5. Finish by calling finish with a plan the teacher can run in ten minutes tomorrow.

Write the note to learners warmly and briefly: what they will practise, never what they got wrong in front of others.
Do not invent learners, numbers or quotes. Keep teacher-facing text concise. If nobody needs practice, call finish directly.`;

const QUESTION = {
  type: "object",
  properties: {
    prompt: { type: "string" },
    kind: { type: "string", enum: ["short", "working", "explain"] },
    answer: { type: "string", description: "final answer only" },
    steps: { type: "array", items: { type: "string" } },
    skill: { type: "string" },
  },
  required: ["prompt", "kind", "answer", "steps", "skill"],
};

const TOOLS: FunctionTool[] = [
  {
    type: "function",
    name: "read_class",
    description: "The worksheet's questions with the teacher's answer key, every circled spot (which question, who, solved or not), and each learner's activity and checked-work slips.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function",
    name: "look_at_learner",
    description: "Everything one learner did on this worksheet: each thing they circled, what the tutor read there, hints used, and each slip found in their checked work.",
    parameters: { type: "object", properties: { student_id: { type: "string" } }, required: ["student_id"], additionalProperties: false },
  },
  {
    type: "function",
    name: "create_practice",
    description:
      "Writes a short practice worksheet for one group of learners and assigns it only to them. Every answer is verified by an independent solver first; returns the new assignment id, or which questions failed so you can fix them.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short, encouraging title" },
        misconception: { type: "string", description: "The mix-up this practice targets, for the teacher" },
        student_ids: { type: "array", items: { type: "string" } },
        note_for_learners: { type: "string", description: "One or two warm sentences the learners see on the sheet's card" },
        picture: { type: "string", description: "Optional one-sentence scene for an illustration (no text in it), or empty" },
        questions: { type: "array", items: QUESTION },
      },
      required: ["title", "misconception", "student_ids", "note_for_learners", "questions"],
    },
  },
  {
    type: "function",
    name: "finish",
    description: "Hands the teacher tomorrow's plan. Call once, at the end.",
    parameters: {
      type: "object",
      properties: {
        headline: { type: "string", description: "One sentence: the most important thing to know about this class today" },
        warmup: { type: "string", description: "A two-minute whole-class warm-up" },
        reteach: { type: "string", description: "A five-minute re-teach of the biggest misconception, using the worksheet's own numbers" },
        exit_ticket: { type: "string", description: "One exit-ticket question" },
        groups: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              student_ids: { type: "array", items: { type: "string" } },
              focus: { type: "string" },
              assignment_id: { type: "string", description: "The practice sheet created for this group, or empty" },
            },
            required: ["name", "student_ids", "focus", "assignment_id"],
          },
        },
      },
      required: ["headline", "warmup", "reteach", "exit_ticket", "groups"],
    },
  },
];

const PracticeArgs = z.object({
  title: z.string().min(1).max(120),
  misconception: z.string().max(400).default(""),
  student_ids: z.array(z.string()).min(1).max(60),
  note_for_learners: z.string().max(400).default(""),
  picture: z.string().max(400).optional().default(""),
  questions: z
    .array(
      z.object({
        prompt: z.string().min(1).max(600),
        kind: z.enum(["short", "working", "explain"]).catch("working"),
        answer: z.string().min(1).max(300),
        steps: z.array(z.string().max(300)).max(8).default([]),
        skill: z.string().max(80).default(""),
      }),
    )
    .min(2)
    .max(6),
});

const FinishArgs = z.object({
  headline: z.string().max(400),
  warmup: z.string().max(800),
  reteach: z.string().max(1200),
  exit_ticket: z.string().max(400),
  groups: z.array(z.object({ name: z.string().max(80), student_ids: z.array(z.string()), focus: z.string().max(300), assignment_id: z.string().default("") })).max(6),
});

export type CopilotEvent = { step: RunStep } | { assignment: Assignment };

type Input = { classRoom: ClassRoom; assignment: Assignment; data: Dashboard; page: string };

function step(kind: RunStep["kind"], title: string, detail?: string): RunStep {
  return { at: new Date().toISOString(), kind, title, ...(detail ? { detail } : {}) };
}

/** What read_class returns: the class's work on this worksheet, compact and with names. */
function snapshot({ assignment, data }: Input) {
  const asks = data.asks.filter((a) => a.assignmentId === assignment.id);
  const names = new Map(data.students.map((s) => [s.id, s.name]));
  const spots = clusterAsks(asks.filter((a) => a.kind !== "check")).map((c) => ({
    spot: c.id,
    question: questionAt(assignment.sheet, c.box),
    learners: c.studentIds.map((id) => ({ id, name: names.get(id) ?? "?" })),
    solved_after_hints: c.solved,
    asks: c.askIds.length,
    what_they_circled: c.circled.slice(0, 3),
    topics: c.topics.slice(0, 3),
  }));
  const learners = data.students.map((s) => {
    const mine = asks.filter((a) => a.studentId === s.id);
    const checks = mine.filter((a) => a.kind === "check");
    return {
      id: s.id,
      name: s.name,
      circled: mine.length - checks.length,
      solved: mine.filter((a) => a.kind !== "check" && a.solved).length,
      hints_used: mine.reduce((n, a) => n + a.hintsSeen, 0),
      checked_work: checks.map((c) => ({ question: questionAt(assignment.sheet, c.loop), correct: c.solved, slip: c.slip ?? null })),
      handed_in: data.work.some((w) => w.studentId === s.id && w.assignmentId === assignment.id && w.status === "handed_in"),
    };
  });
  return {
    worksheet: assignment.sheet.title,
    questions: (assignment.key?.items ?? []).map((k) => ({ n: k.n, prompt: k.prompt, answer: k.answer, skill: k.skill })),
    learners_in_class: data.students.length,
    spots,
    learners,
  };
}

function learnerDetail({ assignment, data }: Input, studentId: string) {
  const student = data.students.find((s) => s.id === studentId);
  if (!student) return { error: "unknown student_id" };
  const mine = data.asks.filter((a) => a.assignmentId === assignment.id && a.studentId === studentId);
  return {
    name: student.name,
    activity: mine.map((a) => ({
      kind: a.kind ?? "ask",
      question: questionAt(assignment.sheet, a.loop),
      read_there: a.circled,
      topic: a.topic,
      slip: a.slip ?? null,
      hints_used: a.hintsSeen,
      replies: a.replies,
      solved: a.solved,
    })),
  };
}

/**
 * Runs the agent loop. `emit` receives each visible step and each assignment as it is made;
 * the return value is the teacher's plan (null if the agent never called finish).
 */
export async function runCopilot(input: Input, emit: (event: CopilotEvent) => void): Promise<{ plan: LessonPlan | null; created: string[] }> {
  const names = new Map(input.data.students.map((s) => [s.id, s.name]));
  const created: Assignment[] = [];
  // set by the finish tool
  const state: { plan: LessonPlan | null } = { plan: null };

  const say = (kind: RunStep["kind"], title: string, detail?: string) => emit({ step: step(kind, title, detail) });

  async function call(name: string, raw: string): Promise<unknown> {
    let args: unknown;
    try {
      args = JSON.parse(raw || "{}");
    } catch {
      return { error: "arguments were not valid JSON" };
    }
    if (name === "read_class") {
      const snap = snapshot(input);
      say("tool", "Read the class", `${snap.learners_in_class} learners · ${snap.spots.length} circled spots · ${snap.learners.reduce((n, l) => n + l.checked_work.length, 0)} checked answers`);
      return snap;
    }
    if (name === "look_at_learner") {
      const id = String((args as { student_id?: string }).student_id ?? "");
      say("tool", `Looked closer at ${names.get(id) ?? "a learner"}'s work`);
      return learnerDetail(input, id);
    }
    if (name === "create_practice") {
      const parsed = PracticeArgs.safeParse(args);
      if (!parsed.success) return { error: "invalid arguments", issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) };
      const p = parsed.data;
      const studentIds = p.student_ids.filter((id) => names.has(id));
      if (!studentIds.length) return { error: "none of student_ids are in this class; use ids from read_class" };
      const who = studentIds.map((id) => names.get(id)).join(", ");
      say("tool", `Writing “${p.title}” for ${who}`, p.misconception);

      const picture = p.picture ? drawPicture(p.picture) : Promise.resolve(null);
      const context = `Practice for learners who used: ${input.assignment.sheet.title}. Misconception: ${p.misconception}`;
      const result = await settle(verifyAndRepair(p.questions as QuestionDraft[], context));
      const passed = result.verdicts.filter((v) => v.agrees).length;
      if (passed < 2) {
        const failures = result.verdicts.filter((v) => !v.agrees).map((v) => ({ question: v.index + 1, independent_answer: v.independent, reason: v.reason }));
        say("check", `Muse Wonder rejected the answer key (${passed}/${result.verdicts.length} agreed) — asking for a fix`);
        return { created: false, error: "answer key failed independent verification", failures };
      }
      say("check", `Muse Wonder verified ${passed}/${result.verdicts.length} answers`);

      const published = await publishSheet({
        title: p.title,
        subtitle: `Practice for ${studentIds.length === 1 ? who : `${studentIds.length} learners`} · from ${input.assignment.sheet.title}`,
        subject: input.assignment.sheet.subject ?? "Practice",
        instructions: p.note_for_learners || "Try these. Use Check my work when you finish each one.",
        questions: result.questions,
        verdicts: result.verdicts,
        picture: await picture,
      });
      const assignment = await addAssignment(input.classRoom.id, published.sheet, {
        origin: "copilot",
        key: published.key,
        studentIds,
        note: p.note_for_learners,
      });
      created.push(assignment);
      emit({ assignment });
      say("done", `Assigned to ${who}`, `${result.questions.length} questions`);
      return { created: true, assignment_id: assignment.id, questions: result.questions.length, verified: passed };
    }
    if (name === "finish") {
      const parsed = FinishArgs.safeParse(args);
      if (!parsed.success) return { error: "invalid arguments", issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) };
      const f = parsed.data;
      state.plan = {
        headline: f.headline,
        warmup: f.warmup,
        reteach: f.reteach,
        exit_ticket: f.exit_ticket,
        groups: f.groups.map((g) => ({
          name: g.name,
          studentNames: g.student_ids.map((id) => names.get(id)).filter((n): n is string => Boolean(n)),
          focus: g.focus,
          assignmentId: created.some((a) => a.id === g.assignment_id) ? g.assignment_id : null,
        })),
      };
      return { ok: true };
    }
    return { error: `unknown tool ${name}` };
  }

  say("think", "Looking at the worksheet and where the class circled");
  let response: MetaResponse = await createResponse({
    model: MODELS.tutor,
    reasoning: { effort: "medium" },
    instructions: INSTRUCTIONS,
    tools: TOOLS,
    input: [
      {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: `Plan tomorrow for ${input.classRoom.name} after “${input.assignment.sheet.title}”.` },
          { type: "input_image", image_url: input.page },
        ],
      },
    ],
  });

  for (let turn = 0; turn < MAX_TURNS && !state.plan; turn++) {
    const thought = outputText(response).trim();
    if (thought) say("think", thought.length > 280 ? `${thought.slice(0, 277)}…` : thought);
    const calls = functionCalls(response);
    if (!calls.length) {
      // tool_choice is always auto here, so nudge once toward the plan instead of forcing it
      response = await createResponse({
        model: MODELS.tutor,
        reasoning: { effort: "low" },
        instructions: INSTRUCTIONS,
        tools: TOOLS,
        previous_response_id: response.id,
        input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Now call finish with the plan." }] }],
      });
      continue;
    }
    // Independent calls (several practice sheets) run together; results go back in call order.
    const outputs = await Promise.all(
      calls.map((c) =>
        call(c.name, c.arguments).catch((e: unknown) => {
          console.error(`[copilot] ${c.name} failed`, e);
          return { error: e instanceof Error ? e.message : "tool failed" };
        }),
      ),
    );
    outputs.forEach((o, i) => o && typeof o === "object" && "error" in o && console.error(`[copilot] ${calls[i].name} returned`, JSON.stringify(o).slice(0, 600)));
    if (state.plan) break;
    response = await createResponse({
      model: MODELS.tutor,
      reasoning: { effort: "medium" },
      instructions: INSTRUCTIONS,
      tools: TOOLS,
      previous_response_id: response.id,
      input: calls.map((c, i) => ({ type: "function_call_output", call_id: c.callId, output: JSON.stringify(outputs[i]) })),
    });
  }

  const { plan } = state;
  if (plan) say("done", "Plan ready", plan.headline);
  else say("error", "The co-pilot stopped before writing a plan", created.length ? `${created.length} practice sheets were still assigned.` : undefined);
  return { plan, created: created.map((a) => a.id) };
}
