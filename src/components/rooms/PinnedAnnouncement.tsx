"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Megaphone } from "lucide-react";

import { isAnnouncementSender, latestPinned, PIN_WINDOW_MS } from "@/lib/moderation/rules";
import type { PinnedAnnouncement as Pinned } from "@/lib/moderation/types";
import { MSG, safeParseAnnounce } from "@/lib/nexconn/messages";
import { messageTime } from "@/lib/rooms/timeline";
import { channelKeyFor, useMessages, type ChatMessage } from "@/lib/stores/messages";
import { useProfiles } from "@/lib/stores/profiles";
import { useRoomContext } from "./RoomContext";

const EMPTY: ChatMessage[] = [];
const RECHECK_MS = 5 * 60_000;

function fromMessage(message: ChatMessage): Omit<Pinned, "authorName"> | null {
  if (message.messageType !== MSG.ANNOUNCE || message.messageId.startsWith("local:")) return null;
  const content = safeParseAnnounce(message.content).data;
  return content ? {
    messageId: message.messageId, title: content.title, body: content.body, urgent: Boolean(content.urgent),
    sentTime: message.sentTime, authorId: message.senderUserId,
  } : null;
}

/** The latest announcement from the last 24 hours, pinned under the room header. */
export function PinnedAnnouncement() {
  const room = useRoomContext();
  const roomId = room?.roomId ?? "";
  const stored = room?.moderation?.pinned ?? null;
  const messages = useMessages((state) => state.byChannel[channelKeyFor({ channelType: 3, channelId: roomId })] ?? EMPTY);
  const profiles = useProfiles((state) => state.profiles);
  const [now, setNow] = useState(() => Date.now());
  const [openId, setOpenId] = useState<string | null>(null);

  // Drop the pin once it is older than 24 hours.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), RECHECK_MS);
    return () => clearInterval(timer);
  }, []);

  const pinned = useMemo(() => {
    const live = messages.flatMap((message) => {
      if (!isAnnouncementSender(room?.kind, roomId, message.senderUserId, profiles[message.senderUserId]?.role)) return [];
      const entry = fromMessage(message);
      return entry ? [{ ...entry, authorName: "" }] : [];
    });
    return latestPinned(stored ? [stored, ...live] : live, now);
  }, [messages, stored, now, room?.kind, roomId, profiles]);

  if (!room || !pinned || now - pinned.sentTime > PIN_WINDOW_MS) return null;
  const author = pinned.authorName || profiles[pinned.authorId]?.name || "Class rep";
  const open = openId === pinned.messageId;
  const tone = pinned.urgent ? "border-red-200 bg-red-50 text-red-950" : "border-amber-200 bg-amber-50 text-amber-950";

  function jump() {
    const row = document.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(pinned?.messageId ?? "")}"]`);
    row?.scrollIntoView({ block: "center", behavior: "smooth" });
    row?.focus({ preventScroll: true });
  }

  return (
    <section aria-label="Pinned announcement" className={`shrink-0 border-b ${tone}`}>
      <div className="mx-auto max-w-3xl px-2.5 sm:px-5">
        <button type="button" aria-expanded={open} aria-controls="pinned-announcement-body"
          className="flex min-h-11 w-full items-center gap-2 py-1.5 text-left text-sm focus-visible:outline-2 focus-visible:outline-primary"
          onClick={() => setOpenId(open ? null : pinned.messageId)}>
          <Megaphone aria-hidden="true" className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="sr-only">{pinned.urgent ? "Urgent announcement: " : "Announcement: "}</span>
            <span className="line-clamp-1 font-semibold wrap-anywhere">{pinned.title}</span>
          </span>
          <ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div id="pinned-announcement-body" className="space-y-1 pb-2.5 text-sm">
            <p className="max-h-40 overflow-y-auto whitespace-pre-wrap wrap-anywhere">{pinned.body}</p>
            <div className="flex flex-wrap items-center gap-x-3 text-xs opacity-80">
              <span>{author} · {messageTime(pinned.sentTime)}</span>
              <button type="button" className="min-h-11 font-semibold underline underline-offset-2" onClick={jump}>Show in chat</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
