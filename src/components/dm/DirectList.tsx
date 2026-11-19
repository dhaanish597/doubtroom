"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { dmHref } from "@/lib/mentors/types";
import { initNexconn } from "@/lib/nexconn/client";
import { mediaUrl, messagePreview } from "@/lib/nexconn/messages";
import { useConnection } from "@/lib/stores/connection";
import { loadProfiles, useProfiles } from "@/lib/stores/profiles";

type DirectPreview = { peerId: string; unread: number; preview: string | null; sentAt: number };
type ListState = { status: "loading" } | { status: "failed" } | { status: "ready"; channels: DirectPreview[] };

const MAX_PAGES = 4;

async function loadDirectChannels(active: () => boolean) {
  const { BaseChannel, ChannelType } = await initNexconn();
  const query = BaseChannel.createChannelsQuery({ pageSize: 50 });
  const found = new Map<string, DirectPreview>();
  for (let page = 0; page < MAX_PAGES && active(); page += 1) {
    const result = await query.loadNextPage();
    if (!result.isOk) throw new Error("Could not load direct messages");
    const list = result.data?.data ?? [];
    for (const channel of list) {
      if (channel.channelType !== ChannelType.DIRECT || found.has(channel.channelId)) continue;
      const message = channel.latestMessage;
      found.set(channel.channelId, {
        peerId: channel.channelId,
        unread: channel.unreadCount,
        preview: message ? messagePreview(message.messageType, message.content) : null,
        sentAt: message?.sentTime ?? 0,
      });
    }
    if (list.length < 50) break;
  }
  return [...found.values()].sort((a, b) => b.sentAt - a.sentAt);
}

export function DirectList() {
  const userId = useConnection((state) => state.userId);
  const status = useConnection((state) => state.status);
  const synced = useConnection((state) => state.channelsSynced);
  const revision = useConnection((state) => state.channelRevision);
  const profiles = useProfiles((state) => state.profiles);
  const [state, setState] = useState<ListState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId || status !== "connected") return;
    let active = true;
    const timer = setTimeout(() => {
      void loadDirectChannels(() => active).then((channels) => {
        if (!active) return;
        setState({ status: "ready", channels });
        void loadProfiles(channels.map(({ peerId }) => peerId));
      }).catch(() => { if (active) setState((current) => current.status === "ready" ? current : { status: "failed" }); });
    }, 120);
    return () => { active = false; clearTimeout(timer); };
  }, [userId, status, synced, revision, attempt]);

  if (state.status === "loading") {
    if (status === "offline") return <p className="rounded-xl border p-5 text-sm text-muted-foreground">Direct messages will appear when you’re connected.</p>;
    return <div role="status" aria-label="Loading direct messages" className="space-y-3"><Skeleton className="h-18 w-full rounded-xl" /></div>;
  }
  if (state.status === "failed") {
    return (
      <div className="rounded-xl border p-5">
        <p role="alert" className="mb-3 text-sm text-destructive">Could not load your direct messages.</p>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => { setState({ status: "loading" }); setAttempt((value) => value + 1); }}>Retry</Button>
      </div>
    );
  }
  if (!state.channels.length) {
    return <p className="rounded-xl border p-5 text-sm text-muted-foreground">No messages yet. Tap “Ask a senior” in a room to message someone who has cleared the subject.</p>;
  }

  return (
    <ul className="divide-y rounded-xl border">
      {state.channels.map((channel) => {
        const profile = profiles[channel.peerId];
        const name = profile?.name ?? "DoubtRoom member";
        const avatar = mediaUrl(profile?.avatar);
        return (
          <li key={channel.peerId}>
            <Link href={dmHref(channel.peerId)} className="flex min-h-18 items-center gap-3 px-3 py-3 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-inset sm:px-4">
              <Avatar className="size-10 shrink-0">
                {avatar && <AvatarImage alt="" src={avatar} referrerPolicy="no-referrer" />}
                <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">{name.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{name}{profile?.role === "mentor" && <span className="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Senior</span>}</span>
                <span className="block truncate text-sm text-muted-foreground">{channel.preview ?? "Start the conversation"}</span>
              </span>
              {channel.unread > 0 && <span className="rounded-full bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground" aria-label={`${channel.unread} unread ${channel.unread === 1 ? "message" : "messages"}`}>{channel.unread > 99 ? "99+" : channel.unread}</span>}
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
