import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <Image src="/brand/mascot.webp" alt="" width={384} height={274} preload />
      <h1 className="text-5xl font-semibold tracking-tight">A-Note</h1>
      <p className="max-w-md text-lg text-slate-600">Circle what you don&apos;t get. A-Note sees exactly what you circled and walks you through it, one hint at a time.</p>
      <Link
        href="/study"
        className="mt-4 rounded-full bg-orange-500 px-8 py-3 text-lg font-semibold text-white shadow-md hover:bg-orange-600"
      >
        Start studying
      </Link>
    </main>
  );
}
