"use client";

import { useEffect, useState } from "react";
import { BellOff } from "lucide-react";

import { useRoomContext } from "@/components/rooms/RoomContext";
import { refreshMuteStatus, seedMuteStatus, useMutes } from "@/lib/moderation/client";
import { isMuted, muteNotice } from "@/lib/moderation/rules";

const POLL_MS = 60_000;

/** The viewer's mute end in this room while it lasts. Rechecks every minute and on return to the tab. */
export function useMutedUntil(roomId: string) {
  const room = useRoomContext();
  const inRoom = room?.roomId === roomId;
  const initial = inRoom ? room.moderation?.mutedUntil ?? null : null;
  const until = useMutes((state) => state.byRoom[roomId]?.mutedUntil ?? null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!inRoom) return;
    seedMuteStatus(roomId, initial);
    const refresh = () => {
      if (document.visibilityState === "visible") void refreshMuteStatus(roomId).catch(() => undefined);
    };
    const timer = setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [inRoom, roomId, initial]);

  // Re-render when the mute ends so the composer comes back on time.
  useEffect(() => {
    if (!until || until <= now) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(until - now + 250, POLL_MS));
    return () => clearTimeout(timer);
  }, [until, now]);

  return inRoom && isMuted(until, now) ? until : null;
}

export function MutedNotice({ until }: { until: number }) {
  return (
    <div className="shrink-0 border-t border-border bg-background px-2.5 py-3 sm:px-5">
      <p role="status" className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl bg-muted px-3 py-3 text-sm text-muted-foreground">
        <BellOff aria-hidden="true" className="size-4 shrink-0" />
        <span><span className="font-semibold text-foreground">{muteNotice(until)}.</span> You can still read the room.</span>
      </p>
    </div>
  );
}
