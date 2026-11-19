"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, ExternalLink, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { trackDmEvent } from "@/lib/analytics";
import { BOT_IDS, DEMO_ROOM_ID } from "@/lib/nexconn/identities";
import { dmHref } from "@/lib/mentors/types";
import { useConnection } from "@/lib/stores/connection";
import { useTourPrefill } from "@/lib/stores/tour";
import { EXAMPLE_DOUBT, EXAMPLE_UNIT, TOUR_STEPS, type TourStep } from "@/lib/try/tour";
import { ANNOUNCE_SCROLL_EVENT, useTourDetection } from "./useTourDetection";
import { useTourState } from "./useTourState";

const ROOM_PATH = `/app/room/${DEMO_ROOM_ID}`;
const GITHUB_URL = "https://github.com/dhaanish597/doubtroom";

const COPY: Record<TourStep, { title: string; hint: string }> = {
  doubt: { title: "Post a doubt", hint: "We filled in an example. Just tap Send." },
  answer: { title: "Watch the TA answer", hint: "The AI TA replies right in the room, usually within 10 seconds." },
  upvote: { title: "Upvote the answer", hint: "Tap Upvote on the TA's answer card." },
  senior: { title: "Ask a senior", hint: "Message Arun, our demo senior. He replies in about 3 seconds." },
  announce: { title: "See the announcement", hint: "Class reps post announcements and see who has read them." },
};

function StepAction({ step, myDoubtId, onRoom }: { step: TourStep; myDoubtId?: string; onRoom: boolean }) {
  const router = useRouter();
  const setPrefill = useTourPrefill((state) => state.setPrefill);
  const toRoom = () => { if (!onRoom) router.push(ROOM_PATH); };

  if (step === "doubt") {
    return <Button type="button" size="sm" className="min-h-11" onClick={() => {
      setPrefill({ roomId: DEMO_ROOM_ID, text: EXAMPLE_DOUBT, unit: EXAMPLE_UNIT });
      toRoom();
    }}>Use the example</Button>;
  }
  if (step === "senior") {
    return (
      <Button asChild size="sm" className="min-h-11">
        <Link href={dmHref(BOT_IDS.DEMO_MENTOR, myDoubtId ? { roomId: DEMO_ROOM_ID, doubtMessageId: myDoubtId } : undefined)}
          onClick={() => trackDmEvent("dm_started", BOT_IDS.DEMO_MENTOR)}>Message Arun</Link>
      </Button>
    );
  }
  if (step === "announce") {
    return <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => {
      window.dispatchEvent(new Event(ANNOUNCE_SCROLL_EVENT));
      toRoom();
    }}>Show me</Button>;
  }
  if (!onRoom) return <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={toRoom}>Open the room</Button>;
  return null;
}

function FinalCard() {
  return (
    <div className="space-y-2 rounded-xl bg-primary/8 p-3 text-sm">
      <p className="font-semibold text-primary">You’ve seen it all. Nice!</p>
      <p>This is a sandbox. Real rooms are live at RMKEC for exam season.</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Link href="/impact" className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4">See live impact</Link>
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 font-medium text-primary underline underline-offset-4">
          Code on GitHub<ExternalLink aria-hidden="true" className="size-3.5" />
        </a>
      </div>
    </div>
  );
}

/** The five-step demo tour. Docked above the nav on phones, floating on wide screens. */
export function TourChecklist() {
  const pathname = usePathname();
  const connected = useConnection((state) => state.status === "connected");
  const { myDoubtIds } = useTourDetection();
  const done = useTourState((state) => state.done);
  const collapsed = useTourState((state) => state.collapsed);
  const setCollapsed = useTourState((state) => state.setCollapsed);
  const onRoom = pathname === ROOM_PATH;
  const next = TOUR_STEPS.find((step) => !done.includes(step));
  const finished = !next;
  const headingId = "demo-tour-heading";

  return (
    <aside aria-labelledby={headingId}
      className="z-20 shrink-0 border-t border-border bg-card shadow-[0_-6px_20px_rgb(59_47_201/0.08)] lg:fixed lg:right-5 lg:bottom-20 lg:w-88 lg:rounded-2xl lg:border lg:shadow-xl">
      <button type="button" aria-expanded={!collapsed} aria-controls="demo-tour-steps" onClick={() => setCollapsed(!collapsed)}
        className="flex min-h-12 w-full items-center gap-2 px-4 text-left focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary">
        <Sparkles aria-hidden="true" className="size-4 shrink-0 text-accent" />
        <span id={headingId} className="flex-1 text-sm font-semibold">Demo tour</span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{done.length} of {TOUR_STEPS.length}</span>
        {collapsed ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
        <span className="sr-only">{collapsed ? "Show steps" : "Hide steps"}</span>
      </button>
      {!collapsed && (
        <div id="demo-tour-steps" className="max-h-[42dvh] space-y-3 overflow-y-auto px-4 pb-3 lg:max-h-[60dvh]">
          {!connected && <p role="status" className="text-xs text-muted-foreground">Connecting to the demo room…</p>}
          <ol className="space-y-2">
            {TOUR_STEPS.map((step, index) => {
              const complete = done.includes(step);
              const current = step === next;
              return (
                // Phones show only the step in progress so the chat keeps its room; wide screens list all five.
                <li key={step} className={`gap-3 rounded-xl p-2 ${current ? "flex bg-muted" : "hidden lg:flex"}`}>
                  <span aria-hidden="true" className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${complete ? "bg-emerald-500 text-white" : current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {complete ? <Check className="size-3.5" /> : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${complete ? "text-muted-foreground line-through" : ""}`}>
                      {COPY[step].title}<span className="sr-only">{complete ? ", done" : current ? ", up next" : ""}</span>
                    </p>
                    {current && (
                      <div className="mt-1 space-y-2">
                        <p className="text-xs text-muted-foreground">{COPY[step].hint}</p>
                        <StepAction step={step} myDoubtId={myDoubtIds.at(-1)} onRoom={onRoom} />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          {finished && <FinalCard />}
          <p className="text-xs text-muted-foreground">Open /try in a second browser to see real-time sync between two users.</p>
        </div>
      )}
    </aside>
  );
}
