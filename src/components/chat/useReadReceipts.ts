"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { DirectChannel } from "@nexconn/chat";

import { initNexconn } from "@/lib/nexconn/client";
import type { ChatMessage } from "@/lib/stores/messages";

const ACK_DEBOUNCE_MS = 500;
const READ = 50;

/**
 * Sends read receipts for the peer's messages once they are on screen, and tracks which of
 * our own messages the peer has read (live events plus a one-time lookup per message).
 */
export function useReadReceipts({ peerId, userId, connected, messages, channel, viewport }: {
  peerId: string;
  userId: string | null;
  connected: boolean;
  messages: ChatMessage[];
  channel: RefObject<DirectChannel | null>;
  viewport: RefObject<HTMLDivElement | null>;
}) {
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(() => new Set());
  const queried = useRef(new Set<string>());
  const acked = useRef(new Set<string>());
  const onScreen = useRef(new Set<string>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const markRead = (ids: string[]) => {
    if (ids.length) setReadIds((current) => new Set([...current, ...ids]));
  };

  // Live receipts for messages we sent.
  useEffect(() => {
    if (!connected) return;
    const handlerId = `dm-receipts:${peerId}`;
    let active = true;
    void initNexconn().then(({ ChannelType, MessageHandler, NCEngine }) => {
      if (!active) return;
      NCEngine.addMessageHandler(handlerId, new MessageHandler({
        onMessageReceiptResponse({ responses }) {
          markRead(responses.filter(({ channelIdentifier, readCount }) => readCount > 0
            && channelIdentifier.channelType === ChannelType.DIRECT && channelIdentifier.channelId === peerId)
            .map(({ messageId }) => messageId));
        },
      }));
    }).catch(() => undefined);
    return () => {
      active = false;
      void initNexconn().then(({ NCEngine }) => NCEngine.removeMessageHandler(handlerId)).catch(() => undefined);
    };
  }, [connected, peerId]);

  // Receipts that arrived while this page was closed.
  useEffect(() => {
    const direct = channel.current;
    if (!connected || !direct || !userId) return;
    const ids = messages.filter((message) => message.senderUserId === userId && !message.messageId.startsWith("local:")
      && (message.sentStatus ?? 0) < READ && !queried.current.has(message.messageId)).map(({ messageId }) => messageId);
    if (!ids.length) return;
    for (const id of ids) queried.current.add(id);
    void direct.getMessageReadReceiptInfo(ids).then((result) => {
      if (result.isOk) markRead((result.data ?? []).filter(({ readCount }) => readCount > 0).map(({ messageId }) => messageId));
      else for (const id of ids) queried.current.delete(id);
    }).catch(() => { for (const id of ids) queried.current.delete(id); });
  }, [connected, messages, userId, channel]);

  // Acknowledge the peer's messages that are visible on screen.
  useEffect(() => {
    const panel = viewport.current;
    const visibleIds = onScreen.current;
    if (!connected || !panel) return;
    const flush = () => {
      clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => {
        const direct = channel.current;
        if (!direct || document.visibilityState !== "visible") return;
        const ids = [...onScreen.current].filter((id) => !acked.current.has(id));
        if (!ids.length) return;
        for (const id of ids) acked.current.add(id);
        void direct.sendReadReceiptResponse(ids).then((result) => {
          if (!result.isOk) for (const id of ids) acked.current.delete(id);
        }).catch(() => { for (const id of ids) acked.current.delete(id); });
      }, ACK_DEBOUNCE_MS);
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.messageId;
        if (!id) continue;
        if (entry.isIntersecting) onScreen.current.add(id);
        else onScreen.current.delete(id);
      }
      flush();
    }, { root: panel, threshold: 0.6 });
    const unread = new Set(messages.filter((message) => message.senderUserId === peerId && !message.sentReceipt
      && !acked.current.has(message.messageId)).map(({ messageId }) => messageId));
    for (const row of panel.querySelectorAll<HTMLElement>("[data-message-id]")) {
      if (unread.has(row.dataset.messageId ?? "")) observer.observe(row);
    }
    const onVisible = () => flush();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      observer.disconnect();
      clearTimeout(flushTimer.current);
      visibleIds.clear();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [connected, messages, peerId, channel, viewport]);

  return readIds;
}
