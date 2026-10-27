import Image from "next/image";
import Link from "next/link";
import { Bubbles } from "@/components/landing/Bubbles";
import { ClassPreview } from "@/components/landing/ClassPreview";
import { HeroDemo } from "@/components/landing/HeroDemo";
import { Float, RespectMotion } from "@/components/landing/Motion";
import { Reveal } from "@/components/landing/Reveal";

const STEPS = [
  {
    title: "Circle it",
    body: "Write on the worksheet with a pen or a mouse. When something doesn't make sense, draw a loop around it. No typing, no raised hand.",
    art: (
      <svg viewBox="0 0 120 60" className="h-14 w-28" aria-hidden>
        <text x="22" y="38" className="fill-slate-700 font-serif text-[20px] italic">3x + 7</text>
        <path d="M100 18 C 82 4, 20 6, 10 24 C 2 40, 30 54, 64 52 C 100 50, 116 38, 104 22" fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "A-Note sees exactly that",
    body: "SAM 3.1 turns your rough loop into a precise outline of the equation, figure or word you meant, and reads it with the whole page for context.",
    art: (
      <svg viewBox="0 0 120 60" className="h-14 w-28" aria-hidden>
        <rect x="14" y="16" width="92" height="30" rx="8" className="fill-orange-300/60" />
        <text x="22" y="38" className="fill-slate-700 font-serif text-[20px] italic">3x + 7</text>
      </svg>
    ),
  },
  {
    title: "Hints, not answers",
    body: "Muse Spark writes one small hint at a time right on your page, checks your answer, and only celebrates when you solved it yourself.",
    art: (
      <div className="flex h-14 items-center gap-2 rounded-2xl bg-amber-50 px-3 ring-1 ring-amber-200">
        <Image src="/brand/icon.png" alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />
        <span className="text-xs font-medium text-slate-700">Undo the +7 first?</span>
      </div>
    ),
  },
];

const MODELS = [
  {
    name: "Muse Spark 1.3",
    role: "The tutor",
    body: "Reads the circled close-up together with the full page, answers in structured hints, keeps the page in mind across follow-ups, and explains to teachers why the class is stuck.",
  },
  {
    name: "SAM 3.1",
    role: "The eyes",
    body: "The learner's loop becomes a box prompt. SAM returns the exact shape of what they meant, which A-Note shades on the page and uses to map the whole class.",
  },
  {
    name: "Muse Voice Transcribe",
    role: "The ears",
    body: "Learners who'd rather say it than type it tap the mic. Their question becomes text in about three seconds, in 25 languages.",
  },
];

export default function Home() {
  return (
    <RespectMotion>
      <div className="flex-1 overflow-x-hidden bg-white">
        {/* Hero */}
        <section className="relative isolate overflow-hidden bg-gradient-to-b from-sky-100 via-sky-50 to-white">
          <Bubbles />
          <nav className="relative mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
              <Image src="/brand/icon.png" alt="" width={36} height={36} className="rounded-xl" />
              A-Note
            </Link>
            <div className="ml-auto flex items-center gap-1 text-sm font-medium sm:gap-2">
              <Link href="/teacher" className="rounded-xl px-3 py-2 text-slate-600 hover:bg-white/70">
                Teachers
              </Link>
              <Link href="/join" className="rounded-xl bg-slate-900 px-4 py-2 text-white hover:bg-slate-800">
                Join a class
              </Link>
            </div>
          </nav>

          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-24 pt-10 sm:px-6 lg:grid-cols-2 lg:pt-16">
            <Reveal className="space-y-6">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-sky-800 ring-1 ring-sky-200 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                Built on Meta&apos;s Muse Spark, SAM 3.1 and Voice Transcribe
              </p>
              <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl">
                Circle what you <span className="relative whitespace-nowrap text-orange-500">don&apos;t get.</span>
                <br />
                Get it, one hint at a time.
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-slate-600">
                A-Note is a worksheet you write on in the browser. Loop anything that confuses you and the tutor sees exactly that spot,
                then helps you work it out yourself. Your teacher sees where the whole class got stuck, live.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/join" className="rounded-2xl bg-orange-500 px-6 py-3.5 text-lg font-semibold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 hover:bg-orange-600">
                  I&apos;m a learner
                </Link>
                <Link href="/teacher" className="rounded-2xl bg-white px-6 py-3.5 text-lg font-semibold text-slate-900 shadow-lg shadow-sky-100 ring-1 ring-slate-200 transition hover:-translate-y-0.5">
                  I&apos;m a teacher
                </Link>
                <Link href="/study" className="px-2 py-3 font-medium text-slate-600 hover:text-orange-600">
                  Try it now, no sign-up →
                </Link>
              </div>
            </Reveal>
            <HeroDemo />
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-semibold tracking-tight text-slate-900">Asking shouldn&apos;t take courage</h2>
            <p className="mt-4 text-lg text-slate-600">
              Plenty of learners never raise their hand. A-Note makes asking as small as drawing a circle.
            </p>
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.12} className="rounded-[28px] bg-gradient-to-b from-slate-50 to-white p-7 ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-orange-500 font-bold text-white">{i + 1}</span>
                  {step.art}
                </div>
                <h3 className="mt-6 text-xl font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-slate-600">{step.body}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Teachers */}
        <section className="bg-gradient-to-b from-white via-orange-50/60 to-white py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
            <Reveal className="space-y-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">For teachers</p>
              <h2 className="text-4xl font-semibold tracking-tight text-slate-900">Your class&apos;s sticking points, while they work</h2>
              <p className="text-lg leading-relaxed text-slate-600">
                Share a six-letter code. Every circle a learner draws lands on your copy of the worksheet, outlined by SAM 3.1. Spots the
                whole class circled glow brighter, and Muse Spark tells you the likely mix-up and a five-minute re-teach.
              </p>
              <Link href="/teacher" className="inline-block rounded-2xl bg-slate-900 px-6 py-3.5 font-semibold text-white transition hover:-translate-y-0.5">
                Start a class
              </Link>
            </Reveal>
            <Reveal delay={0.1}>
              <ClassPreview />
            </Reveal>
          </div>
        </section>

        {/* Meta models */}
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <Reveal className="max-w-2xl">
            <h2 className="text-4xl font-semibold tracking-tight text-slate-900">Three Meta models, one page</h2>
            <p className="mt-4 text-lg text-slate-600">Every model call in A-Note goes to the Meta Model API.</p>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {MODELS.map((m, i) => (
              <Reveal key={m.name} delay={i * 0.12} className="group relative overflow-hidden rounded-[28px] bg-slate-900 p-7 text-white">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-orange-500/30 blur-2xl transition-transform duration-700 group-hover:scale-150" />
                <p className="text-sm font-medium text-orange-300">{m.role}</p>
                <h3 className="mt-2 text-2xl font-semibold">{m.name}</h3>
                <p className="mt-3 leading-relaxed text-slate-300">{m.body}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Closing */}
        <section className="relative overflow-hidden bg-gradient-to-b from-white to-sky-100">
          <Bubbles />
          <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center">
            <Float>
              <Image src="/brand/peek.webp" alt="" width={220} height={218} className="h-[218px] w-[220px]" />
            </Float>
            <h2 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900">Got a worksheet? Circle something.</h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/study" className="rounded-2xl bg-orange-500 px-6 py-3.5 text-lg font-semibold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5">
                Try it now
              </Link>
              <Link href="/join" className="rounded-2xl bg-white px-6 py-3.5 text-lg font-semibold text-slate-900 ring-1 ring-slate-200 transition hover:-translate-y-0.5">
                Join a class
              </Link>
            </div>
            <p className="mt-16 text-sm text-slate-500">A-Note · built for the Meta Global AI Developer Hackathon</p>
          </div>
        </section>
      </div>
    </RespectMotion>
  );
}
