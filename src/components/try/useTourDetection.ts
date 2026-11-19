"use client";

import { useEffect, useMemo, useRef } from "react";

import { onTrack } from "@/lib/analytics";
import { BOT_IDS, DEMO_ROOM_ID } from "@/lib/nexconn/identities";
import { MSG } from "@/lib/nexconn/messages";
import { useConnection } from "@/lib/stores/connection";
import { channelKeyFor, useMessages, type ChatMessage } from "@/lib/stores/messages";
import { detectTourSteps, upvoteIncreased } from "@/lib/try/tour";
import { useTourState } from "./useTourState";

const NONE: ChatMessage[] = [];
const ROOM_KEY = channelKeyFor({ channelType: 3, channelId: DEMO_ROOM_ID });
const DM_KEY = channelKeyFor({ channelType: 1, channelId: BOT_IDS.DEMO_MENTOR });
const SEEN_RATIO = 0.6;
const LOOKUP_MS = 1_000;

export const ANNOUNCE_SCROLL_EVENT = "doubtroom:tour-show-announcement";

function upvoteCounts(messages: readonly ChatMessage[]) {
  return new Map(messages.filter((message) => message.messageType === MSG.ANSWER)
    .map((message) => [message.messageId, Number(message.metadata.get("up") ?? 0)] as const));
}

/** Ticks tour steps from the message store, tracked events and what is on screen. */
export function useTourDetection() {
  const userId = useConnection((state) => state.userId);
  const room = useMessages((state) => state.byChannel[ROOM_KEY] ?? NONE);
  const dm = useMessages((state) => state.byChannel[DM_KEY] ?? NONE);
  const markDone = useTourState((state) => state.markDone);
  const load = useTourState((state) => state.load);
  const upvotes = useRef<Map<string, number> | null>(null);
  const scrollRequested = useRef(false);

  useEffect(() => { if (userId) load(userId); }, [userId, load]);

  const detected = useMemo(() => userId ? detectTourSteps({ userId, roomMessages: room, dmMessages: dm }) : null, [userId, room, dm]);
  useEffect(() => { if (detected?.steps.length) markDone(detected.steps); }, [detected, markDone]);

  // Phase 7 upvotes update answer metadata live; an increase while the tour runs counts.
  useEffect(() => {
    const next = upvoteCounts(room);
    if (upvotes.current && upvoteIncreased(upvotes.current, next)) markDone(["upvote"]);
    upvotes.current = new Map([...(upvotes.current ?? []), ...next]);
  }, [room, markDone]);

  useEffect(() => onTrack(({ name }) => {
    if (name === "upvoted") markDone(["upvote"]);
  }), [markDone]);

  const announcementIds = useMemo(() => room.filter((message) => message.messageType === MSG.ANNOUNCE)
    .map(({ messageId }) => messageId), [room]);

  useEffect(() => {
    const onRequest = () => { scrollRequested.current = true; };
    window.addEventListener(ANNOUNCE_SCROLL_EVENT, onRequest);
    return () => window.removeEventListener(ANNOUNCE_SCROLL_EVENT, onRequest);
  }, []);

  // The announcement step ticks once a card is at least 60% visible.
  useEffect(() => {
    if (!announcementIds.length) return;
    const observed = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.intersectionRatio >= SEEN_RATIO)) markDone(["announce"]);
    }, { threshold: SEEN_RATIO });
    const lookup = () => {
      for (const id of announcementIds) {
        const row = document.querySelector(`[data-message-id="${CSS.escape(id)}"]`);
        if (!row) continue;
        if (!observed.has(row)) {
          observed.add(row);
          observer.observe(row);
        }
        if (scrollRequested.current) {
          scrollRequested.current = false;
          row.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }
    };
    lookup();
    const timer = setInterval(lookup, LOOKUP_MS);
    return () => {
      clearInterval(timer);
      observer.disconnect();
    };
  }, [announcementIds, markDone]);

  return { myDoubtIds: detected?.myDoubtIds ?? [], hasAnnouncement: announcementIds.length > 0 };
}
