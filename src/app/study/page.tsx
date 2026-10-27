import type { Metadata } from "next";
import StudyBoard from "@/components/study/StudyBoard";

export const metadata: Metadata = {
  title: "ชีทเรียน · A-Note",
};

export default function StudyPage() {
  return <StudyBoard />;
}
