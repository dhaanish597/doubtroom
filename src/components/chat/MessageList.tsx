"use client";

import { Fragment, useLayoutEffect, useRef, type RefObject } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { groupMessages, messageDate } from "@/lib/rooms/timeline";
import type { ChatMessage } from "@/lib/stores/messages";
import { MessageBubble } from "./MessageBubble";

export type ScrollAnchor = { id: string; top: number };

export function captureMessageAnchor(viewport: HTMLDivElement | null): ScrollAnchor | null {
  if (!viewport) return null;
  const edge = viewport.getBoundingClientRect().top;
  for (const row of viewport.querySelectorAll<HTMLElement>("[data-message-id]")) {
    const rect = row.getBoundingClientRect();
    if (rect.bottom > edge && row.dataset.messageId) return { id: row.dataset.messageId, top: rect.top - edge };
  }
  return null;
}

export function MessageList({ messages, userId, ready, connected, loading, error, hasOlder, viewportRef, anchorRef, onLoad, onRetry }: {
  messages: ChatMessage[];
  userId: string | null;
  ready: boolean;
  connected: boolean;
  loading: boolean;
  error: string;
  hasOlder: boolean;
  viewportRef: RefObject<HTMLDivElement | null>;
  anchorRef: RefObject<ScrollAnchor | null>;
  onLoad: () => void;
  onRetry: (id: string) => void;
}) {
  const bottom = useRef(true);
  const pill = useRef<HTMLButtonElement>(null);
  const announcement = useRef<HTMLSpanElement>(null);
  const last = useRef<ChatMessage>(undefined);
  const shown = useRef(false);

  useLayoutEffect(() => {
    const panel = viewportRef.current;
    if (!panel) return;
    const marker = anchorRef.current;
    const newest = messages.at(-1);
    const changed = last.current && newest && newest.messageId !== last.current.messageId
      && newest.sentTime >= last.current.sentTime;
    last.current = newest;
    const jump = !shown.current || bottom.current || (changed && newest.senderUserId === userId);
    shown.current = Boolean(messages.length);
    anchorRef.current = null;

    if (marker && !bottom.current) {
      const row = panel.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(marker.id)}"]`);
      if (row) panel.scrollBy(0, row.getBoundingClientRect().top - panel.getBoundingClientRect().top - marker.top);
    } else if (jump) {
      panel.scrollTo(0, panel.scrollHeight);
    }
    if (changed && newest.senderUserId !== userId && announcement.current) {
      announcement.current.textContent = "New room message";
    }
    if (pill.current) {
      if (jump) pill.current.hidden = true;
      else if (changed) pill.current.hidden = false;
    }
  }, [messages, viewportRef, anchorRef, userId]);

  function scroll() {
    const panel = viewportRef.current;
    if (!panel) return;
    bottom.current = panel.scrollHeight - panel.clientHeight - panel.scrollTop < 64;
    if (bottom.current && pill.current) pill.current.hidden = true;
    if (panel.scrollTop < 72 && !bottom.current && hasOlder && !error) onLoad();
  }

  return (
    <div className="relative min-h-0 flex-1 bg-[#f9f8fd]">
      <div tabIndex={0} aria-label="Room messages" ref={viewportRef} onScroll={scroll} className="h-full overflow-y-auto overscroll-contain [overflow-anchor:none] focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary/70">
        <div className="mx-auto flex min-h-full max-w-3xl flex-col px-3 py-3 sm:px-5 sm:py-4">
          {connected && (loading || error || (hasOlder && ready)) && (
            <div className="mb-3 flex shrink-0 flex-col items-center gap-1 text-sm">
              {loading && <p role="status" className="text-muted-foreground">{ready ? "Loading older messages…" : "Loading messages…"}</p>}
              {error && <p role="alert" className="text-destructive">{error}</p>}
              {!loading && (error || hasOlder) && <Button variant="ghost" type="button" className="h-11 text-primary" onClick={onLoad}>{error ? "Retry history" : "Load earlier messages"}</Button>}
            </div>
          )}
          {(!ready && !error && connected && !messages.length) && (
            <div aria-hidden="true" className="space-y-4 pt-4">
              <Skeleton className="h-15 w-3/5 rounded-2xl bg-primary/8" />
              <Skeleton className="ml-auto h-15 w-2/5 rounded-2xl bg-primary/8" />
              <Skeleton className="h-15 w-1/2 rounded-2xl bg-primary/8" />
            </div>
          )}
          {!connected && !messages.length && <p role="status" className="my-auto text-center text-sm text-muted-foreground">Chat will appear when you’re connected.</p>}
          {ready && !error && !messages.length && connected && (
            <div className="m-auto flex max-w-xs flex-col items-center p-6 text-center">
              <svg aria-hidden="true" width="100" height="90" viewBox="0 0 100 90" fill="none" className="mb-5">
                <rect x="7" y="10" width="71" height="59" rx="18" fill="#eeebff"/>
                <path d="M28 26h39a15 15 0 0 1 15 15v11a15 15 0 0 1-15 15H53l-12 10V67H28a15 15 0 0 1-15-15V41a15 15 0 0 1 15-15Z" fill="white" stroke="#3B2FC9" strokeWidth="2.5"/>
                <path d="M32 44h31M32 53h20" stroke="#3B2FC9" strokeWidth="2.5" strokeLinecap="round"/>
                <path d="m81 8 2.5 6.5L90 17l-6.5 2.5L81 26l-2.5-6.5L72 17l6.5-2.5L81 8Z" fill="#F5A524"/>
              </svg>
              <h2 className="text-lg font-semibold text-foreground">Be the first to ask a doubt</h2>
            </div>
          )}
          <ol className="mt-auto flex flex-col" aria-label="Conversation">
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const nextDay = !previous || messageDate(previous.sentTime) !== messageDate(message.sentTime);
              const grouped = groupMessages(previous, message);
              return (
                <Fragment key={message.messageId}>
                  {nextDay && messageDate(message.sentTime) && <li className="my-5 flex items-center gap-3 text-xs font-medium text-muted-foreground before:h-px before:flex-1 before:bg-[#e9e7f4] after:h-px after:flex-1 after:bg-[#e9e7f4]">{messageDate(message.sentTime)}</li>}
                  <li data-message-id={message.messageId} className={grouped ? "mt-0.5" : "mt-3 first:mt-0"}>
                    <MessageBubble message={message} own={message.senderUserId === userId} grouped={grouped}
                      retry={connected && message.messageId.startsWith("local:") ? () => onRetry(message.messageId) : undefined} />
                  </li>
                </Fragment>
              );
            })}
          </ol>
        </div>
      </div>
      <span ref={announcement} role="status" className="sr-only" />
      <button ref={pill} hidden type="button" className="absolute bottom-3 left-1/2 min-h-11 -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-4 text-sm font-semibold text-white shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary not-hidden:inline-flex" onClick={() => {
        const panel = viewportRef.current;
        if (panel) {
          bottom.current = true;
          panel.scrollTo(0, panel.scrollHeight);
          panel.focus({ preventScroll: true });
        }
        if (pill.current) pill.current.hidden = true;
      }}>
        <ArrowDown className="size-4" aria-hidden="true" /> New messages
      </button>
    </div>
  );
}
