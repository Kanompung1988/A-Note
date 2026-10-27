import type { Metadata } from "next";
import { Suspense } from "react";
import { LearnerHome } from "@/components/ClientOnly";

export const metadata: Metadata = { title: "My class · A-Note" };

export default function ClassPage({ params }: PageProps<"/class/[code]">) {
  return (
    <Suspense>
      <Home params={params} />
    </Suspense>
  );
}

async function Home({ params }: { params: PageProps<"/class/[code]">["params"] }) {
  const { code } = await params;
  return <LearnerHome code={code.toUpperCase()} />;
}
