import Image from "next/image";
import Link from "next/link";
import { Bubbles } from "@/components/landing/Bubbles";
import { ClassPreview } from "@/components/landing/ClassPreview";
import { HeroDemo } from "@/components/landing/HeroDemo";
import { Float, RespectMotion } from "@/components/landing/Motion";
import { Reveal } from "@/components/landing/Reveal";

const LOOP = [
  {
    who: "Teacher",
    title: "Create",
    body: "Type one line, like “two-step equations with market word problems”. Muse Spark writes the worksheet and a private answer key, Muse Image draws the scene, and Muse Wonder re-solves every question before you see it.",
    art: (
      <div className="flex h-14 items-center gap-2 rounded-2xl bg-white px-3 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
        <span className="text-emerald-600">✓ 5/5</span> answers verified
      </div>
    ),
  },
  {
    who: "Learner",
    title: "Circle to ask",
    body: "Write on the worksheet with a pen or a mouse. Loop anything that doesn't make sense: SAM 3.1 outlines exactly what you meant, and Muse Spark pins one small hint at a time on the page.",
    art: (
      <svg viewBox="0 0 120 60" className="h-14 w-28" aria-hidden>
        <text x="22" y="38" className="fill-slate-700 font-serif text-[20px] italic">3x + 7</text>
        <path d="M100 18 C 82 4, 20 6, 10 24 C 2 40, 30 54, 64 52 C 100 50, 116 38, 104 22" fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    who: "Learner",
    title: "Check my work",
    body: "Finished a question? A-Note reads your handwritten working line by line and circles the first slip in red pen, like a teacher would. It never writes the answer for you.",
    art: (
      <svg viewBox="0 0 120 60" className="h-14 w-28" aria-hidden>
        <text x="18" y="26" className="fill-slate-700 text-[15px]">3x = 22 + 7</text>
        <path d="M108 16 C 96 4, 20 4, 10 16 C 2 28, 40 34, 70 32 C 104 30, 118 24, 104 12" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" />
        <text x="18" y="52" className="fill-slate-700 text-[15px]">x = 5</text>
        <path d="M72 44 l 5 6 l 12 -14" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    who: "Teacher",
    title: "Co-pilot plans tomorrow",
    body: "An agent reads every circle and every slip, finds the misconceptions that matter, writes verified practice for each group, and assigns it only to the learners who need it.",
    art: (
      <div className="flex h-14 items-center gap-2 rounded-2xl bg-slate-900 px-3 text-xs font-medium text-white">
        <span className="h-2 w-2 animate-pulse rounded-full bg-orange-400" /> For Kai, Nina, Tan
      </div>
    ),
  },
];

const MODELS = [
  {
    name: "Muse Spark 1.3",
    role: "Tutor, checker, writer, agent",
    body: "Reads the circled close-up with the whole page, reads handwritten working line by line, writes worksheets with answer keys, and runs the co-pilot with tool calls.",
  },
  {
    name: "Muse Wonder",
    role: "The second opinion",
    body: "Solves every question A-Note writes on its own, without the key. If the answers disagree, the question is rewritten or dropped before a learner sees it.",
  },
  {
    name: "SAM 3.1",
    role: "The eyes",
    body: "A rough loop becomes a box prompt; SAM returns the exact shape of what the learner meant, which is shaded on the page and maps the whole class.",
  },
  {
    name: "Muse Image",
    role: "The illustrator",
    body: "Draws the scene at the top of a new worksheet, and the “Show me” picture that makes an idea click (a balance scale for an equation).",
  },
  {
    name: "Muse Voice Transcribe",
    role: "The ears",
    body: "Learners who'd rather say it than type it tap the mic. Their question becomes text in about three seconds, in their own language.",
  },
];

const TRUST = [
  ["Two models, one key", "Every answer key is solved twice by different models. Disagreements are rewritten or dropped."],
  ["Hints, never answers", "The tutor sees the teacher's key so it can't mislead, and is told never to reveal it."],
  ["Keys stay with the teacher", "Answer keys never leave the server for learners. Practice sheets only reach the learners they were made for."],
  ["Every model call is Meta's", "Spark, Wonder, Image, SAM 3.1 and Voice Transcribe, all through the Meta Model API."],
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
                An AI classroom on five Meta models
              </p>
              <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl">
                Circle what you <span className="relative whitespace-nowrap text-orange-500">don&apos;t get.</span>
                <br />
                Get it, one hint at a time.
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-slate-600">
                A-Note is a classroom on a worksheet. Teachers write one in a line. Learners circle what confuses them and check their own
                handwritten working. The co-pilot turns the class&apos;s mistakes into tomorrow&apos;s practice, for exactly the learners who need it.
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

        {/* The lesson loop */}
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-semibold tracking-tight text-slate-900">The whole lesson, in one loop</h2>
            <p className="mt-4 text-lg text-slate-600">
              Plenty of learners never raise their hand, and teachers find out at the test. A-Note closes the loop the same day.
            </p>
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {LOOP.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.1} className="rounded-[28px] bg-gradient-to-b from-slate-50 to-white p-7 ring-1 ring-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-orange-500 font-bold text-white">{i + 1}</span>
                  {step.art}
                </div>
                <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-orange-600">{step.who}</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{step.title}</h3>
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
              <h2 className="text-4xl font-semibold tracking-tight text-slate-900">See where they&apos;re stuck. Then let the co-pilot do the follow-up.</h2>
              <p className="text-lg leading-relaxed text-slate-600">
                Share a six-letter code. Every circle lands on your copy of the worksheet, outlined by SAM 3.1, and every checked answer shows who
                slipped where. One tap runs the co-pilot: it groups learners by misconception, writes and verifies practice for each group,
                assigns it, and hands you a ten-minute plan for tomorrow.
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
            <h2 className="text-4xl font-semibold tracking-tight text-slate-900">Five Meta models, one page</h2>
            <p className="mt-4 text-lg text-slate-600">Every model call in A-Note goes to the Meta Model API.</p>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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

        {/* Trust */}
        <section className="bg-slate-50 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <Reveal className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Built so a teacher can trust it</h2>
              <p className="mt-3 text-lg text-slate-600">An AI in a classroom has to be right, and has to stay out of the learner&apos;s way.</p>
            </Reveal>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TRUST.map(([title, body], i) => (
                <Reveal key={title} delay={i * 0.08} className="rounded-3xl bg-white p-6 ring-1 ring-slate-200">
                  <p className="font-semibold text-slate-900">{title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
                </Reveal>
              ))}
            </div>
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
