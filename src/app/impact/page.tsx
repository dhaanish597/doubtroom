import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";

import { DailyChart } from "@/components/impact/DailyChart";
import { formatCount, formatMinutes, formatSeconds, formatUpdated } from "@/components/impact/format";
import { Skeleton } from "@/components/ui/skeleton";
import { isEmptyImpact, type Impact } from "@/lib/impact/aggregate";
import { getImpact } from "@/lib/impact/server";

export const metadata: Metadata = {
  title: "Live impact · DoubtRoom",
  description: "Live numbers from DoubtRoom: students, doubts asked, AI answers and senior verifications.",
};

function Tile({ label, value, note, highlight = false }: { label: string; value: string; note?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-transparent bg-primary text-primary-foreground" : "border-border bg-card"}`}>
      <dt className={`text-xs font-medium ${highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{label}</dt>
      <dd className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{value}</dd>
      {note && <dd className={`mt-0.5 text-xs ${highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{note}</dd>}
    </div>
  );
}

function Stats({ impact }: { impact: Impact }) {
  const { totals, medians } = impact;
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile highlight label="Students" value={formatCount(totals.users)} note={`${formatCount(totals.onboarded)} set up their rooms`} />
        <Tile label="Active today" value={formatCount(totals.active24h)} note={`${formatCount(totals.active7d)} this week`} />
        <Tile label="Doubts asked" value={formatCount(totals.doubts)} note={`in ${formatCount(totals.activeRooms)} active rooms`} />
        <Tile label="AI answers" value={formatCount(totals.aiAnswers)} note={medians.doubtToAiSeconds === null ? "no answers yet" : `median ${formatSeconds(medians.doubtToAiSeconds)} to answer`} />
        <Tile label="Verified by seniors" value={formatCount(totals.verified)}
          note={medians.aiToVerifiedMinutes === null ? "none verified yet" : `median ${formatMinutes(medians.aiToVerifiedMinutes)} after the AI`} />
        <Tile label="Seniors" value={formatCount(totals.mentors)} note={`${formatCount(totals.dmsStarted)} DMs started`} />
        <Tile label="Upvotes" value={formatCount(totals.upvotes)} />
        <Tile label="Demo sessions" value={formatCount(totals.demoSessions)} note="judges and visitors" />
      </dl>
      <section className="mt-5 rounded-2xl border border-border bg-card p-4">
        <DailyChart days={impact.daily} />
      </section>
    </>
  );
}

async function LiveImpact() {
  await connection();
  let impact: Impact;
  try {
    impact = await getImpact();
  } catch {
    return (
      <div role="alert" className="rounded-2xl border border-destructive/30 bg-card p-5">
        <p className="font-semibold">Live numbers are unavailable right now.</p>
        <p className="mt-1 text-sm text-muted-foreground">We couldn’t reach the database. Give it a minute.</p>
        <Link href="/impact" prefetch={false} className="mt-3 inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4">Try again</Link>
      </div>
    );
  }

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">Updated {formatUpdated(impact.updatedAt)} · refreshes every minute</p>
      {isEmptyImpact(impact) && (
        <p role="status" className="mb-4 rounded-2xl bg-primary/8 p-4 text-sm text-primary">
          No activity yet. Numbers fill in as students join. <Link href="/try" className="font-medium underline underline-offset-4">Try the demo</Link> in the meantime.
        </p>
      )}
      <Stats impact={impact} />
    </>
  );
}

function ImpactSkeleton() {
  return (
    <div role="status" aria-label="Loading live numbers">
      <Skeleton className="mb-4 h-5 w-56" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-26 rounded-2xl" />)}
      </div>
      <Skeleton className="mt-5 h-56 rounded-2xl" />
    </div>
  );
}

export default function ImpactPage() {
  return (
    <main className="min-h-dvh bg-muted/45">
      <div className="mx-auto w-full max-w-3xl px-4 pt-4 pb-12 sm:px-6">
        <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary">
          <ArrowLeft aria-hidden="true" className="size-4" />DoubtRoom
        </Link>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">Live impact</h1>
        <p className="mt-2 mb-6 text-lg text-muted-foreground">Real numbers from real study rooms, straight from our database.</p>
        <Suspense fallback={<ImpactSkeleton />}>
          <LiveImpact />
        </Suspense>
        <footer className="mt-8 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
          <p><strong className="font-semibold text-foreground">How we count.</strong> Students are signed-in accounts, not bots or demo visitors. Active means connected to chat in the last 24 hours or 7 days.</p>
          <p>Doubts, answers, verifications and upvotes exclude the demo room. Medians use the latest 1,000 answers. Days follow India Standard Time.</p>
          <p>Demo sessions are judges and visitors using /try. Numbers are cached for up to 60 seconds.</p>
        </footer>
      </div>
    </main>
  );
}
