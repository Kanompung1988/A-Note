"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Hints } from "@/lib/ai/api";
import type { Capture } from "@/lib/ink/capture";
import type { PageRegion } from "@/lib/regions";
import { VoiceButton } from "./VoiceButton";

export type Turn = { role: "learner" | "tutor"; text: string };

/** One question about one circled region. */
export type Session = {
  id: string;
  capture: Capture | null;
  /** undefined while SAM is still working, null when it found nothing */
  region: PageRegion | null | undefined;
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

const appear = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.25 } };

/** Side panel (bottom sheet on narrow screens) for a question about a circled region. */
export function AskPanel({ session, onNextHint, onReply, onRetry, onClose }: Props) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
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
    <motion.aside
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="fixed inset-x-0 bottom-0 z-30 flex h-[62dvh] flex-col rounded-t-3xl bg-white shadow-2xl md:static md:h-auto md:w-[400px] md:rounded-none md:border-l md:border-slate-200 md:shadow-none"
    >
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <Image src="/brand/icon.png" alt="" width={32} height={32} className="rounded-lg" />
        <h2 className="font-semibold text-slate-800">Ask A-Note</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="ml-auto rounded-lg px-2 text-2xl leading-none text-slate-400 hover:bg-slate-100">
          ×
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {capture ? (
          <motion.div {...appear}>
            <Image
              src={capture.crop}
              alt="What you circled"
              width={Math.round(capture.region.w)}
              height={Math.round(capture.region.h)}
              unoptimized
              className="max-h-36 w-full rounded-xl border border-slate-200 object-contain"
            />
          </motion.div>
        ) : (
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
        )}

        <Badges session={session} />

        <AnimatePresence initial={false}>
          {hints?.steps.slice(0, revealed).map((step, i) => (
            <motion.div key={`hint-${i}`} {...appear} className="rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Hint {i + 1}</p>
              <p className="text-[15px] leading-snug text-slate-800">{step}</p>
            </motion.div>
          ))}
        </AnimatePresence>

        {hints && !allHintsShown && !solved && (
          <motion.button
            {...appear}
            type="button"
            onClick={onNextHint}
            whileTap={{ scale: 0.97 }}
            className="w-full rounded-2xl border border-amber-300 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50"
          >
            Next hint
          </motion.button>
        )}

        {hints && allHintsShown && !solved && (
          <motion.div {...appear} className="rounded-2xl bg-sky-50 p-3 ring-1 ring-sky-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Your turn</p>
            <p className="text-[15px] leading-snug text-slate-800">{hints.check}</p>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {turns.map((turn, i) =>
            turn.role === "learner" ? (
              <motion.p key={i} {...appear} className="ml-8 rounded-2xl rounded-br-sm bg-slate-800 px-3 py-2 text-[15px] text-white">
                {turn.text}
              </motion.p>
            ) : (
              <motion.p key={i} {...appear} className="mr-8 rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-[15px] text-slate-800">
                {turn.text}
              </motion.p>
            ),
          )}
        </AnimatePresence>

        {solved && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-200"
          >
            <Image src="/brand/peek.webp" alt="" width={56} height={55} className="h-[55px] w-[56px] shrink-0" />
            <p className="text-[15px] font-medium text-emerald-800">You solved it yourself. Circle the next thing you&apos;re unsure about.</p>
          </motion.div>
        )}

        {status === "thinking" && (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <span className="inline-block h-2 w-2 animate-ping rounded-full bg-orange-400" />
            {hints ? "A-Note is reading your answer…" : "A-Note is looking at what you circled…"}
          </p>
        )}

        {status === "error" && (
          <div className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200">
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
        <VoiceButton
          disabled={!session.responseId}
          onText={(text) => {
            setDraft((d) => (d ? `${d} ${text}` : text));
            inputRef.current?.focus();
          }}
        />
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder={hints ? "Type or say your answer…" : "Wait a moment…"}
          disabled={!session.responseId}
          className="min-h-11 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-[15px] outline-none focus:border-sky-400 disabled:bg-slate-50"
        />
        <motion.button
          whileTap={{ scale: 0.94 }}
          type="submit"
          disabled={!canReply || !draft.trim()}
          className="h-11 rounded-xl bg-orange-500 px-4 font-semibold text-white disabled:opacity-40"
        >
          Send
        </motion.button>
      </form>
    </motion.aside>
  );
}

function Badges({ session }: { session: Session }) {
  const { hints, region } = session;
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {hints && (
        <motion.span {...appear} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
          I see: <span className="font-medium">{hints.circled}</span>
        </motion.span>
      )}
      {hints && (
        <motion.span {...appear} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
          {hints.topic}
        </motion.span>
      )}
      {region && (
        <motion.span {...appear} className="rounded-full bg-orange-50 px-2.5 py-1 text-orange-700 ring-1 ring-orange-200" title="Segmented by SAM 3.1">
          Outlined by SAM 3.1
        </motion.span>
      )}
    </div>
  );
}
