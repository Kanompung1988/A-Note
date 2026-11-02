"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import StudyBoard from "@/components/study/StudyBoard";
import { getClass, getMyWork, saveMyWork, type PublicClass, type WorkRecord } from "@/lib/class/api";
import { learnerSeat } from "@/lib/class/identity";
import type { Stroke } from "@/lib/ink/geometry";

const SAVE_AFTER_MS = 2000;

type SaveState = "idle" | "saving" | "saved" | "error";

/** Coordinates to a tenth of a pixel keep the saved page small without changing how it looks. */
function compact(strokes: Stroke[]): Stroke[] {
  const r = (n: number, d: number) => Math.round(n * d) / d;
  return strokes.map((s) => ({ ...s, points: s.points.map((p) => ({ x: r(p.x, 10), y: r(p.y, 10), p: r(p.p, 100) })) }));
}

/** A class worksheet: the study board, with every ask recorded and the page saved for the teacher. */
export default function LearnerWorksheet({ code, assignmentId }: { code: string; assignmentId: string }) {
  const seat = learnerSeat(code);
  const studentId = seat?.studentId;
  const [classRoom, setClassRoom] = useState<PublicClass | null>(null);
  const [saved, setSaved] = useState<{ work: WorkRecord | null; strokes: Stroke[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [handingIn, setHandingIn] = useState(false);
  const [editedSinceHandIn, setEditedSinceHandIn] = useState(false);
  const latest = useRef<Stroke[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seen = useRef(false);

  useEffect(() => {
    if (!studentId) return;
    getClass(code, studentId).then(setClassRoom, () => setFailed(true));
    getMyWork({ code, studentId, assignmentId }).then(setSaved, () => setSaved({ work: null, strokes: [] }));
  }, [code, studentId, assignmentId]);

  const work = saved?.work ?? null;

  const flush = useCallback(
    async (handIn = false) => {
      if (!studentId || !latest.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      setSaveState("saving");
      try {
        const { work: next } = await saveMyWork({ code, studentId, assignmentId }, compact(latest.current), handIn);
        setSaved((s) => ({ strokes: s?.strokes ?? [], work: next }));
        setSaveState("saved");
        if (handIn) setEditedSinceHandIn(false);
      } catch {
        setSaveState("error");
      }
    },
    [code, studentId, assignmentId],
  );

  const onInkChange = useCallback(
    (strokes: Stroke[]) => {
      latest.current = strokes;
      // the first call is the page as it loaded, not an edit
      if (!seen.current) {
        seen.current = true;
        return;
      }
      setEditedSinceHandIn(true);
      setSaveState("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_AFTER_MS);
    },
    [flush],
  );

  // Don't lose the last few seconds of writing when the tab closes.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && timer.current) void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [flush]);

  async function handIn() {
    setHandingIn(true);
    await flush(true);
    setHandingIn(false);
  }

  const assignment = classRoom?.assignments.find((a) => a.id === assignmentId);

  if (!seat || failed || (classRoom && !assignment)) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="space-y-4">
          <p className="text-lg font-semibold text-slate-900">{seat ? "This worksheet isn't available any more." : "Join this class first"}</p>
          <Link href={seat ? `/class/${code}` : `/join?code=${code}`} className="inline-block rounded-xl bg-orange-500 px-5 py-2.5 font-semibold text-white">
            {seat ? "Back to my class" : "Join"}
          </Link>
        </div>
      </div>
    );
  }
  if (!classRoom || !assignment || !saved) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-orange-100 border-t-orange-500" />
      </div>
    );
  }

  const handedIn = work?.status === "handed_in" && !editedSinceHandIn;

  return (
    <StudyBoard
      initialSheet={assignment.sheet}
      allowSheetChange={false}
      classContext={{ code: classRoom.code, studentId: seat.studentId, assignmentId }}
      subtitle={`${classRoom.name} · ${assignment.sheet.title}`}
      backHref={`/class/${code}`}
      initialStrokes={saved.strokes}
      onInkChange={onInkChange}
      banner={
        work?.feedback && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 border-b border-violet-100 bg-violet-50 px-4 py-2.5 text-sm">
            <span className="font-semibold text-violet-800">Note from {classRoom.teacherName}:</span>
            <span className="flex-1 text-slate-800">{work.feedback}</span>
          </motion.div>
        )
      }
      toolbarActions={
        <div className="flex shrink-0 items-center gap-2 pl-2">
          <span className="hidden text-xs text-slate-400 sm:block" aria-live="polite">
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Not saved, retrying" : ""}
          </span>
          <button
            type="button"
            onClick={handIn}
            disabled={handingIn || handedIn}
            title={handedIn && work?.handedInAt ? `Handed in at ${new Date(work.handedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Send this page to your teacher"}
            className={`flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold shadow-sm transition ${
              handedIn ? "bg-slate-100 text-slate-500" : "bg-orange-500 text-white hover:bg-orange-600"
            }`}
          >
            {handingIn ? "Handing in…" : handedIn ? "Handed in ✓" : work?.status === "handed_in" ? "Hand in again" : "Hand in"}
          </button>
        </div>
      }
    />
  );
}
