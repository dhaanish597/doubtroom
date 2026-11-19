"use client";

import { useEffect, useState } from "react";

import type { MentorSummary } from "@/lib/mentors/types";
import { useConnection } from "@/lib/stores/connection";
import { initNexconn } from "./client";

const SUBSCRIPTION_SECONDS = 86_400;
const POLL_MS = 60_000;

export type PresenceSource = "live" | "polling";
export type Presence = { online: boolean | null; source: PresenceSource | null };

async function pollOnce(peerId: string, signal: AbortSignal) {
  const response = await fetch(`/api/mentors?${new URLSearchParams({ ids: peerId })}`, { cache: "no-store", signal });
  if (!response.ok) throw new Error("Presence unavailable");
  const { mentors } = await response.json() as { mentors: MentorSummary[] };
  return mentors.find((mentor) => mentor.nexconnId === peerId)?.online ?? null;
}

/**
 * Online status for one chat partner. Uses the Nexconn online-status subscription and falls
 * back to polling the server every minute when the subscription is refused (DECISIONS D-008).
 */
export function usePeerPresence(peerId: string): Presence {
  const connected = useConnection((state) => state.status === "connected" && Boolean(state.userId));
  const [presence, setPresence] = useState<Presence>({ online: null, source: null });

  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController();
    const handlerId = `presence:${peerId}`;
    let poll: ReturnType<typeof setInterval> | undefined;
    let subscribed = false;
    let sdk: Awaited<ReturnType<typeof initNexconn>> | undefined;

    const update = (online: boolean | null, source: PresenceSource) => {
      if (!controller.signal.aborted) setPresence({ online, source });
    };
    const startPolling = () => {
      const tick = () => void pollOnce(peerId, controller.signal).then((online) => update(online, "polling")).catch(() => undefined);
      tick();
      poll = setInterval(tick, POLL_MS);
    };
    const refreshLive = async () => {
      if (!sdk) return;
      const result = await sdk.NCEngine.userModule.getSubscribeUsersOnlineStatus([peerId]);
      if (!result.isOk) return;
      const status = result.data?.find((entry) => entry.userId === peerId);
      update(status ? status.isOnline : false, "live");
    };

    void (async () => {
      try {
        sdk = await initNexconn();
        if (controller.signal.aborted) return;
        const { NCEngine, SubscribeType, UserHandler } = sdk;
        NCEngine.addUserHandler(handlerId, new UserHandler({
          onSubscriptionChanged({ events }) {
            if (events.some((event) => event.userId === peerId)) void refreshLive().catch(() => undefined);
          },
        }));
        const result = await NCEngine.userModule.subscribeEvent({
          subscribeType: SubscribeType.ONLINE_STATUS, userIds: [peerId], expiry: SUBSCRIPTION_SECONDS,
        });
        if (controller.signal.aborted) return;
        if (!result.isOk) throw new Error(`Presence subscription refused (code ${result.code})`);
        subscribed = true;
        await refreshLive();
      } catch {
        if (!controller.signal.aborted) startPolling();
      }
    })();

    return () => {
      controller.abort();
      if (poll) clearInterval(poll);
      sdk?.NCEngine.removeUserHandler(handlerId);
      if (subscribed) {
        void sdk?.NCEngine.userModule.unsubscribeEvent({ subscribeType: sdk.SubscribeType.ONLINE_STATUS, userIds: [peerId] })
          .catch(() => undefined);
      }
    };
  }, [connected, peerId]);

  return presence;
}
