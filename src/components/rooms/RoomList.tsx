"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, MessagesSquare, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { initNexconn } from "@/lib/nexconn/client";
import { messagePreview } from "@/lib/nexconn/messages";
import type { Room } from "@/lib/rooms/types";
import { useConnection } from "@/lib/stores/connection";
import { useRooms, type ChannelPreview } from "@/lib/stores/rooms";

async function loadChannelPreviews(rooms: Room[], active: () => boolean) {
  const { BaseChannel, ChannelType } = await initNexconn();
  const query = BaseChannel.createChannelsQuery({ pageSize: 50 });
  const remaining = new Set(rooms.map(({ id }) => id));
  const seen = new Set<string>();
  const previews: Record<string, ChannelPreview> = {};

  while (remaining.size && active()) {
    const page = await query.loadNextPage();
    if (!page.isOk) throw new Error("Could not update chat previews");
    let advanced = false;
    for (const channel of page.data?.data ?? []) {
      const key = `${channel.channelType}:${channel.channelId}`;
      if (!seen.has(key)) {
        seen.add(key);
        advanced = true;
      }
      if (channel.channelType !== ChannelType.GROUP || !remaining.delete(channel.channelId)) continue;
      const message = channel.latestMessage;
      previews[channel.channelId] = {
        unread: channel.unreadCount,
        preview: message ? messagePreview(message.messageType, message.content) : null,
        sentAt: message?.sentTime ?? 0,
        lastId: message?.messageId,
      };
    }
    if (!advanced) break;
  }
  return previews;
}

export function RoomList() {
  const rooms = useRooms((state) => state.rooms);
  const channels = useRooms((state) => state.channels);
  const userId = useConnection((state) => state.userId);
  const status = useConnection((state) => state.status);
  const synced = useConnection((state) => state.channelsSynced);
  const revision = useConnection((state) => state.channelRevision);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    useRooms.setState({ rooms: null });
    fetch("/api/rooms", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Rooms unavailable");
        const data = await response.json() as { rooms: Room[] };
        if (!controller.signal.aborted) useRooms.setState({ rooms: data.rooms });
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Could not load your rooms");
      });
    return () => controller.abort();
  }, [attempt, userId]);

  useEffect(() => {
    if (!rooms?.length || !userId || status !== "connected") return;
    let active = true;
    const timer = setTimeout(() => {
      void loadChannelPreviews(rooms, () => active).then((channels) => {
        if (!active) return;
        useRooms.setState((state) => {
          const merged = { ...state.channels };
          for (const [id, fetched] of Object.entries(channels)) {
            const current = merged[id];
            const readThrough = current?.readThrough;
            const unread = readThrough !== undefined && fetched.sentAt <= readThrough ? 0 : fetched.unread;
            merged[id] = current && current.sentAt > fetched.sentAt
              ? { ...current, unread: Math.max(current.unread, unread) }
              : { ...fetched, unread, readThrough };
          }
          return { channels: merged };
        });
        setPreviewError(false);
      }).catch(() => {
        if (active) setPreviewError(true);
      });
    }, 120);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [rooms, status, userId, synced, revision]);

  if (error) {
    return (
      <div className="rounded-xl border p-5">
        <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" onClick={() => {
          setError("");
          setAttempt((value) => value + 1);
        }}>Retry</Button>
      </div>
    );
  }
  if (!rooms) {
    return (
      <div role="status" aria-label="Loading rooms" className="space-y-3">
        {[1, 2, 3].map((index) => <Skeleton key={index} className="h-21 w-full rounded-xl" />)}
      </div>
    );
  }
  if (!rooms.length) return <p className="rounded-xl border p-5 text-sm text-muted-foreground">You haven’t joined any rooms yet.</p>;

  const ordered = [...rooms].sort((a, b) => (channels[b.id]?.sentAt ?? 0) - (channels[a.id]?.sentAt ?? 0));

  return (
    <>
      {previewError && status === "connected" && <p role="status" className="mb-3 text-sm text-muted-foreground">Chat previews are temporarily unavailable.</p>}
      <ul className="divide-y rounded-xl border">
        {ordered.map((room) => {
          const preview = channels[room.id];
          const Icon = room.kind === "subject" ? BookOpen : room.kind === "section" ? UsersRound : MessagesSquare;
          return (
            <li key={room.id}>
              <Link href={`/app/room/${room.id}`} className="flex min-h-21 items-center gap-3 px-3 py-3 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-inset sm:px-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon aria-hidden="true" className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{room.title}</span>
                  <span className="block truncate text-sm text-muted-foreground">{preview?.preview ?? room.courseCode ?? (room.kind === "section" ? "Section room" : "Demo room")}</span>
                </span>
                {Boolean(preview?.unread) && <span className="rounded-full bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground" aria-label={`${preview.unread} unread ${preview.unread === 1 ? "message" : "messages"}`}>{preview.unread > 99 ? "99+" : preview.unread}</span>}
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
