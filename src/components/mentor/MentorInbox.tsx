"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, MessagesSquare } from "lucide-react";

import { DoubtSummary } from "@/components/doubts/DoubtRow";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trackDmEvent } from "@/lib/analytics";
import { useInboxBadge } from "@/lib/answers/client";
import type { InboxDoubt, MentorInboxResponse } from "@/lib/answers/types";
import { dmHref } from "@/lib/mentors/types";
import { VerifyButton } from "./VerifyButton";

type LoadState = { status: "loading" } | { status: "failed" } | { status: "ready"; doubts: InboxDoubt[]; count: number };

function InboxItem({ doubt, onVerified }: { doubt: InboxDoubt; onVerified: () => void }) {
  const roomHref = `/app/room/${encodeURIComponent(doubt.roomId)}${doubt.messageId ? `?m=${encodeURIComponent(doubt.messageId)}` : ""}`;
  return (
    <li className="rounded-xl border bg-card p-3.5">
      <p className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-primary">
        {doubt.courseCode && <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold">{doubt.courseCode}</span>}
        <span className="truncate">{doubt.roomTitle}</span>
      </p>
      <DoubtSummary doubt={doubt} />
      {doubt.answer && (
        <div className="mt-3 rounded-lg border-s-4 border-indigo-500 bg-indigo-50/60 px-3 py-2 text-sm">
          <p className="text-xs font-semibold text-indigo-900">TA answer</p>
          <p className="mt-0.5 line-clamp-4 wrap-anywhere text-foreground/90">{doubt.answer.preview}</p>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-start gap-2">
        {doubt.answer && <VerifyButton answerId={doubt.answer.id} verified={false} onDone={onVerified} />}
        <Button asChild variant="outline" className="min-h-11 rounded-xl px-3 text-xs">
          <Link href={roomHref}><MessagesSquare aria-hidden="true" />Open in room</Link>
        </Button>
        {doubt.asker && (
          <Button asChild variant="ghost" className="min-h-11 rounded-xl px-3 text-xs">
            <Link href={dmHref(doubt.asker.nexconnId, { roomId: doubt.roomId, doubtMessageId: doubt.messageId ?? undefined })}
              onClick={() => doubt.asker && trackDmEvent("dm_started", doubt.asker.nexconnId)}>
              <MessageCircle aria-hidden="true" />Message student
            </Link>
          </Button>
        )}
      </div>
    </li>
  );
}

export function MentorInbox() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const setCount = useInboxBadge((badge) => badge.setCount);
  const retry = useCallback(() => { setState({ status: "loading" }); setAttempt((value) => value + 1); }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/mentor/inbox", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Inbox unavailable");
        const { doubts, count } = await response.json() as MentorInboxResponse;
        if (controller.signal.aborted) return;
        setState({ status: "ready", doubts, count });
        setCount(count);
      })
      .catch(() => { if (!controller.signal.aborted) setState({ status: "failed" }); });
    return () => controller.abort();
  }, [attempt, setCount]);

  function verified(doubtId: string) {
    if (state.status !== "ready") return;
    const count = Math.max(0, state.count - 1);
    setState({ ...state, doubts: state.doubts.filter((doubt) => doubt.id !== doubtId), count });
    setCount(count);
  }

  if (state.status === "loading") {
    return <div role="status" aria-label="Loading your inbox" className="space-y-3">{[1, 2, 3].map((key) => <Skeleton key={key} className="h-40 w-full rounded-xl" />)}</div>;
  }
  if (state.status === "failed") {
    return (
      <div className="rounded-xl border p-5">
        <p role="alert" className="text-sm text-destructive">Could not load your inbox.</p>
        <Button type="button" variant="outline" className="mt-3 min-h-11" onClick={retry}>Try again</Button>
      </div>
    );
  }
  if (!state.doubts.length) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center">
        <h2 className="font-semibold">You’re all caught up</h2>
        <p className="mt-1 text-sm text-muted-foreground">New AI answers in your subjects will show up here for you to check.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        {state.count === 1 ? "1 answer needs" : `${state.count} answers need`} a senior check. Oldest first.
      </p>
      <ul className="space-y-3">
        {state.doubts.map((doubt) => <InboxItem key={doubt.id} doubt={doubt} onVerified={() => verified(doubt.id)} />)}
      </ul>
    </div>
  );
}
