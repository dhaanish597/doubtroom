"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BOARD_TABS, type BoardTab } from "@/lib/answers/rules";
import type { DoubtBoardResponse } from "@/lib/answers/types";
import { DoubtSummary } from "./DoubtRow";

type LoadState = { status: "loading" } | { status: "failed" } | { status: "ready"; data: DoubtBoardResponse };

const tabLabels: Record<BoardTab, string> = { open: "Open", ai: "AI answered", verified: "Verified" };
const emptyCopy: Record<BoardTab, { title: string; body: string }> = {
  open: { title: "No open doubts", body: "Every doubt here has an answer. Post a new one from Chat." },
  ai: { title: "Nothing waiting for review", body: "AI answers show up here until a senior checks them." },
  verified: { title: "No verified answers yet", body: "Answers that a senior checks will collect here." },
};

export function DoubtBoard({ roomId }: { roomId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [tab, setTab] = useState<BoardTab>("open");
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => { setState({ status: "loading" }); setAttempt((value) => value + 1); }, []);

  useEffect(() => {
    const controller = new AbortController();
    const load = () => fetch(`/api/rooms/${encodeURIComponent(roomId)}/doubts`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Doubts unavailable");
        const data = await response.json() as DoubtBoardResponse;
        if (!controller.signal.aborted) setState({ status: "ready", data });
      })
      .catch(() => { if (!controller.signal.aborted) setState((current) => current.status === "ready" ? current : { status: "failed" }); });
    void load();
    // Refresh when the student comes back to the tab, so new answers show up.
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [roomId, attempt]);

  if (state.status === "loading") {
    return (
      <div role="status" aria-label="Loading doubts" className="space-y-3">
        <Skeleton className="h-11 w-full rounded-full" />
        {[1, 2, 3].map((key) => <Skeleton key={key} className="h-24 w-full rounded-xl" />)}
      </div>
    );
  }
  if (state.status === "failed") {
    return (
      <div className="rounded-xl border p-5">
        <p role="alert" className="text-sm text-destructive">Could not load doubts.</p>
        <Button type="button" variant="outline" className="mt-3 min-h-11" onClick={retry}>Try again</Button>
      </div>
    );
  }

  const { doubts, counts } = state.data;
  const visible = doubts.filter((doubt) => doubt.tab === tab);
  return (
    <div>
      <div role="tablist" aria-label="Doubt status" className="flex gap-1 rounded-full bg-[#f2f0fb] p-1">
        {BOARD_TABS.map((name) => (
          <button key={name} type="button" role="tab" id={`doubts-tab-${name}`} aria-selected={tab === name} aria-controls="doubts-panel"
            onClick={() => setTab(name)}
            className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary ${tab === name ? "bg-white text-primary shadow-xs" : "text-muted-foreground hover:text-foreground"}`}>
            <span className="truncate">{tabLabels[name]}</span>
            <span className={`rounded-full px-1.5 text-xs tabular-nums ${tab === name ? "bg-primary/10" : "bg-white/70"}`}>{counts[name]}</span>
          </button>
        ))}
      </div>
      <div id="doubts-panel" role="tabpanel" aria-labelledby={`doubts-tab-${tab}`} className="mt-4">
        {!visible.length ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <h3 className="font-semibold">{emptyCopy[tab].title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{emptyCopy[tab].body}</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {visible.map((doubt) => {
              const body = <DoubtSummary doubt={doubt} />;
              return (
                <li key={doubt.id}>
                  {doubt.messageId ? (
                    <Link href={`/app/room/${encodeURIComponent(roomId)}?m=${encodeURIComponent(doubt.messageId)}`}
                      className="flex items-center gap-2 rounded-xl border bg-card p-3.5 transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary">
                      <span className="min-w-0 flex-1">{body}</span>
                      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                      <span className="sr-only">Open in chat</span>
                    </Link>
                  ) : <div className="rounded-xl border bg-card p-3.5">{body}</div>}
                </li>
              );
            })}
          </ul>
        )}
        {doubts.length >= 100 && <p className="mt-4 text-center text-xs text-muted-foreground">Showing the latest 100 doubts.</p>}
      </div>
    </div>
  );
}
