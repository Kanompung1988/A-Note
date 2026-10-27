import type { Metadata } from "next";
import { TeacherHome } from "@/components/ClientOnly";

export const metadata: Metadata = { title: "For teachers · A-Note" };

export default function TeacherPage() {
  return <TeacherHome />;
}
