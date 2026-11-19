import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, BadgeCheck, GraduationCap, MessageCircleQuestion, Sparkles } from "lucide-react";

import { formatCount } from "@/components/impact/format";
import { Skeleton } from "@/components/ui/skeleton";
import { getImpact } from "@/lib/impact/server";
import { publicEnv } from "@/lib/public-env";

const GITHUB_URL = "https://github.com/dhaanish597/doubtroom";

const STEPS = [
  { Icon: MessageCircleQuestion, title: "Post your doubt", body: "Type it or snap the textbook page in your subject room." },
  { Icon: Sparkles, title: "The TA answers in seconds", body: "An AI TA replies right in the room with an exam tip." },
  { Icon: BadgeCheck, title: "A senior verifies it", body: "Seniors from your college check answers so you know what to trust." },
];

function ChatPreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-sm rotate-1 rounded-3xl bg-white p-4 text-left text-sm text-foreground shadow-2xl shadow-black/25">
      <p className="mb-3 text-xs font-semibold text-muted-foreground">CS3591 · Computer Networks</p>
      <div className="rounded-2xl border border-[#e9e7f4] p-3">
        <p className="text-xs font-semibold text-primary">Doubt · Unit 2</p>
        <p className="mt-1 font-medium">Why does TCP need a 3-way handshake?</p>
      </div>
      <div className="mt-3 rounded-2xl border border-[#e9e7f4] border-s-4 border-s-indigo-500 p-3">
        <p className="font-semibold">DoubtRoom TA</p>
        <p className="mt-1 text-muted-foreground">Both sides must agree on starting sequence numbers. SYN, SYN-ACK, ACK does that in three steps…</p>
        <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
          <BadgeCheck className="size-3.5" />Verified by Arun (IV CSE)
        </p>
      </div>
    </div>
  );
}

async function LiveStats() {
  await connection();
  const totals = await getImpact().then((impact) => impact.totals, () => null);
  if (!totals) return <p className="text-sm text-muted-foreground">Live numbers are taking a short break. They’ll be back soon.</p>;
  const stats = [
    { label: "students", value: totals.users },
    { label: "doubts asked", value: totals.doubts },
    { label: "AI answers", value: totals.aiAnswers },
    { label: "verified", value: totals.verified },
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
      {stats.map(({ label, value }) => (
        <div key={label}>
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="text-3xl font-semibold tracking-tight tabular-nums text-primary">{formatCount(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function StatsSkeleton() {
  return (
    <div role="status" aria-label="Loading live numbers" className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
      {[1, 2, 3, 4].map((key) => <Skeleton key={key} className="h-14" />)}
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-dvh bg-[#f9f8fd]">
      <section aria-labelledby="hero-heading" className="overflow-hidden bg-primary px-4 pt-14 pb-16 text-primary-foreground sm:px-8 sm:pt-20">
        <div className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <div aria-hidden="true" className="mb-7 h-1.5 w-12 rounded-full bg-accent" />
            <p className="text-sm font-semibold tracking-wide text-primary-foreground/80 uppercase">DoubtRoom</p>
            <h1 id="hero-heading" className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              Exam doubts answered in seconds, verified by seniors.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-primary-foreground/85 sm:text-xl">
              Study rooms for every subject in your class. No more doubts lost in a 200-message group chat at 1 a.m.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary-foreground px-5 font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-foreground">
                Sign in with Google
              </Link>
              {publicEnv.NEXT_PUBLIC_TRY_ENABLED && (
                <Link href="/try" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-primary-foreground/40 px-5 font-semibold hover:bg-primary-foreground/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-foreground">
                  Try the demo, no sign-in<ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              )}
            </div>
          </div>
          <ChatPreview />
        </div>
      </section>

      <section aria-labelledby="stats-heading" className="mx-auto -mt-8 max-w-5xl px-4 sm:px-8">
        <div className="rounded-3xl border border-[#e9e7f4] bg-white p-5 shadow-lg shadow-primary/5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="stats-heading" className="font-semibold">Live right now</h2>
            <Link href="/impact" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary">
              See live impact<ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <Suspense fallback={<StatsSkeleton />}><LiveStats /></Suspense>
        </div>
      </section>

      <section aria-labelledby="how-heading" className="mx-auto max-w-5xl px-4 py-16 sm:px-8">
        <h2 id="how-heading" className="text-3xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          {STEPS.map(({ Icon, title, body }, index) => (
            <li key={title} className="relative">
              <span className="text-6xl font-semibold text-primary/10 tabular-nums" aria-hidden="true">{index + 1}</span>
              <Icon aria-hidden="true" className="-mt-6 size-7 text-primary" />
              <h3 className="mt-3 text-lg font-semibold">{title}</h3>
              <p className="mt-1 text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
          <GraduationCap aria-hidden="true" className="size-4 text-primary" />
          Built for Anna University colleges, starting with RMKEC.
        </p>
      </section>

      <footer className="border-t border-[#e9e7f4] bg-white px-4 py-8 sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">Built on Nexconn Chat</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4">GitHub</a>
            <Link href="/impact" className="inline-flex min-h-11 items-center underline underline-offset-4">Live impact</Link>
            <Link href="/privacy" className="inline-flex min-h-11 items-center underline underline-offset-4">Privacy Policy</Link>
            <Link href="/terms" className="inline-flex min-h-11 items-center underline underline-offset-4">Terms of Service</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
