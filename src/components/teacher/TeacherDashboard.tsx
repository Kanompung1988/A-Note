"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { TopBar } from "@/components/ui/TopBar";
import { classInsight, getDashboard, runCopilot, unassign, type ClassInsight, type Dashboard } from "@/lib/class/api";
import { clusterAsks } from "@/lib/class/cluster";
import { formatCode, teacherSeat } from "@/lib/class/identity";
import { renderSpots } from "@/lib/class/images";
import { subjectStyle } from "@/lib/sheets";
import type { Assignment, CopilotRun, RunStep, Student } from "@/lib/store/types";
import { isLive, timeAgo } from "@/lib/time";
import { AssignModal } from "./AssignModal";
import { CopilotPanel } from "./CopilotPanel";
import { ClassHeatmap } from "./ClassHeatmap";
import { JoinCodeModal } from "./JoinCodeModal";
import { SpotsPanel } from "./SpotsPanel";
import { WorkViewer } from "./WorkViewer";

const POLL_MS = 4000;

type InsightState = { insight: ClassInsight; at: string };

/** A co-pilot run in progress in this tab (saved runs come back with the dashboard data). */
type LiveRun = { assignmentId: string; steps: RunStep[]; made: Assignment[]; run: CopilotRun | null; running: boolean; error: string | null };

