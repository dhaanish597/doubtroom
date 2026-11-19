"use client";

import Link from "next/link";
import { BadgeCheck, ChevronRight, Sunrise } from "lucide-react";

import type { RecapContent } from "@/lib/nexconn/messages";

const recapDate = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function formatDate(date: string) {
  const parsed = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(parsed) ? recapDate.format(parsed) : date;
}

/** The morning recap from the TA: top answers from the last day. Each item opens its doubt. */
export function RecapCard({ recap, roomId, jumpTo }: {
  recap: RecapContent;
  roomId: string;
  /** Scrolls to a doubt that is already loaded in the timeline. */
  jumpTo?: (messageId: string) => (() => void) | undefined;
}) {
  return (
    <section aria-label={`Morning recap for ${formatDate(recap.date)}`} className="min-w-0 space-y-2">
      <header className="flex items-center gap-2">
        <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Sunrise className="size-4" />
        </span>
        <div>
          <p className="font-semibold leading-tight">Morning recap</p>
          <p className="text-xs text-muted-foreground">{formatDate(recap.date)}</p>
        </div>
      </header>
      {recap.items.length === 0 ? <p className="text-muted-foreground">No top answers from yesterday.</p> : (
        <ol className="divide-y divide-[#e9e7f4] overflow-hidden rounded-xl border border-border">
          {recap.items.map((item, index) => {
            const scroll = jumpTo?.(item.doubtMessageId);
            return (
              <li key={`${item.doubtMessageId}:${index}`}>
                <Link href={`/app/room/${roomId}?m=${encodeURIComponent(item.doubtMessageId)}`}
                  onClick={(event) => { if (scroll) { event.preventDefault(); scroll(); } }}
                  className="flex min-h-11 items-start gap-2 bg-card px-3 py-2.5 hover:bg-primary/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary">
                  <span className="mt-0.5 w-4 shrink-0 text-xs font-semibold text-primary">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 font-medium wrap-anywhere">{item.question}</span>
                    <span className="mt-0.5 block text-muted-foreground wrap-anywhere">{item.answerSummary}</span>
                    {item.verifiedBy && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        <BadgeCheck className="size-3.5" aria-hidden="true" />Verified by {item.verifiedBy}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
