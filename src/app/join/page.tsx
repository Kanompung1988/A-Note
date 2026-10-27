import type { Metadata } from "next";
import { JoinClass } from "@/components/ClientOnly";

export const metadata: Metadata = { title: "Join your class · A-Note" };

export default function JoinPage() {
  return <JoinClass />;
}
