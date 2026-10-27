"use client";

import dynamic from "next/dynamic";

// Screens that read this browser's seat (teacher key or learner id) from localStorage render
// only in the browser, so the server never renders a different first frame.
const loading = () => (
  <div className="grid min-h-dvh place-items-center">
    <span className="h-8 w-8 animate-spin rounded-full border-4 border-orange-100 border-t-orange-500" />
  </div>
);

export const TeacherHome = dynamic(() => import("@/components/teacher/TeacherHome"), { ssr: false, loading });
export const TeacherDashboard = dynamic(() => import("@/components/teacher/TeacherDashboard"), { ssr: false, loading });
export const JoinClass = dynamic(() => import("@/components/learner/JoinClass"), { ssr: false, loading });
export const LearnerHome = dynamic(() => import("@/components/learner/LearnerHome"), { ssr: false, loading });
export const LearnerWorksheet = dynamic(() => import("@/components/learner/LearnerWorksheet"), { ssr: false, loading });
