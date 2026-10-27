import type { Metadata } from "next";
import { Suspense } from "react";
import { TeacherDashboard } from "@/components/ClientOnly";

export const metadata: Metadata = { title: "Class dashboard · A-Note" };

export default function DashboardPage({ params }: PageProps<"/teacher/[code]">) {
  return (
    <Suspense>
      <Dashboard params={params} />
    </Suspense>
  );
}

async function Dashboard({ params }: { params: PageProps<"/teacher/[code]">["params"] }) {
  const { code } = await params;
  return <TeacherDashboard code={code.toUpperCase()} />;
}
