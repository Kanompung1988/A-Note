"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StudyBoard from "@/components/study/StudyBoard";
import { getClass, type PublicClass } from "@/lib/class/api";
import { learnerSeat } from "@/lib/class/identity";

/** A class worksheet: the study board, with every ask recorded for the teacher. */
export default function LearnerWorksheet({ code, assignmentId }: { code: string; assignmentId: string }) {
  const seat = learnerSeat(code);
  const [classRoom, setClassRoom] = useState<PublicClass | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getClass(code).then(setClassRoom, () => setFailed(true));
  }, [code]);

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
  if (!classRoom || !assignment) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-orange-100 border-t-orange-500" />
      </div>
    );
  }

  return (
    <StudyBoard
      initialSheet={assignment.sheet}
      allowSheetChange={false}
      classContext={{ code: classRoom.code, studentId: seat.studentId, assignmentId }}
      subtitle={`${classRoom.name} · ${assignment.sheet.title}`}
      backHref={`/class/${code}`}
    />
  );
}
