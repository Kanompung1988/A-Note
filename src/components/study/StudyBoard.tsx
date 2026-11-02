"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { askTutor, checkWork, drawPicture, replyTutor, segment, type KeyContext } from "@/lib/ai/api";
import { recordAsk, updateAskRecord, type AskProgress } from "@/lib/class/api";
import { captureRegion, captureWork, type Capture } from "@/lib/ink/capture";
import { expandBox, type Box, type Stroke } from "@/lib/ink/geometry";
import { blockBox, inkLines, workBlock, writingStrokes } from "@/lib/ink/lines";
import { newId } from "@/lib/ink/storage";
import { toPageSpace } from "@/lib/regions";
import { questionAt, SAMPLE_SHEETS, sheetFromFile, type Sheet } from "@/lib/sheets";
import type { BoardOverlay, WorkMarks } from "@/components/worksheet/Worksheet";
import { AskPanel, type Session } from "./AskPanel";
import { CheckPanel, type CheckSession } from "./CheckPanel";

// The worksheet reads saved ink from localStorage on first render, so it only renders in the browser.
const Worksheet = dynamic(() => import("@/components/worksheet/Worksheet"), {
  ssr: false,
  loading: () => <div className="flex-1 bg-slate-100" />,
});

/** When set, every ask is recorded for the teacher's dashboard. */
export type ClassContext = { code: string; studentId: string; assignmentId: string };

type Props = {
  initialSheet?: Sheet;
  /** solo practice lets the learner switch sheets or open a photo; class work is fixed */
  allowSheetChange?: boolean;
  classContext?: ClassContext;
  /** shown in the header next to the logo */
  subtitle?: ReactNode;
  backHref?: string;
  /** class work saved from another device, used when this one has none */
  initialStrokes?: Stroke[];
  /** every change to the ink (class work autosaves through this) */
  onInkChange?: (strokes: Stroke[]) => void;
  /** extra toolbar actions, e.g. "Hand in" */
  toolbarActions?: ReactNode;
  /** shown above the page, e.g. the teacher's note */
  banner?: ReactNode;
};

/** Checking looks at the most recent block of working, at most this many lines. */
const MAX_CHECK_LINES = 12;

