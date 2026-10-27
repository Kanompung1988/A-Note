import type { Metadata } from "next";
import { Suspense } from "react";
import { LearnerWorksheet } from "@/components/ClientOnly";

export const metadata: Metadata = { title: "Worksheet · A-Note" };

export default function AssignmentPage({ params }: PageProps<"/class/[code]/[assignmentId]">) {
  return (
    <Suspense>
      <Assignment params={params} />
    </Suspense>
  );
}

async function Assignment({ params }: { params: PageProps<"/class/[code]/[assignmentId]">["params"] }) {
  const { code, assignmentId } = await params;
  return <LearnerWorksheet code={code.toUpperCase()} assignmentId={assignmentId} />;
}
