"use client";

import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/ui/TopBar";
import { createClass } from "@/lib/class/api";
import { formatCode, saveTeacherSeat, teacherSeats, type TeacherSeat } from "@/lib/class/identity";

export default function TeacherHome() {
  const router = useRouter();
  const [seats] = useState(teacherSeats);
  const [name, setName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A seat handed over in the link (#seat=…, printed by scripts/seed-demo.mjs) opens that class on this device.
  useEffect(() => {
    const match = window.location.hash.match(/^#seat=(.+)$/);
    if (!match) return;
    try {
      const seat = JSON.parse(decodeURIComponent(match[1])) as TeacherSeat;
      if (seat.code && seat.teacherKey) {
        saveTeacherSeat(seat);
        router.replace(`/teacher/${seat.code}`);
      }
    } catch {
      // not a seat link
    }
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !teacherName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createClass(name.trim(), teacherName.trim());
      saveTeacherSeat({ code: created.code, name: created.name, teacherKey: created.teacherKey });
      router.push(`/teacher/${created.code}`);
    } catch {
      setError("Couldn't create the class. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-sky-50 via-white to-white">
      <TopBar>
        <span className="text-sm text-slate-500">for teachers</span>
      </TopBar>
      <main className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.1fr_1fr] md:items-center">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">See where your class is stuck, while they work.</h1>
          <p className="text-lg text-slate-600">
            Write a worksheet in one line. Learners circle what confuses them and check their own working. Your dashboard lights up where the
            class is stuck, and the co-pilot writes tomorrow&apos;s practice for exactly the learners who need it.
          </p>
          <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }} className="hidden md:block">
            <Image src="/brand/peek.webp" alt="" width={220} height={218} className="h-[218px] w-[220px]" />
          </motion.div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-6">
          <form onSubmit={submit} className="space-y-4 rounded-3xl bg-white p-6 shadow-xl shadow-sky-100 ring-1 ring-slate-200">
            <p className="text-lg font-semibold text-slate-900">Start a class</p>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Class name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Grade 7/2 Math"
                maxLength={80}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Your name</span>
              <input
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="Kru Ann"
                maxLength={80}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
              />
            </label>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={busy || !name.trim() || !teacherName.trim()}
              className="w-full rounded-xl bg-orange-500 py-3 font-semibold text-white shadow-sm disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create class"}
            </motion.button>
          </form>

          {seats.length > 0 && (
            <div className="space-y-2">
              <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Your classes</p>
              {seats.map((s, i) => (
                <motion.div key={s.code} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.05 }}>
                  <Link
                    href={`/teacher/${s.code}`}
                    className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200 transition hover:shadow-md hover:ring-orange-200"
                  >
                    <span className="font-medium text-slate-800">{s.name}</span>
                    <span className="font-mono text-sm tracking-widest text-slate-500">{formatCode(s.code)}</span>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
