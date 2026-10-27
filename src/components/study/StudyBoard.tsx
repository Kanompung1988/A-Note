"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { askTutor, replyTutor, segment } from "@/lib/ai/api";
import { recordAsk, updateAskRecord, type AskProgress } from "@/lib/class/api";
import { captureRegion, type Capture } from "@/lib/ink/capture";
import type { Box, Stroke } from "@/lib/ink/geometry";
import { newId } from "@/lib/ink/storage";
import { toPageSpace } from "@/lib/regions";
import { SAMPLE_SHEETS, sheetFromFile, type Sheet } from "@/lib/sheets";
import type { BoardOverlay } from "@/components/worksheet/Worksheet";
import { AskPanel, type Session } from "./AskPanel";

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
};

export default function StudyBoard({ initialSheet = SAMPLE_SHEETS[0], allowSheetChange = true, classContext, subtitle, backHref = "/" }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  // session id → the recorded ask id, so progress can be sent before the record call returns
  const recordsRef = useRef(new Map<string, Promise<string | null>>());
  const [sheet, setSheet] = useState<Sheet>(initialSheet);
  const [session, setSession] = useState<Session | null>(null);

  // Only apply results that belong to the session still on screen.
  function update(id: string, change: (s: Session) => Partial<Session>) {
    setSession((s) => (s && s.id === id ? { ...s, ...change(s) } : s));
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
    setSession({ id, capture: null, region: undefined, turns: [], revealed: 0, solved: false, status: "thinking" });
    if (classContext) {
      recordsRef.current.set(
        id,
        recordAsk({ ...classContext, loop }).then(
          (r) => r.id,
          () => null,
        ),
      );
    }

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

    runTutor(id, capture);
  }

  function runTutor(id: string, capture: Capture) {
    update(id, () => ({ status: "thinking", error: undefined }));
    askTutor({ crop: capture.crop, page: capture.page })
      .then(({ responseId, hints }) => {
        update(id, () => ({ responseId, hints, revealed: 1, status: "ready" }));
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

  function sendReply(message: string) {
    if (!session?.responseId) return;
    const { id, responseId } = session;
    const replies = session.turns.filter((t) => t.role === "learner").length + 1;
    update(id, (s) => ({ turns: [...s.turns, { role: "learner", text: message }], status: "thinking", error: undefined }));
    replyTutor({ responseId, message })
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

  async function openFile(file: File | undefined) {
    if (!file) return;
    setSheet(await sheetFromFile(file));
    setSession(null);
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
      <div className="flex min-h-0 flex-1">
        <Worksheet key={sheet.id} sheet={sheet} overlay={toOverlay(session)} onAsk={handleAsk} />
        {session && (
          <AskPanel
            session={session}
            onNextHint={nextHint}
            onReply={sendReply}
            onRetry={() => session.capture && runTutor(session.id, session.capture)}
            onClose={() => setSession(null)}
          />
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
