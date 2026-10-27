"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Hints, Region } from "@/lib/ai/api";
import type { Capture } from "@/lib/ink/capture";

export type Turn = { role: "learner" | "tutor"; text: string };

/** One question about one circled region. */
export type Session = {
  id: string;
  capture: Capture | null;
  /** undefined while SAM is still working, null when it found nothing */
  region: Region | null | undefined;
  hints?: Hints;
  responseId?: string;
  revealed: number;
  turns: Turn[];
  solved: boolean;
  status: "thinking" | "ready" | "error";
  error?: string;
};

type Props = {
  session: Session;
  onNextHint: () => void;
  onReply: (message: string) => void;
  onRetry: () => void;
  onClose: () => void;
};

/** Side panel (bottom sheet on narrow screens) for a question about a circled region. */
export function AskPanel({ session, onNextHint, onReply, onRetry, onClose }: Props) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { capture, hints, revealed, turns, status, solved } = session;
  const allHintsShown = hints ? revealed >= hints.steps.length : false;
  const canReply = Boolean(session.responseId) && status !== "thinking";

  // Keep the newest hint or message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [revealed, turns.length, status, solved]);

  function send() {
    const text = draft.trim();
    if (!text || !canReply) return;
    onReply(text);
    setDraft("");
  }

  return (
    <aside className="fixed inset-x-0 bottom-0 z-30 flex h-[60dvh] flex-col rounded-t-2xl bg-white shadow-2xl md:static md:h-auto md:w-[400px] md:rounded-none md:border-l md:border-slate-200 md:shadow-none">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <Image src="/brand/icon.png" alt="" width={32} height={32} className="rounded-lg" />
        <h2 className="font-semibold text-slate-800">Ask A-Note</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="ml-auto px-2 text-2xl leading-none text-slate-400">
          ×
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {capture ? (
          <Image
            src={capture.crop}
            alt="What you circled"
            width={Math.round(capture.region.w)}
            height={Math.round(capture.region.h)}
            unoptimized
            className="max-h-36 w-full rounded-lg border border-slate-200 object-contain"
          />
        ) : (
          <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
        )}

        <Badges session={session} />

        {hints?.steps.slice(0, revealed).map((step, i) => (
          <div key={i} className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Hint {i + 1}</p>
            <p className="text-[15px] leading-snug text-slate-800">{step}</p>
          </div>
        ))}

        {hints && !allHintsShown && !solved && (
          <button
            type="button"
            onClick={onNextHint}
            className="w-full rounded-xl border border-amber-300 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50"
          >
            Next hint
          </button>
        )}

        {hints && allHintsShown && (
          <div className="rounded-xl bg-sky-50 p-3 ring-1 ring-sky-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Your turn</p>
            <p className="text-[15px] leading-snug text-slate-800">{hints.check}</p>
          </div>
        )}

        {turns.map((turn, i) =>
          turn.role === "learner" ? (
            <p key={i} className="ml-8 rounded-2xl rounded-br-sm bg-slate-800 px-3 py-2 text-[15px] text-white">
              {turn.text}
            </p>
          ) : (
            <p key={i} className="mr-8 rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-[15px] text-slate-800">
              {turn.text}
            </p>
          ),
        )}

        {solved && (
          <p className="rounded-xl bg-emerald-50 p-3 text-[15px] font-medium text-emerald-800 ring-1 ring-emerald-200">
            You solved it yourself. Circle the next thing you&apos;re unsure about.
          </p>
        )}

        {status === "thinking" && (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <span className="inline-block h-2 w-2 animate-ping rounded-full bg-orange-400" />
            {hints ? "A-Note is reading your answer…" : "A-Note is looking at what you circled…"}
          </p>
        )}

        {status === "error" && (
          <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200">
            {session.error}{" "}
            {!hints && (
              <button type="button" onClick={onRetry} className="font-semibold underline">
                Try again
              </button>
            )}
          </div>
        )}
      </div>

      <form
        className="flex items-end gap-2 border-t border-slate-100 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder={hints ? "Type your answer or a question…" : "Wait a moment…"}
          disabled={!session.responseId}
          className="min-h-11 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-[15px] outline-none focus:border-sky-400 disabled:bg-slate-50"
        />
        <button
          type="submit"
          disabled={!canReply || !draft.trim()}
          className="h-11 rounded-xl bg-orange-500 px-4 font-semibold text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </aside>
  );
}

function Badges({ session }: { session: Session }) {
  const { hints, region } = session;
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {hints && (
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
          I see: <span className="font-medium">{hints.circled}</span>
        </span>
      )}
      {hints && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{hints.topic}</span>}
      {region && (
        <span className="rounded-full bg-orange-50 px-2.5 py-1 text-orange-700 ring-1 ring-orange-200" title="Segmented by SAM 3.1">
          Outlined by SAM 3.1
        </span>
      )}
    </div>
  );
}
