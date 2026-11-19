import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MonitorSmartphone } from "lucide-react";

import { publicEnv } from "@/lib/public-env";
import { StartDemo } from "./start-demo";

export const metadata: Metadata = {
  title: "Try DoubtRoom",
  description: "Post a doubt, get an AI answer and message a senior in under a minute. No sign-in needed.",
};

const STEPS = [
  "Post a doubt (we fill in an example)",
  "Watch the AI TA answer in the room",
  "Upvote the answer",
  "Ask a senior and get a reply",
  "See a class announcement",
];

export default function TryPage() {
  const enabled = publicEnv.NEXT_PUBLIC_TRY_ENABLED;
  return (
    <main className="min-h-dvh bg-[#f9f8fd]">
      <div className="mx-auto flex w-full max-w-xl flex-col px-4 pt-4 pb-10 sm:px-6">
        <Link href="/" className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-medium text-primary">
          <ArrowLeft aria-hidden="true" className="size-4" />DoubtRoom
        </Link>
        <section aria-labelledby="try-heading" className="mt-6">
          <p className="text-sm font-semibold tracking-wide text-accent-foreground/70 uppercase">Judge mode</p>
          <h1 id="try-heading" className="mt-2 text-4xl font-semibold tracking-tight text-balance">See DoubtRoom in under a minute</h1>
          <p className="mt-3 text-lg text-muted-foreground">No sign-in. You get a private sandbox in a Computer Networks study room with an AI TA and a senior.</p>
          <div className="mt-7">
            {enabled ? <StartDemo /> : (
              <p role="status" className="rounded-xl border bg-white p-4 text-sm">The demo is paused right now. Check back soon, or <Link href="/login" className="font-medium text-primary underline underline-offset-4">sign in</Link>.</p>
            )}
          </div>
        </section>

        <section aria-labelledby="tour-heading" className="mt-10 rounded-2xl border border-[#e9e7f4] bg-white p-5">
          <h2 id="tour-heading" className="font-semibold">What you’ll do</h2>
          <ol className="mt-3 space-y-2.5">
            {STEPS.map((step, index) => (
              <li key={step} className="flex items-center gap-3 text-sm">
                <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">Each step ticks itself off as you go.</p>
        </section>

        <p className="mt-5 flex items-start gap-2.5 rounded-2xl bg-primary/8 p-4 text-sm text-[#241c83]">
          <MonitorSmartphone aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Open /try in a second browser to see real-time sync between two users.
        </p>
        <p className="mt-6 text-xs text-muted-foreground">
          Demo sessions last 24 hours and only reach the demo room. By starting, you agree to the <Link href="/terms" className="underline underline-offset-2">Terms</Link> and <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
        </p>
      </div>
    </main>
  );
}
