"use client";

import { useRef, useState } from "react";
import { SheetCard } from "@/components/ui/SheetCard";
import { assignSample, assignUpload, uploadImage } from "@/lib/class/api";
import { prepareUpload } from "@/lib/class/images";
import { SAMPLE_SHEETS } from "@/lib/sheets";
import type { Assignment } from "@/lib/store/types";
import { CreateSheet } from "./CreateSheet";
import { Modal } from "./Modal";

type Props = {
  open: boolean;
  code: string;
  teacherKey: string;
  assigned: Assignment[];
  onClose: () => void;
  onAssigned: (assignment: Assignment) => void;
};

type Tab = "create" | "samples";

/** Write a worksheet with A-Note, pick a sample, or upload a photo of your own. */
export function AssignModal({ open, code, teacherKey, assigned, onClose, onAssigned }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("create");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const assignedTitles = new Set(assigned.map((a) => a.sheet.title));

  async function run(label: string, task: () => Promise<Assignment>) {
    setBusy(label);
    setError(null);
    try {
      onAssigned(await task());
      onClose();
    } catch {
      setError("That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    await run("upload", async () => {
      const { blob, width, height } = await prepareUpload(file);
      const { id } = await uploadImage(code, teacherKey, blob, `${file.name.replace(/\.[^.]+$/, "")}.jpg`);
      return assignUpload(code, teacherKey, { fileId: id, title: file.name.replace(/\.[^.]+$/, ""), width, height });
    });
  }

  return (
    <Modal open={open} onClose={onClose} wide>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-slate-900">Assign a worksheet</h2>
          <p className="mt-1 text-sm text-slate-500">Learners see it as soon as you assign it.</p>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy === "upload" ? "Uploading…" : "Upload a photo"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      <div className="mt-5 flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
        <TabButton active={tab === "create"} onClick={() => setTab("create")}>
          ✨ Create with A-Note
        </TabButton>
        <TabButton active={tab === "samples"} onClick={() => setTab("samples")}>
          Sample worksheets
        </TabButton>
      </div>

      {error && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <div className="mt-5">
        {tab === "create" ? (
          <CreateSheet
            code={code}
            teacherKey={teacherKey}
            onAssigned={(a) => {
              onAssigned(a);
              onClose();
            }}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {SAMPLE_SHEETS.map((sheet, i) => (
              <SheetCard
                key={sheet.id}
                sheet={sheet}
                index={i}
                onClick={busy ? undefined : () => run(sheet.id, () => assignSample(code, teacherKey, sheet.id))}
                footer={
                  <p className="mt-2 text-sm font-medium text-orange-600">
                    {busy === sheet.id ? "Assigning…" : assignedTitles.has(sheet.title) ? "Assigned · assign again" : "Assign"}
                  </p>
                }
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-2 transition ${active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
    >
      {children}
    </button>
  );
}