export default function TeacherDashboard({ code }: { code: string }) {
  const seat = teacherSeat(code);
  const teacherKey = seat?.teacherKey;
  const [data, setData] = useState<Dashboard | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeSpot, setActiveSpot] = useState<number | null>(null);
  const [insights, setInsights] = useState<Record<string, InsightState>>({});
  const [thinking, setThinking] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [live, setLive] = useState<LiveRun | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  // Live: poll the class while the dashboard is open.
  useEffect(() => {
    if (!teacherKey) return;
    let cancelled = false;
    const load = () =>
      getDashboard(code, teacherKey)
        .then((d) => {
          if (cancelled) return;
          setData(d);
          setNow(Date.now());
          setFailed(false);
        })
        .catch(() => !cancelled && setFailed(true));
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [code, teacherKey]);

  const assignments = useMemo(() => (data?.assignments ?? []).filter((a) => !a.draft), [data]);
  // the class's own worksheets first; practice the co-pilot made for small groups is listed after
  const selected = assignments.find((a) => a.id === selectedId) ?? assignments.filter((a) => !a.studentIds).at(-1) ?? assignments.at(-1) ?? null;
  const allAsks = useMemo(() => (data && selected ? data.asks.filter((a) => a.assignmentId === selected.id) : []), [data, selected]);
  // circles feed the heatmap; checked work is counted per learner
  const asks = useMemo(() => allAsks.filter((a) => a.kind !== "check"), [allAsks]);
  const checks = useMemo(() => allAsks.filter((a) => a.kind === "check"), [allAsks]);
  const clusters = useMemo(() => clusterAsks(asks), [asks]);

  if (!seat) {
    return (
      <Centered>
        <p className="text-lg font-semibold text-slate-900">This browser isn&apos;t the teacher of class {formatCode(code)}.</p>
        <p className="text-slate-500">Open the dashboard on the device that created the class, or make a new class.</p>
        <Link href="/teacher" className="rounded-xl bg-orange-500 px-5 py-2.5 font-semibold text-white">
          Go to my classes
        </Link>
      </Centered>
    );
  }
  if (!data) {
    return <Centered>{failed ? <p className="text-slate-600">Couldn&apos;t load the class. Retrying…</p> : <Spinner />}</Centered>;
  }

  const learners = data.students;
  const savedRun = selected ? [...data.runs].reverse().find((r) => r.assignmentId === selected.id && r.status !== "running") ?? null : null;
  const shownRun = live && live.assignmentId === selected?.id ? live : null;
  const madeBy = (run: CopilotRun | null) => (run ? data.assignments.filter((a) => run.createdAssignmentIds.includes(a.id)) : []);
  const solvedCount = asks.filter((a) => a.solved).length;
  const askingLearners = new Set(asks.map((a) => a.studentId)).size;

  async function explain() {
    if (!selected || !seat) return;
    setThinking(true);
    setInsightError(null);
    try {
      const page = await renderSpots(selected.sheet, clusters);
      const result = await classInsight(code, seat.teacherKey, selected.id, page);
      setInsights((all) => ({ ...all, [selected.id]: { insight: result.insight, at: result.at } }));
    } catch (e) {
      setInsightError(e instanceof Error && e.message === "rate_limited" ? "One moment, then try again." : "A-Note couldn't read the class just now.");
    } finally {
      setThinking(false);
    }
  }

  async function copilot() {
    if (!selected || !seat) return;
    const assignmentId = selected.id;
    setLive({ assignmentId, steps: [], made: [], run: null, running: true, error: null });
    const patch = (change: (l: LiveRun) => Partial<LiveRun>) => setLive((l) => (l && l.assignmentId === assignmentId ? { ...l, ...change(l) } : l));
    try {
      const page = await renderSpots(selected.sheet, clusters);
      await runCopilot(code, seat.teacherKey, { assignmentId, page }, (event) => {
        if (event.type === "step") patch((l) => ({ steps: [...l.steps, event.step as RunStep] }));
        if (event.type === "assignment") {
          const made = event.assignment as Assignment;
          patch((l) => ({ made: [...l.made, made] }));
          setData((d) => (d ? { ...d, assignments: [...d.assignments, made] } : d));
        }
        if (event.type === "done") patch(() => ({ run: event.run as CopilotRun }));
        if (event.type === "error") patch(() => ({ error: "The co-pilot hit a problem. What it finished is kept." }));
      });
    } catch (e) {
      patch(() => ({ error: e instanceof Error && e.message === "rate_limited" ? "One moment, then try again." : "The co-pilot couldn't start just now." }));
    } finally {
      patch(() => ({ running: false }));
    }
  }

  async function remove(assignmentId: string) {
    if (!seat || !window.confirm("Remove this worksheet and its circles from the class?")) return;
    await unassign(code, seat.teacherKey, assignmentId).catch(() => undefined);
    setData((d) => (d ? { ...d, assignments: d.assignments.filter((a) => a.id !== assignmentId), asks: d.asks.filter((a) => a.assignmentId !== assignmentId) } : d));
    setSelectedId(null);
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-sky-50 via-white to-white">
      <TopBar href="/teacher">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{data.classRoom.name}</p>
          <p className="truncate text-xs text-slate-500">{data.classRoom.teacherName}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700 ring-1 ring-emerald-200 sm:flex">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
          <button type="button" onClick={() => setCodeOpen(true)} className="rounded-xl bg-slate-900 px-3 py-2 font-mono text-sm font-semibold tracking-widest text-white">
            {formatCode(code)}
          </button>
        </div>
      </TopBar>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-3">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Worksheets</p>
          {assignments.map((a) => {
            const count = data.asks.filter((x) => x.assignmentId === a.id).length;
            const isSelected = selected?.id === a.id;
            return (
              <motion.button
                key={a.id}
                layout
                type="button"
                onClick={() => {
                  setSelectedId(a.id);
                  setActiveSpot(null);
                }}
                className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left ring-1 transition ${isSelected ? "bg-white shadow-md ring-orange-200" : "ring-transparent hover:bg-white/70"}`}
              >
                <Image src={a.sheet.src} alt="" width={40} height={56} unoptimized className="h-14 w-10 rounded-lg object-cover object-top ring-1 ring-slate-200" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-800">{a.sheet.title}</span>
                  <span className="text-xs text-slate-500">
                    {a.studentIds ? `For ${a.studentIds.length} ${a.studentIds.length === 1 ? "learner" : "learners"} · ` : ""}
                    {count} asked
                  </span>
                  {(a.origin === "copilot" || a.origin === "generated") && (
                    <span className="mt-1 inline-block rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700 ring-1 ring-orange-100">
                      {a.origin === "copilot" ? "Co-pilot practice" : "Written by A-Note"}
                    </span>
                  )}
                </span>
              </motion.button>
            );
          })}
          <button
            type="button"
            onClick={() => setAssignOpen(true)}
            className="w-full rounded-2xl border-2 border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-600 hover:border-orange-300 hover:text-orange-600"
          >
            + Assign a worksheet
          </button>
        </aside>

        {selected ? (
          <section className="min-w-0 space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{selected.sheet.title}</h1>
              {selected.sheet.subject && (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${subjectStyle(selected.sheet.subject)}`}>{selected.sheet.subject}</span>
              )}
              <button type="button" onClick={() => remove(selected.id)} className="ml-auto text-sm text-slate-400 hover:text-rose-600">
                Remove
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Questions asked" value={asks.length} />
              <Stat label="Learners asking" value={`${askingLearners}/${learners.length}`} />
              <Stat label="Solved after hints" value={asks.length ? `${Math.round((solvedCount / asks.length) * 100)}%` : "—"} />
              <Stat label="Work checked · correct" value={checks.length ? `${checks.length} · ${checks.filter((c) => c.solved).length}` : "—"} />
            </div>

            {!selected.studentIds && (
              <CopilotPanel
                run={shownRun ? shownRun.run : savedRun}
                steps={shownRun ? shownRun.steps : (savedRun?.steps ?? [])}
                running={Boolean(shownRun?.running)}
                made={shownRun ? shownRun.made : madeBy(savedRun)}
                students={learners}
                error={shownRun?.error ?? null}
                onRun={copilot}
                canRun={allAsks.length > 0}
              />
            )}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <ClassHeatmap sheet={selected.sheet} asks={asks} clusters={clusters} active={activeSpot} onSelect={setActiveSpot} />
              <SpotsPanel
                clusters={clusters}
                active={activeSpot}
                onSelect={setActiveSpot}
                insight={insights[selected.id] ?? null}
                thinking={thinking}
                error={insightError}
                onExplain={explain}
              />
            </div>

            <Learners data={data} assignment={selected} now={now} onView={setViewing} />
          </section>
        ) : (
          <section className="grid place-items-center rounded-3xl bg-white p-10 text-center ring-1 ring-slate-200">
            <div className="max-w-sm space-y-4">
              <Image src="/brand/peek.webp" alt="" width={180} height={178} className="mx-auto h-[178px] w-[180px]" />
              <p className="text-lg font-semibold text-slate-900">Assign your first worksheet</p>
              <p className="text-slate-500">Then put the class code on the board. Circles show up here the moment learners ask.</p>
              <button type="button" onClick={() => setAssignOpen(true)} className="rounded-xl bg-orange-500 px-5 py-2.5 font-semibold text-white">
                Choose a worksheet
              </button>
            </div>
          </section>
        )}
      </main>

      <AssignModal
        open={assignOpen}
        code={code}
        teacherKey={seat.teacherKey}
        assigned={assignments}
        onClose={() => setAssignOpen(false)}
        onAssigned={(a) => {
          setData((d) => (d ? { ...d, assignments: [...d.assignments, a] } : d));
          setSelectedId(a.id);
        }}
      />
      {selected && (
        <WorkViewer
          code={code}
          teacherKey={seat.teacherKey}
          assignment={selected}
          students={learnersFor(data, selected)}
          asks={allAsks}
          work={data.work.filter((w) => w.assignmentId === selected.id)}
          studentId={viewing}
          now={now}
          onSelect={setViewing}
          onSaved={(w) => setData((d) => (d ? { ...d, work: [...d.work.filter((x) => x.id !== w.id), w] } : d))}
        />
      )}
      <JoinCodeModal open={codeOpen} code={code} className={data.classRoom.name} onClose={() => setCodeOpen(false)} />
    </div>
  );
}

