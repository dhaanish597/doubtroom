"use client";

import { useState, type ReactNode } from "react";
import type { MessageReadReceiptUser, MessagesReadReceiptUsersQuery } from "@nexconn/chat";
import { CheckCheck, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { initNexconn } from "@/lib/nexconn/client";
import { BOT_IDS } from "@/lib/nexconn/identities";
import { loadProfiles, useProfiles } from "@/lib/stores/profiles";

const PAGE_SIZE = 50;
type Tab = "seen" | "unseen";
type ListState = {
  users: MessageReadReceiptUser[];
  status: "idle" | "loading" | "ready" | "failed";
  query: MessagesReadReceiptUsersQuery | null;
  hasMore: boolean;
};
const EMPTY: ListState = { users: [], status: "idle", query: null, hasMore: false };

function ReaderList({ state, tab, onMore, onRetry }: { state: ListState; tab: Tab; onMore: () => void; onRetry: () => void }) {
  const profiles = useProfiles((store) => store.profiles);
  const users = state.users.filter(({ userId }) => userId !== BOT_IDS.TA);
  if (state.status === "loading" && !users.length) {
    return <div aria-hidden="true" className="space-y-2 py-2">{[0, 1, 2].map((key) => <Skeleton key={key} className="h-11 rounded-xl" />)}</div>;
  }
  if (state.status === "failed" && !users.length) {
    return (
      <div className="py-6 text-center text-sm">
        <p role="alert" className="text-destructive">Couldn’t load this list.</p>
        <Button type="button" variant="ghost" className="mt-1 h-11 text-primary" onClick={onRetry}>Try again</Button>
      </div>
    );
  }
  if (state.status === "ready" && !users.length) {
    return <p role="status" className="py-6 text-center text-sm text-muted-foreground">{tab === "seen" ? "Nobody has seen it yet." : "Everyone has seen it."}</p>;
  }
  return (
    <>
      <ul className="divide-y">
        {users.map(({ userId, timestamp }) => (
          <li key={userId} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 truncate font-medium">{profiles[userId]?.name ?? "Room member"}</span>
            {tab === "seen" && timestamp > 0 && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(timestamp)}
              </span>
            )}
          </li>
        ))}
      </ul>
      {state.hasMore && (
        <Button type="button" variant="ghost" className="mt-1 h-11 w-full text-primary" disabled={state.status === "loading"} onClick={onMore}>
          {state.status === "loading" ? "Loading…" : "Show more"}
        </Button>
      )}
    </>
  );
}

/** Who has and has not seen an announcement, from the group read receipt user queries. */
export function ReadersSheet({ roomId, messageId, children }: { roomId: string; messageId: string; children: ReactNode }) {
  const [tab, setTab] = useState<Tab>("seen");
  const [lists, setLists] = useState<Record<Tab, ListState>>({ seen: EMPTY, unseen: EMPTY });

  async function load(which: Tab, fresh: boolean) {
    const current = lists[which];
    if (current.status === "loading") return;
    setLists((state) => ({ ...state, [which]: { ...(fresh ? EMPTY : state[which]), status: "loading" } }));
    try {
      const { BaseChannel, GroupChannel, MessageReadReceiptStatus } = await initNexconn();
      const query = !fresh && current.query ? current.query : BaseChannel.createMessagesReadReceiptUsersQuery({
        channelIdentifier: new GroupChannel(roomId).identifier, messageId, pageSize: PAGE_SIZE,
        status: which === "seen" ? MessageReadReceiptStatus.RESPONDED : MessageReadReceiptStatus.UNRESPONDED,
      });
      const result = await query.loadNextPage();
      if (!result.isOk || !result.data) throw new Error(`Receipt users unavailable (${result.code})`);
      const page = result.data.data;
      void loadProfiles(page.map(({ userId }) => userId));
      setLists((state) => {
        const known = new Set((fresh ? [] : state[which].users).map(({ userId }) => userId));
        const users = [...(fresh ? [] : state[which].users), ...page.filter(({ userId }) => !known.has(userId))];
        return { ...state, [which]: { users, status: "ready", query, hasMore: query.hasNext } };
      });
    } catch {
      setLists((state) => ({ ...state, [which]: { ...state[which], status: "failed" } }));
    }
  }

  return (
    <Sheet onOpenChange={(open) => {
      if (!open) return;
      void load("seen", true);
      void load("unseen", true);
    }}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold">Who has seen this</SheetTitle>
          <SheetDescription>Members tick off an announcement once it’s on their screen.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 overflow-y-auto px-4">
          <div role="tablist" aria-label="Readers" className="mb-2 flex rounded-full bg-[#f2f0fb] p-0.5">
            {([["seen", "Seen", CheckCheck], ["unseen", "Not yet", Clock3]] as const).map(([key, label, Icon]) => (
              <Button key={key} type="button" role="tab" variant="ghost" aria-selected={tab === key}
                className={`h-11 flex-1 rounded-full ${tab === key ? "bg-white text-primary shadow-xs" : "text-muted-foreground"}`}
                onClick={() => setTab(key)}>
                <Icon aria-hidden="true" />{label}
                {lists[key].status === "ready" && <span className="text-xs">({lists[key].users.filter(({ userId }) => userId !== BOT_IDS.TA).length}{lists[key].hasMore ? "+" : ""})</span>}
              </Button>
            ))}
          </div>
          <div role="tabpanel">
            <ReaderList state={lists[tab]} tab={tab} onMore={() => void load(tab, false)} onRetry={() => void load(tab, true)} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
