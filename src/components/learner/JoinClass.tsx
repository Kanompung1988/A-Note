"use client";

import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TopBar } from "@/components/ui/TopBar";
import { joinClass } from "@/lib/class/api";
import { formatCode, learnerSeats, saveLearnerSeat } from "@/lib/class/identity";

function cleanCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export default function JoinClass() {
  const router = useRouter();
  const [seats] = useState(learnerSeats);
  const [code, setCode] = useState(() => cleanCode(new URLSearchParams(window.location.search).get("code") ?? ""));
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6 || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { student, classRoom } = await joinClass(code, name.trim());
      saveLearnerSeat({ code: classRoom.code, className: classRoom.name, studentId: student.id, name: student.name });
      router.push(`/class/${classRoom.code}`);
    } catch (err) {
      setError(err instanceof Error && err.message === "class_not_found" ? "No class has that code. Check the board again." : "Couldn't join. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-orange-50 via-white to-sky-50">
      <TopBar>
        <span className="text-sm text-slate-500">for learners</span>
      </TopBar>
      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-10">
        <motion.div animate={{ y: [0, -10, 0], rotate: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}>
          <Image src="/brand/mascot.webp" alt="" width={240} height={171} preload />
        </motion.div>
        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 w-full space-y-4 rounded-3xl bg-white p-6 shadow-xl shadow-orange-100 ring-1 ring-slate-200"
        >
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Join your class</h1>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Class code</span>
            <input
              value={formatCode(code)}
              onChange={(e) => setCode(cleanCode(e.target.value))}
              placeholder="ABC-123"
              autoCapitalize="characters"
              autoComplete="off"
              inputMode="text"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-center font-mono text-3xl tracking-[0.3em] text-slate-900 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Your name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First name is fine"
              maxLength={40}
              autoComplete="given-name"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
            />
          </label>
          {error && (
            <motion.p initial={{ x: -6 }} animate={{ x: [6, -4, 2, 0] }} className="text-sm text-rose-600">
              {error}
            </motion.p>
          )}
          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={busy || code.length !== 6 || !name.trim()}
            className="w-full rounded-xl bg-orange-500 py-3 text-lg font-semibold text-white shadow-sm disabled:opacity-50"
          >
            {busy ? "Joining…" : "Join"}
          </motion.button>
        </motion.form>

        {seats.length > 0 && (
          <div className="mt-6 w-full space-y-2">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Back to</p>
            {seats.map((s) => (
              <Link
                key={s.code}
                href={`/class/${s.code}`}
                className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200 hover:ring-orange-200"
              >
                <span className="font-medium text-slate-800">{s.className}</span>
                <span className="text-sm text-slate-500">as {s.name}</span>
              </Link>
            ))}
          </div>
        )}

        <Link href="/study" className="mt-8 text-sm font-medium text-slate-500 hover:text-orange-600">
          No class? Practice on your own →
        </Link>
      </main>
    </div>
  );
}
