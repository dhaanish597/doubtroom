"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, MoonStar } from "lucide-react";

import type { Room } from "@/lib/rooms/types";
import { useRooms } from "@/lib/stores/rooms";

const COUNT_REFRESH_MS = 60_000;
type Eve = NonNullable<Room["eve"]>;

function useLive(eve: Eve) {
  const [now, setNow] = useState(() => Date.now());
  const opens = Date.parse(eve.opensAt);
  const closes = Date.parse(eve.closesAt);
  useEffect(() => {
    const next = now < opens ? opens : now < closes ? closes : null;
    if (next === null) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(next - now + 50, 2_147_000_000));
    return () => clearTimeout(timer);
  }, [now, opens, closes]);
  return now >= opens && now < closes;
}

/** Headcount from /api/eves/[id], refreshed every minute while the tab is visible. */
function useHeadcount(eveId: string, live: boolean) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!live) return;
    const controller = new AbortController();
    const load = () => {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/eves/${eveId}`, { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("Eve unavailable");
          const data = await response.json() as { participantCount: number | null };
          setCount(typeof data.participantCount === "number" ? data.participantCount : null);
        })
        .catch(() => { if (!controller.signal.aborted) setCount(null); });
    };
    load();
    const timer = setInterval(load, COUNT_REFRESH_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [eveId, live]);
  return count;
}

/** "Exam Eve is live: N inside". Hidden before the Eve opens and after it closes. */
export function EveBanner({ eve, title }: { eve: Eve; title?: string }) {
  const live = useLive(eve);
  const count = useHeadcount(eve.id, live);
  if (!live) return null;
  return (
    <Link href={`/app/eve/${eve.id}`}
      className="group flex min-h-14 items-center gap-3 bg-[#1d1760] px-4 py-2.5 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 sm:rounded-2xl">
      <span aria-hidden="true" className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-amber-300">
        <MoonStar className="size-5" />
        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-emerald-400 ring-2 ring-[#1d1760] motion-safe:animate-pulse" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">
          Exam Eve is live{count !== null ? `: ${count} inside` : ""}
        </span>
        {title && <span className="block truncate text-xs text-indigo-100">{title}</span>}
      </span>
      <span className="flex shrink-0 items-center text-sm font-semibold text-amber-300">
        Join<ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}

/** Live Eves across the student's rooms, for the home screen. */
export function LiveEveBanners() {
  const rooms = useRooms((state) => state.rooms);
  const withEves = rooms?.filter((room): room is Room & { eve: Eve } => Boolean(room.eve)) ?? [];
  if (!withEves.length) return null;
  return (
    <section aria-label="Live Exam Eves" className="-mx-4 mb-5 space-y-2 sm:mx-0">
      {withEves.map((room) => <EveBanner key={room.eve.id} eve={room.eve} title={room.title} />)}
    </section>
  );
}
