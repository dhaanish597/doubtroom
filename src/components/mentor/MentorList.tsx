"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { trackDmEvent } from "@/lib/analytics";
import { dmHref, type MentorSummary } from "@/lib/mentors/types";
import { mediaUrl } from "@/lib/nexconn/messages";

type LoadState = { status: "loading" } | { status: "failed" } | { status: "ready"; mentors: MentorSummary[] };

export function OnlineDot({ online, className = "" }: { online: boolean | null; className?: string }) {
  return <span aria-hidden="true" className={`inline-block size-2.5 rounded-full ring-2 ring-white ${online ? "bg-emerald-500" : "bg-zinc-300"} ${className}`} />;
}

export function mentorDetails(mentor: Pick<MentorSummary, "dept" | "year">) {
  return [mentor.dept, mentor.year ? `Year ${mentor.year}` : null].filter(Boolean).join(" · ");
}

function MentorList({ course, roomId, doubtMessageId }: { course: string; roomId?: string; doubtMessageId?: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/mentors?${new URLSearchParams({ course })}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Mentors unavailable");
        const { mentors } = await response.json() as { mentors: MentorSummary[] };
        if (!controller.signal.aborted) setState({ status: "ready", mentors });
      })
      .catch(() => { if (!controller.signal.aborted) setState({ status: "failed" }); });
    return () => controller.abort();
  }, [course, attempt]);

  if (state.status === "loading") {
    return <div role="status" aria-label="Loading seniors" className="space-y-2 px-4">{[1, 2, 3].map((key) => <Skeleton key={key} className="h-16 rounded-xl" />)}</div>;
  }
  if (state.status === "failed") {
    return (
      <div className="px-4">
        <p role="alert" className="mb-3 text-sm text-destructive">Could not load seniors.</p>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => { setState({ status: "loading" }); setAttempt((value) => value + 1); }}>Retry</Button>
      </div>
    );
  }
  if (!state.mentors.length) {
    return <p className="mx-4 rounded-xl border p-4 text-sm text-muted-foreground">No seniors have signed up for this subject yet. The TA is still here to help.</p>;
  }

  return (
    <ul className="divide-y overflow-y-auto border-y">
      {state.mentors.map((mentor) => {
        const avatar = mediaUrl(mentor.avatar);
        const details = mentorDetails(mentor);
        return (
          <li key={mentor.nexconnId} className="flex items-center gap-3 px-4 py-3">
            <span className="relative">
              <Avatar>
                {avatar && <AvatarImage alt="" src={avatar} referrerPolicy="no-referrer" />}
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{mentor.name.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <OnlineDot online={mentor.online} className="absolute -right-0.5 -bottom-0.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{mentor.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {mentor.online ? "Online" : "Offline"}{details && ` · ${details}`}
              </span>
            </span>
            <Button asChild className="min-h-11 rounded-xl">
              <Link href={dmHref(mentor.nexconnId, { roomId, doubtMessageId })} onClick={() => trackDmEvent("dm_started", mentor.nexconnId)}>
                <MessageCircle aria-hidden="true" />Message
              </Link>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

export function AskSeniorSheet({ course, roomId, doubtMessageId, children }: {
  course: string; roomId?: string; doubtMessageId?: string; children: ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold">Ask a senior</SheetTitle>
          <SheetDescription>Seniors who know {course}. Online seniors are listed first.</SheetDescription>
        </SheetHeader>
        <MentorList course={course} roomId={roomId} doubtMessageId={doubtMessageId} />
      </SheetContent>
    </Sheet>
  );
}
