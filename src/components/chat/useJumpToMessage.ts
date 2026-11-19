"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/** History pages to load while looking for a linked message before showing it on its own. */
export const JUMP_PAGE_LIMIT = 5;
const HIGHLIGHT_MS = 2_500;

export type JumpState = "idle" | "searching" | "found" | "missing";

function highlight(row: HTMLElement) {
  row.scrollIntoView({ block: "center" });
  row.focus({ preventScroll: true });
  row.dataset.highlighted = "";
  setTimeout(() => { delete row.dataset.highlighted; }, HIGHLIGHT_MS);
}

/**
 * Scrolls to a message from a link (for example the doubt board), loading older history up to
 * five pages. Reports "missing" when the message is older than that or not in history.
 */
export function useJumpToMessage({ targetId, viewport, messageCount, ready, loading, hasOlder, error, loadMore }: {
  targetId?: string;
  viewport: RefObject<HTMLDivElement | null>;
  messageCount: number;
  ready: boolean;
  loading: boolean;
  hasOlder: boolean;
  error: string;
  loadMore: () => void;
}) {
  const [search, setSearch] = useState<{ id?: string; state: JumpState }>({ id: targetId, state: targetId ? "searching" : "idle" });
  if (search.id !== targetId) setSearch({ id: targetId, state: targetId ? "searching" : "idle" });
  const pages = useRef({ id: targetId, count: 0 });

  useEffect(() => {
    if (!targetId || search.state !== "searching" || !ready || loading) return;
    if (pages.current.id !== targetId) pages.current = { id: targetId, count: 0 };
    // Let MessageList finish its own scroll for this render first.
    const timer = setTimeout(() => {
      const row = viewport.current?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(targetId)}"]`);
      if (row) {
        highlight(row);
        setSearch({ id: targetId, state: "found" });
      } else if (hasOlder && !error && pages.current.count < JUMP_PAGE_LIMIT) {
        pages.current.count += 1;
        loadMore();
      } else {
        setSearch({ id: targetId, state: "missing" });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [targetId, search.state, ready, loading, hasOlder, error, loadMore, viewport, messageCount]);

  return {
    state: search.state,
    dismiss: () => setSearch({ id: targetId, state: "idle" }),
  };
}
