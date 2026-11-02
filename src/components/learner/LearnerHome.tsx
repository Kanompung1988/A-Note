"use client";

import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SheetCard } from "@/components/ui/SheetCard";
import { TopBar } from "@/components/ui/TopBar";
import { getClass, type PublicClass, type WorkRecord } from "@/lib/class/api";
import { learnerSeat } from "@/lib/class/identity";

const POLL_MS = 8000;

export default function LearnerHome({ code }: { code: string }) {
  const seat = learnerSeat(code);
  const [classRoom, setClassRoom] = useState<PublicClass | null>(null);
  const [missing, setMissing] = useState(false);

  const studentId = seat?.studentId;

  // New worksheets appear without a reload.
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getClass(code, studentId)
        .then((c) => !cancelled && setClassRoom(c))
        .catch(() => !cancelled && setMissing(true));
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [code, studentId]);

  const latestFirst = [...(classRoom?.assignments ?? [])].reverse();
  const workFor = (assignmentId: string) => classRoom?.work?.find((w) => w.assignmentId === assignmentId) ?? null;
  const forYou = latestFirst.filter((a) => a.forYou);
  const everyone = latestFirst.filter((a) => !a.forYou);

  if (!seat) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="space-y-4">
          <p className="text-lg font-semibold text-slate-900">Join this class first</p>
          <Link href={`/join?code=${code}`} className="inline-block rounded-xl bg-orange-500 px-5 py-2.5 font-semibold text-white">
            Join
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-orange-50 via-white to-white">
      <TopBar href="/join">
        <span className="ml-auto text-sm text-slate-500">{seat.name}</span>
      </TopBar>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-5">
          <motion.div animate={{ rotate: [0, 8, -4, 0] }} transition={{ duration: 1.2, delay: 0.3 }}>
            <Image src="/brand/icon.png" alt="" width={72} height={72} className="rounded-3xl shadow-lg" />
          </motion.div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Hi {seat.name}</h1>
            <p className="text-slate-500">
              {classRoom ? `${classRoom.name} · ${classRoom.teacherName}` : missing ? "This class code no longer works." : "Loading your class…"}
            </p>
          </div>
        </motion.div>

        {forYou.length > 0 && (
          <>
            <p className="mt-10 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-orange-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" />
              Made for you
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {forYou.map((a, i) => (
                <Link key={a.id} href={`/class/${code}/${a.id}`}>
                  <SheetCard
                    sheet={a.sheet}
                    index={i}
                    footer={
                      <>
                        {a.note && <p className="mt-2 rounded-xl bg-orange-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-orange-100">{a.note}</p>}
                        <WorkStatus work={workFor(a.id)} fallback="Start →" />
                      </>
                    }
                  />
                </Link>
              ))}
            </div>
          </>
        )}

        <p className="mt-10 text-xs font-semibold uppercase tracking-wide text-slate-500">Your worksheets</p>
        {classRoom && everyone.length === 0 && (
          <p className="mt-3 rounded-3xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-500">
            Your teacher hasn&apos;t assigned anything yet. This page updates by itself.
          </p>
        )}
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {everyone.map((a, i) => (
            <Link key={a.id} href={`/class/${code}/${a.id}`}>
              <SheetCard sheet={a.sheet} index={i} footer={<WorkStatus work={workFor(a.id)} fallback="Open →" />} />
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

/** Where this learner is with a worksheet: not started, started, handed in, and any note back. */
function WorkStatus({ work, fallback }: { work: WorkRecord | null; fallback: string }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      {work?.status === "handed_in" ? (
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-700 ring-1 ring-emerald-200">Handed in ✓</span>
      ) : work && work.strokeCount > 0 ? (
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">In progress</span>
      ) : null}
      {work?.feedback && <span className="rounded-full bg-violet-50 px-2.5 py-0.5 font-medium text-violet-700 ring-1 ring-violet-200">Note from your teacher</span>}
      <span className="ml-auto font-medium text-orange-600">{work && work.strokeCount > 0 ? "Continue →" : fallback}</span>
    </div>
  );
}
