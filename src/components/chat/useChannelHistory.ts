"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { ChannelIdentifier, MessagesQuery } from "@nexconn/chat";

import { initNexconn } from "@/lib/nexconn/client";
import { useMessages } from "@/lib/stores/messages";
import { captureMessageAnchor, type ScrollAnchor } from "./MessageList";

type ChatSdk = Awaited<ReturnType<typeof initNexconn>>;
type Cursor = { createQuery: (startTime?: number) => MessagesQuery; busy: boolean; more: boolean; oldest?: number };

const PAGE_SIZE = 30;

/**
 * Pages a channel's history into the message store, newest page first.
 * `open` runs once per connection and returns the channel to page through.
 */
export function useChannelHistory({ connected, open, close, onStarted, viewport }: {
  connected: boolean;
  open: (sdk: ChatSdk) => ChannelIdentifier;
  close?: () => void;
  onStarted?: () => void;
  viewport: RefObject<HTMLDivElement | null>;
}) {
  const anchor = useRef<ScrollAnchor | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasOlder, setHasOlder] = useState(false);
  const [historyFloor, setHistoryFloor] = useState<number | null>(null);
  const history = useRef<Cursor | null>(null);

  const load = useCallback(async (cursor: Cursor, older: boolean) => {
    if (cursor.busy || !cursor.more) return;
    cursor.busy = true;
    setLoading(true);
    setError("");
    try {
      // v26.2.1 can return oldest-first records for a descending request. Base the
      // next query on the oldest timestamp rather than the SDK's last returned row.
      const page = await cursor.createQuery(cursor.oldest).loadNextPage();
      if (history.current !== cursor) return;
      if (!page.isOk) throw new Error("History page failed");
      const list = page.data?.data ?? [];
      const earliest = Math.min(...list.map(({ sentTime }) => sentTime));
      cursor.more = Number.isFinite(earliest) && (cursor.oldest === undefined || earliest < cursor.oldest);
      if (cursor.more) cursor.oldest = earliest;
      if (older && list.length) anchor.current = captureMessageAnchor(viewport.current);
      if (Number.isFinite(earliest)) {
        setHistoryFloor((previous) => Math.min(previous ?? Infinity, earliest));
      } else {
        setHistoryFloor((previous) => previous ?? -Infinity);
      }
      useMessages.getState().mergeMessages(list);
      setHasOlder(cursor.more);
      setReady(true);
    } catch {
      if (history.current === cursor) setError("Could not load messages.");
    } finally {
      cursor.busy = false;
      if (history.current === cursor) setLoading(false);
    }
  }, [viewport]);

  const start = useCallback(async (active: () => boolean) => {
    try {
      const sdk = await initNexconn();
      if (!active()) return;
      const channelIdentifier = open(sdk);
      const cursor: Cursor = {
        createQuery: (startTime) => sdk.BaseChannel.createMessagesQuery({
          channelIdentifier, pageSize: PAGE_SIZE, isAscending: false, startTime,
        }),
        busy: false, more: true,
      };
      history.current = cursor;
      await load(cursor, false);
    } catch {
      if (active()) setError("Could not open chat.");
    }
  }, [open, load]);

  useEffect(() => {
    if (!connected) return;
    let active = true;
    const initialize = setTimeout(() => {
      void start(() => active).then(() => { if (active) onStarted?.(); });
    }, 0);
    return () => {
      active = false;
      clearTimeout(initialize);
      history.current = null;
      close?.();
    };
  }, [connected, start, close, onStarted]);

  const loadMore = useCallback((active: () => boolean) => {
    const cursor = history.current;
    if (cursor) void load(cursor, ready);
    else void start(active);
  }, [load, start, ready]);

  return { ready, loading, error, hasOlder, historyFloor, loadMore, anchor };
}