/** The learners an assignment is for: everyone, or the group it was made for. */
function learnersFor(data: Dashboard, assignment: Assignment): Student[] {
  return data.students.filter((s) => !assignment.studentIds || assignment.studentIds.includes(s.id));
}

function Learners({ data, assignment, now, onView }: { data: Dashboard; assignment: Assignment; now: number; onView: (studentId: string) => void }) {
  const assignmentId = assignment.id;
  const handedIn = data.work.filter((w) => w.assignmentId === assignmentId && w.status === "handed_in").length;
  const students = learnersFor(data, assignment);
  const rows = students
    .map((s) => {
      const all = data.asks.filter((a) => a.studentId === s.id && a.assignmentId === assignmentId);
      const mine = all.filter((a) => a.kind !== "check");
      const checked = all.filter((a) => a.kind === "check");
      return {
        student: s,
        asks: mine.length,
        solved: mine.filter((a) => a.solved).length,
        hints: mine.reduce((sum, a) => sum + a.hintsSeen, 0),
        work: data.work.find((w) => w.assignmentId === assignmentId && w.studentId === s.id) ?? null,
        right: checked.filter((a) => a.solved).length,
        slips: checked.filter((a) => !a.solved).length,
      };
    })
    .sort((a, b) => b.asks - a.asks || b.student.lastSeenAt.localeCompare(a.student.lastSeenAt));

  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex items-center gap-3">
        <p className="font-semibold text-slate-900">Learners</p>
        {students.length > 0 && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
            Handed in {handedIn}/{students.length}
          </span>
        )}
        <span className="ml-auto hidden text-xs text-slate-400 sm:block">Tap a learner to see their page</span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Nobody has joined yet. Share the class code.</p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="py-2 font-medium">Name</th>
              <th className="py-2 text-right font-medium">Asked</th>
              <th className="py-2 text-right font-medium">Solved</th>
              <th className="hidden py-2 text-right font-medium sm:table-cell">Hints used</th>
              <th className="py-2 text-right font-medium">Checked</th>
              <th className="py-2 text-right font-medium">Work</th>
              <th className="hidden py-2 text-right font-medium md:table-cell">Last active</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {rows.map((r) => (
                <motion.tr key={r.student.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-t border-slate-100">
                  <td className="py-2.5 font-medium text-slate-800">
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${isLive(r.student.lastSeenAt, now) ? "bg-emerald-500" : "bg-slate-300"}`} />
                      {r.student.name}
                    </span>
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{r.asks}</td>
                  <td className="py-2.5 text-right tabular-nums">{r.solved}</td>
                  <td className="hidden py-2.5 text-right tabular-nums sm:table-cell">{r.hints}</td>
                  <td className="py-2.5 text-right tabular-nums">
                    {r.right + r.slips === 0 ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <>
                        {r.right > 0 && <span className="text-emerald-600">✓{r.right}</span>} {r.slips > 0 && <span className="text-rose-600">✗{r.slips}</span>}
                      </>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    <button type="button" onClick={() => onView(r.student.id)} className="rounded-lg px-2 py-1 text-xs font-semibold ring-1 ring-slate-200 hover:bg-slate-50">
                      {r.work?.status === "handed_in" ? (
                        <span className="text-emerald-700">Handed in ✓</span>
                      ) : r.work?.strokeCount ? (
                        <span className="text-slate-600">In progress</span>
                      ) : (
                        <span className="text-slate-400">View</span>
                      )}
                    </button>
                  </td>
                  <td className="hidden py-2.5 text-right text-slate-500 md:table-cell">{timeAgo(r.student.lastSeenAt, now)}</td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200">
      <motion.p key={String(value)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-semibold tabular-nums text-slate-900">
        {value}
      </motion.p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">{children}</div>;
}

function Spinner() {
  return <span className="h-8 w-8 animate-spin rounded-full border-4 border-orange-100 border-t-orange-500" />;
}
