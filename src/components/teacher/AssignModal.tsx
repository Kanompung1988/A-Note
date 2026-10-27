"use client";

import { useRef, useState } from "react";
import { SheetCard } from "@/components/ui/SheetCard";
import { assignSample, assignUpload, uploadImage } from "@/lib/class/api";
import { prepareUpload } from "@/lib/class/images";
import { SAMPLE_SHEETS } from "@/lib/sheets";
import type { Assignment } from "@/lib/store/types";
import { Modal } from "./Modal";

type Props = {
  open: boolean;
  code: string;
  teacherKey: string;
  assigned: Assignment[];
  onClose: () => void;
  onAssigned: (assignment: Assignment) => void;
};

/** Pick a sample worksheet or upload a photo of your own. */
export function AssignModal({ open, code, teacherKey, assigned, onClose, onAssigned }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
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
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-slate-900">Assign a worksheet</h2>
          <p className="mt-1 text-sm text-slate-500">Learners see it as soon as you assign it.</p>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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
      {error && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
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
    </Modal>
  );
}
