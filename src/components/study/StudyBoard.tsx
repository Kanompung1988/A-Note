"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { askTutor, replyTutor, segment, type Region } from "@/lib/ai/api";
import { captureRegion, type Capture } from "@/lib/ink/capture";
import type { Box, Stroke } from "@/lib/ink/geometry";
import { newId } from "@/lib/ink/storage";
import { SAMPLE_SHEETS, sheetFromFile, type Sheet } from "@/lib/sheets";
import type { BoardOverlay } from "@/components/worksheet/Worksheet";
import { AskPanel, type Session } from "./AskPanel";

// The worksheet reads saved ink from localStorage on first render, so it only renders in the browser.
const Worksheet = dynamic(() => import("@/components/worksheet/Worksheet"), {
  ssr: false,
  loading: () => <div className="flex-1 bg-slate-100" />,
});

export default function StudyBoard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<Sheet>(SAMPLE_SHEETS[0]);
  const [session, setSession] = useState<Session | null>(null);

  // Only apply results that belong to the session still on screen.
  function update(id: string, change: (s: Session) => Partial<Session>) {
    setSession((s) => (s && s.id === id ? { ...s, ...change(s) } : s));
  }

  async function handleAsk(strokes: Stroke[], loop: Box) {
    const id = newId();
    setSession({ id, capture: null, region: undefined, turns: [], revealed: 0, solved: false, status: "thinking" });
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
      .then(({ region }) => update(id, () => ({ region })))
      .catch(() => update(id, () => ({ region: null })));

    runTutor(id, capture);
  }

  function runTutor(id: string, capture: Capture) {
    update(id, () => ({ status: "thinking", error: undefined }));
    askTutor({ crop: capture.crop, page: capture.page })
      .then(({ responseId, hints }) => update(id, () => ({ responseId, hints, revealed: 1, status: "ready" })))
      .catch(() => update(id, () => ({ status: "error", error: "A-Note couldn't answer just now." })));
  }

  function sendReply(message: string) {
    if (!session?.responseId) return;
    const { id, responseId } = session;
    update(id, (s) => ({ turns: [...s.turns, { role: "learner", text: message }], status: "thinking", error: undefined }));
    replyTutor({ responseId, message })
      .then((r) =>
        update(id, (s) => ({
          responseId: r.responseId,
          turns: [...s.turns, { role: "tutor", text: r.reply }],
          solved: s.solved || r.solved,
          status: "ready",
        })),
      )
      .catch(() => update(id, () => ({ status: "error", error: "That didn't send. Try again." })));
  }

  async function openFile(file: File | undefined) {
    if (!file) return;
    setSheet(await sheetFromFile(file));
    setSession(null);
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <Image src="/brand/icon.png" alt="" width={32} height={32} className="rounded-lg" />
          A-Note
        </Link>
        <span className="truncate text-sm text-slate-500">{sheet.title}</span>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="ml-auto shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Open my worksheet
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
      </header>
      <div className="flex min-h-0 flex-1">
        <Worksheet key={sheet.id} sheet={sheet} overlay={toOverlay(session)} onAsk={handleAsk} />
        {session && (
          <AskPanel
            session={session}
            onNextHint={() => update(session.id, (s) => ({ revealed: Math.min(s.revealed + 1, s.hints?.steps.length ?? 0) }))}
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
  const { loop, pageImage } = session.capture;
  return {
    loop,
    region: session.region ? toPageSpace(session.region, pageImage.scale) : null,
    note: noteFor(session),
  };
}

function toPageSpace(region: Region, scale: number): NonNullable<BoardOverlay["region"]> {
  return {
    box: {
      x: region.left / scale,
      y: region.top / scale,
      w: (region.right - region.left) / scale,
      h: (region.bottom - region.top) / scale,
    },
    path: region.path,
    maskWidth: region.maskWidth,
    maskHeight: region.maskHeight,
  };
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
