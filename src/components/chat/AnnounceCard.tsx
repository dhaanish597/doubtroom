"use client";

import { ChevronRight, Megaphone } from "lucide-react";

import { useRoomContext } from "@/components/rooms/RoomContext";
import { seenLabel } from "@/lib/moderation/rules";
import type { AnnounceContent } from "@/lib/nexconn/messages";
import { messageTime } from "@/lib/rooms/timeline";
import { useReceipts } from "@/lib/stores/receipts";
import { ReadersSheet } from "./ReadersSheet";

/** Members other than the author and the TA bot, for the "Delivered to" fallback. */
export function deliveredTotal(memberCount: number | undefined) {
  return Math.max(0, (memberCount ?? 0) - 2);
}

function SeenBy({ roomId, messageId, memberCount }: { roomId: string; messageId: string; memberCount?: number }) {
  const receipt = useReceipts((state) => state.byMessage[messageId]);
  const count = receipt && "read" in receipt ? receipt : null;
  const label = seenLabel(count, deliveredTotal(memberCount));
  if (!count) return <p role="status" className="text-xs font-medium text-amber-900/80">{receipt ? label : "Checking who has seen it…"}</p>;
  return (
    <ReadersSheet roomId={roomId} messageId={messageId}>
      <button type="button" aria-live="polite" className="inline-flex min-h-11 items-center gap-1 rounded-lg text-xs font-semibold text-amber-950 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary">
        {label}<ChevronRight aria-hidden="true" className="size-3.5" />
      </button>
    </ReadersSheet>
  );
}

export function AnnounceCard({ announcement, messageId, author, own, sentTime }: {
  announcement: AnnounceContent; messageId: string; author: string; own: boolean; sentTime: number;
}) {
  const room = useRoomContext();
  // isAdmin already excludes try visitors (viewerModeration).
  const showReceipts = Boolean(room) && !messageId.startsWith("local:") && (own || Boolean(room?.moderation?.isAdmin));
  return (
    <section aria-label={`Announcement: ${announcement.title}`}
      className={`min-w-0 space-y-1.5 rounded-xl border-s-4 p-2.5 ${announcement.urgent ? "border-red-600 bg-red-50" : "border-amber-500 bg-amber-50"}`}>
      <header className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-white ${announcement.urgent ? "bg-red-600" : "bg-amber-600"}`}>
          <Megaphone aria-hidden="true" className="size-3.5" />{announcement.urgent ? "Urgent" : "Announcement"}
        </span>
        <span className="text-xs text-muted-foreground">{author} · {messageTime(sentTime)}</span>
      </header>
      <h3 className="font-semibold leading-snug wrap-anywhere text-foreground">{announcement.title}</h3>
      <p className="whitespace-pre-wrap wrap-anywhere text-foreground/90">{announcement.body}</p>
      {showReceipts && room && <SeenBy roomId={room.roomId} messageId={messageId} memberCount={room.memberCount} />}
    </section>
  );
}
