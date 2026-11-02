"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { deleteClass, renameClass, type Dashboard } from "@/lib/class/api";
import { removeTeacherSeat, saveTeacherSeat } from "@/lib/class/identity";
import { resultsCsv } from "@/lib/class/progress";
import { Modal } from "./Modal";

type Props = {
  code: string;
  teacherKey: string;
  data: Dashboard;
  onRenamed: (name: string, teacherName: string) => void;
};

/** The class menu: rename, export results, delete. */
export function ClassSettings({ code, teacherKey, data, onRenamed }: Props) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(data.classRoom.name);
  const [teacherName, setTeacherName] = useState(data.classRoom.teacherName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !menuRef.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  function exportCsv() {
    setOpen(false);
    const blob = new Blob([resultsCsv(data)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.classRoom.name.replace(/[^\p{L}\p{N}]+/gu, "-")}-results.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !teacherName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const renamed = await renameClass(code, teacherKey, { name: name.trim(), teacherName: teacherName.trim() });
      saveTeacherSeat({ code, name: renamed.name, teacherKey });
      onRenamed(renamed.name, renamed.teacherName);
      setRenaming(false);
    } catch {
      setError("Couldn't rename the class. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setOpen(false);
    const typed = window.prompt(`Delete ${data.classRoom.name} with all its worksheets, learners and work? Type the class code ${code} to confirm.`);
    if (typed?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") !== code) return;
    await deleteClass(code, teacherKey);
    removeTeacherSeat(code);
    router.push("/teacher");
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label="Class settings"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid h-9 w-9 place-items-center rounded-xl ring-1 ring-slate-200 hover:bg-slate-50"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            role="menu"
            className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-2xl bg-white p-1 text-sm shadow-xl ring-1 ring-slate-200"
          >
            <MenuItem
              onClick={() => {
                setOpen(false);
                setRenaming(true);
              }}
            >
              Rename class
            </MenuItem>
            <MenuItem onClick={exportCsv}>Export results (CSV)</MenuItem>
            <MenuItem danger onClick={remove}>
              Delete class
            </MenuItem>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={renaming} onClose={() => setRenaming(false)}>
        <form onSubmit={saveName} className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">Rename class</h2>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Class name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Teacher name</span>
            <input value={teacherName} onChange={(e) => setTeacherName(e.target.value)} maxLength={80} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
          </label>
          {error && <p className="text-sm text-rose-700">{error}</p>}
          <button type="submit" disabled={busy} className="h-11 w-full rounded-xl bg-orange-500 font-semibold text-white disabled:opacity-50">
            {busy ? "Saving…" : "Save"}
          </button>
        </form>
      </Modal>
    </div>
  );
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={`block w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50 ${danger ? "text-rose-600" : "text-slate-700"}`}>
      {children}
    </button>
  );
}
