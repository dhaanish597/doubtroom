"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { GroupChannel } from "@nexconn/chat";

import { initNexconn } from "@/lib/nexconn/client";
import { MSG } from "@/lib/nexconn/messages";
import type { ChatMessage } from "@/lib/stores/messages";
import { useReceipts } from "@/lib/stores/receipts";

const DWELL_MS = 1_000;
const ACK_DEBOUNCE_MS = 500;
const VISIBLE_RATIO = 0.6;
const INFO_BATCH = 50;

/**
 * Group read receipts for announcements (PLAN F6). Members acknowledge an announcement once it
 * has been at least 60% visible for a second, batched per room. The author, and admins when
 * Nexconn allows it, get "Seen by" counts from a lookup on load and from live receipt events.
 */
export function useGroupReceipts({ roomId, userId, connected, messages, channel, viewport, trackAll }: {
  roomId: string;
  userId: string | null;
  connected: boolean;
  messages: ChatMessage[];
  channel: RefObject<GroupChannel | null>;
  viewport: RefObject<HTMLDivElement | null>;
  /** Admins look up counts for every announcement, not only their own. */
  trackAll: boolean;
}) {
  const acked = useRef(new Set<string>());
  const ready = useRef(new Set<string>());
  const dwell = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queried = useRef(new Set<string>());

  // Live counts for announcements this user sent.
  useEffect(() => {
    if (!connected) return;
    const handlerId = `group-receipts:${roomId}`;
    let active = true;
    void initNexconn().then(({ ChannelType, MessageHandler, NCEngine }) => {
      if (!active) return;
      NCEngine.addMessageHandler(handlerId, new MessageHandler({
        onMessageReceiptResponse({ responses }) {
          useReceipts.getState().setCounts(responses.filter(({ channelIdentifier }) =>
            channelIdentifier.channelType === ChannelType.GROUP && channelIdentifier.channelId === roomId)
            .map(({ messageId, readCount, totalCount }) => ({ messageId, read: readCount, total: totalCount })));
        },
      }));
    }).catch(() => undefined);
    return () => {
      active = false;
      void initNexconn().then(({ NCEngine }) => NCEngine.removeMessageHandler(handlerId)).catch(() => undefined);
    };
  }, [connected, roomId]);

  // Counts that arrived while the room was closed.
  useEffect(() => {
    const room = channel.current;
    if (!connected || !room || !userId) return;
    const ids = messages.filter((message) => message.messageType === MSG.ANNOUNCE && !message.messageId.startsWith("local:")
      && (trackAll || message.senderUserId === userId) && !queried.current.has(message.messageId))
      .map(({ messageId }) => messageId);
    for (let start = 0; start < ids.length; start += INFO_BATCH) {
      const batch = ids.slice(start, start + INFO_BATCH);
      for (const id of batch) queried.current.add(id);
      void room.getMessageReadReceiptInfo(batch).then((result) => {
        if (!result.isOk) {
          useReceipts.getState().setError(batch, result.code);
          return;
        }
        useReceipts.getState().setCounts((result.data ?? []).map(({ messageId, readCount, totalCount }) =>
          ({ messageId, read: readCount, total: totalCount })));
      }).catch(() => useReceipts.getState().setError(batch, -1));
    }
  }, [connected, messages, userId, channel, trackAll]);

  // Acknowledge announcements from others after they have been on screen for a second.
  useEffect(() => {
    const panel = viewport.current;
    const timers = dwell.current;
    const queue = ready.current;
    if (!connected || !panel || !userId) return;

    const flush = () => {
      clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => {
        const room = channel.current;
        if (!room || document.visibilityState !== "visible") return;
        const ids = [...queue].filter((id) => !acked.current.has(id));
        queue.clear();
        if (!ids.length) return;
        for (const id of ids) acked.current.add(id);
        void room.sendReadReceiptResponse(ids).then((result) => {
          if (!result.isOk) for (const id of ids) acked.current.delete(id);
        }).catch(() => { for (const id of ids) acked.current.delete(id); });
      }, ACK_DEBOUNCE_MS);
    };

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.messageId;
        if (!id) continue;
        clearTimeout(timers.get(id));
        timers.delete(id);
        if (!entry.isIntersecting) continue;
        timers.set(id, setTimeout(() => {
          timers.delete(id);
          if (document.visibilityState !== "visible") return;
          queue.add(id);
          flush();
        }, DWELL_MS));
      }
    }, { root: panel, threshold: VISIBLE_RATIO });

    const pending = new Set(messages.filter((message) => message.messageType === MSG.ANNOUNCE
      && message.senderUserId !== userId && !message.sentReceipt && !acked.current.has(message.messageId))
      .map(({ messageId }) => messageId));
    for (const row of panel.querySelectorAll<HTMLElement>("[data-message-id]")) {
      if (pending.has(row.dataset.messageId ?? "")) observer.observe(row);
    }
    return () => {
      observer.disconnect();
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      clearTimeout(flushTimer.current);
      queue.clear();
    };
  }, [connected, messages, userId, channel, viewport]);
}