export default function StudyBoard({
  initialSheet = SAMPLE_SHEETS[0],
  allowSheetChange = true,
  classContext,
  subtitle,
  backHref = "/",
  initialStrokes,
  onInkChange,
  toolbarActions,
  banner,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  // session id → the recorded ask id, so progress can be sent before the record call returns
  const recordsRef = useRef(new Map<string, Promise<string | null>>());
  const strokesRef = useRef<Stroke[]>([]);
  const [sheet, setSheet] = useState<Sheet>(initialSheet);
  const [session, setSession] = useState<Session | null>(null);
  const [check, setCheck] = useState<CheckSession | null>(null);

  // Only apply results that belong to the session still on screen.
  function update(id: string, change: (s: Session) => Partial<Session>) {
    setSession((s) => (s && s.id === id ? { ...s, ...change(s) } : s));
  }

  function updateCheck(id: string, change: Partial<CheckSession>) {
    setCheck((c) => (c && c.id === id ? { ...c, ...change } : c));
  }

  /** Lets the server find the teacher's answer key for this question. */
  function keyContext(question: number | null): KeyContext | undefined {
    if (classContext) return { question, source: classContext };
    if (SAMPLE_SHEETS.some((s) => s.id === sheet.id)) return { question, source: { sampleId: sheet.id } };
    return undefined;
  }

  function record(id: string, loop: Box, kind: "ask" | "check") {
    if (!classContext) return;
    recordsRef.current.set(
      id,
      recordAsk({ ...classContext, loop, kind }).then(
        (r) => r.id,
        () => null,
      ),
    );
  }

  function track(id: string, progress: AskProgress) {
    if (!classContext) return;
    void recordsRef.current
      .get(id)
      ?.then((askId) => (askId ? updateAskRecord(askId, classContext.studentId, progress) : undefined))
      .catch(() => undefined);
  }

  async function handleAsk(strokes: Stroke[], loop: Box) {
    const id = newId();
    strokesRef.current = strokes;
    setCheck(null);
    setSession({ id, capture: null, region: undefined, turns: [], revealed: 0, solved: false, status: "thinking", question: questionAt(sheet, loop) });
    record(id, loop, "ask");

    let capture: Capture;
    try {
      capture = await captureRegion(sheet, strokes, loop);
    } catch {
      update(id, () => ({ status: "error", error: "Couldn't read this page. Try again." }));
      return;
    }
    update(id, () => ({ capture }));

    const { scale, width, height } = capture.pageImage;
    segment({
      image: capture.page,
      size: { width, height },
      box: { x: loop.x * scale, y: loop.y * scale, w: loop.w * scale, h: loop.h * scale },
    })
      .then(({ region }) => {
        const pageRegion = region ? toPageSpace(region, scale) : null;
        update(id, () => ({ region: pageRegion }));
        track(id, { region: pageRegion });
      })
      .catch(() => update(id, () => ({ region: null })));

    runTutor(id, capture, questionAt(sheet, loop));
  }

  function runTutor(id: string, capture: Capture, question: number | null) {
    update(id, () => ({ status: "thinking", error: undefined }));
    askTutor({ crop: capture.crop, page: capture.page, context: keyContext(question) })
      .then(({ responseId, hints, grounded }) => {
        update(id, () => ({ responseId, hints, grounded, revealed: 1, status: "ready" }));
        track(id, { circled: hints.circled, topic: hints.topic, hintsSeen: 1 });
      })
      .catch(() => update(id, () => ({ status: "error", error: "A-Note couldn't answer just now." })));
  }

  function nextHint() {
    if (!session?.hints) return;
    const revealed = Math.min(session.revealed + 1, session.hints.steps.length);
    update(session.id, () => ({ revealed }));
    track(session.id, { hintsSeen: revealed });
  }

  function showPicture() {
    if (!session?.hints?.picture) return;
    const { id } = session;
    update(id, () => ({ picture: { status: "drawing" } }));
    drawPicture(session.hints.picture)
      .then(({ image }) => update(id, () => ({ picture: { status: "ready", image } })))
      .catch(() => update(id, () => ({ picture: { status: "error" } })));
  }

  function sendReply(message: string) {
    if (!session?.responseId) return;
    const { id, responseId, question } = session;
    const replies = session.turns.filter((t) => t.role === "learner").length + 1;
    update(id, (s) => ({ turns: [...s.turns, { role: "learner", text: message }], status: "thinking", error: undefined }));
    replyTutor({ responseId, message, context: keyContext(question) })
      .then((r) => {
        update(id, (s) => ({
          responseId: r.responseId,
          turns: [...s.turns, { role: "tutor", text: r.reply }],
          solved: s.solved || r.solved,
          status: "ready",
        }));
        track(id, { replies, solved: r.solved });
      })
      .catch(() => update(id, () => ({ status: "error", error: "That didn't send. Try again." })));
  }

  async function handleCheck(strokes: Stroke[]) {
    strokesRef.current = strokes;
    const writing = writingStrokes(strokes);
    const latest = writing[writing.length - 1];
    if (!latest) return;
    const lines = inkLines(strokes, sheet.width);
    const latestLine = lines.find((l) => l.strokeIds.includes(latest.id));
    const question = latestLine ? questionAt(sheet, latestLine.box) : null;
    const questionBox = sheet.questions?.find((q) => q.n === question)?.box ?? null;
    let block = workBlock(lines, latest.id, questionBox);
    if (!block.length) block = workBlock(lines, latest.id);
    block = block.slice(-MAX_CHECK_LINES);
    const area = blockBox(block);
    if (!area) return;

    const id = newId();
    setSession(null);
    setCheck({ id, status: "checking", lines: block.map((l) => l.box), question, area });
    record(id, area, "check");

    try {
      const work = await captureWork(
        sheet,
        strokes,
        block.map((l) => l.box),
        questionBox,
      );
      const { check: result, grounded } = await checkWork({ crop: work.crop, page: work.page, lineCount: block.length, context: keyContext(question) });
      updateCheck(id, { status: "done", result, grounded });
      const slipLine = result.lines.find((l) => l.n === result.first_slip);
      track(id, {
        circled: slipLine?.read ?? result.lines[result.lines.length - 1]?.read,
        topic: result.question.slice(0, 200),
        slip: result.first_slip ? result.slip.slice(0, 500) : null,
        solved: result.all_correct,
      });
    } catch {
      updateCheck(id, { status: "error" });
    }
  }

  /** From a marked slip, open the tutor on exactly that line. */
  function askAboutSlip() {
    if (!check?.result?.first_slip) return;
    const line = check.lines[check.result.first_slip - 1];
    if (!line) return;
    void handleAsk(strokesRef.current, expandBox(line, sheet.width * 0.01, sheet));
  }

  async function openFile(file: File | undefined) {
    if (!file) return;
    setSheet(await sheetFromFile(file));
    setSession(null);
    setCheck(null);
  }

  return (
    <div className="flex h-dvh flex-col bg-white">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <Link href={backHref} className="flex items-center gap-2 font-semibold text-slate-900">
          <Image src="/brand/icon.png" alt="" width={32} height={32} className="rounded-lg" />
          A-Note
        </Link>
        <span className="min-w-0 truncate text-sm text-slate-500">{subtitle ?? sheet.title}</span>
        {allowSheetChange && (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <select
              aria-label="Sample worksheet"
              value={SAMPLE_SHEETS.some((s) => s.id === sheet.id) ? sheet.id : ""}
              onChange={(e) => {
                const next = SAMPLE_SHEETS.find((s) => s.id === e.target.value);
                if (next) {
                  setSheet(next);
                  setSession(null);
                  setCheck(null);
                }
              }}
              className="hidden rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 sm:block"
            >
              {!SAMPLE_SHEETS.some((s) => s.id === sheet.id) && <option value="">{sheet.title}</option>}
              {SAMPLE_SHEETS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Open a photo
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                void openFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        )}
      </header>
      {banner}
      <div className="flex min-h-0 flex-1">
        <Worksheet
          key={sheet.id}
          sheet={sheet}
          overlay={toOverlay(session)}
          marks={toMarks(check)}
          initialStrokes={initialStrokes}
          onAsk={handleAsk}
          onCheck={handleCheck}
          onChange={onInkChange}
          actions={toolbarActions}
        />
        {session && (
          <AskPanel
            session={session}
            onNextHint={nextHint}
            onReply={sendReply}
            onPicture={showPicture}
            onRetry={() => session.capture && runTutor(session.id, session.capture, session.question)}
            onClose={() => setSession(null)}
          />
        )}
        {!session && check && (
          <CheckPanel check={check} onAskAboutSlip={askAboutSlip} onRetry={() => void handleCheck(strokesRef.current)} onClose={() => setCheck(null)} />
        )}
      </div>
    </div>
  );
}

/** Turns the session into what the tutor draws on the page. */
function toOverlay(session: Session | null): BoardOverlay | null {
  if (!session?.capture) return null;
  return { loop: session.capture.loop, region: session.region ?? null, note: noteFor(session) };
}

function noteFor(session: Session): BoardOverlay["note"] {
  if (session.solved) return { label: "You got it", text: "You solved it yourself. Nice work.", tone: "done" };
  const lastTutor = [...session.turns].reverse().find((t) => t.role === "tutor");
  if (lastTutor) return { label: "A-Note", text: lastTutor.text, tone: "hint" };
  if (session.hints && session.revealed > 0) {
    return { label: `Hint ${session.revealed} of ${session.hints.steps.length}`, text: session.hints.steps[session.revealed - 1], tone: "hint" };
  }
  if (session.status === "thinking") return { label: "A-Note", text: "Looking at what you circled…", tone: "thinking" };
  return null;
}

/** Turns a check into the red pen and ticks drawn on the page. */
function toMarks(check: CheckSession | null): WorkMarks | null {
  if (!check || check.status === "error") return null;
  if (check.status === "checking" || !check.result) {
    return {
      id: check.id,
      status: "checking",
      lines: check.lines.map((box) => ({ box, state: "checking" })),
      allCorrect: false,
      note: { label: "A-Note", text: `Reading your ${check.lines.length} ${check.lines.length === 1 ? "line" : "lines"} of working…`, tone: "thinking" },
      anchor: check.area,
    };
  }
  const { result } = check;
  const slip = result.first_slip;
  return {
    id: `${check.id}-done`,
    status: "done",
    lines: check.lines.map((box, i) => {
      const n = i + 1;
      const read = result.lines.find((l) => l.n === n);
      if (slip && n === slip) return { box, state: "slip" };
      if (slip && n > slip) return { box, state: "plain" };
      return { box, state: read?.ok === false ? "plain" : "ok" };
    }),
    allCorrect: result.all_correct,
    note: result.all_correct
      ? { label: "All correct", text: result.praise || "Every line is right. Nice work.", tone: "done" }
      : slip
        ? { label: `Look at line ${slip}`, text: `${result.slip} ${result.hint}`.trim(), tone: "slip" }
        : { label: "Almost", text: result.hint || "Your working looks right so far. Keep going to the final answer.", tone: "hint" },
    // below or beside the whole block, so the note never hides the working it talks about
    anchor: check.area,
  };
}
