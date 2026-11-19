"use client";

import { useCallback, useEffect, useState } from "react";
import type { OpenChannel } from "@nexconn/chat";

import { initNexconn } from "@/lib/nexconn/client";
import { useMessages } from "@/lib/stores/messages";
import { channelKeyFor } from "@/lib/stores/messages";

/** Recent messages Nexconn replays to someone entering the Eve. */
export const EVE_HISTORY_COUNT = 30;

export type OpenChannelStatus = "entering" | "inside" | "failed" | "destroyed";
type EnterState = { epoch: string; status: Exclude<OpenChannelStatus, "entering">; count: number | null; code?: number };

/** Open channels keep nothing for people who leave, so the local copy goes when the page does. */
function forgetMessages(key: string) {
  useMessages.setState((state) => {
    if (!state.byChannel[key]) return state;
    const byChannel = { ...state.byChannel };
    delete byChannel[key];
    return { byChannel };
  });
}

/**
 * Enters the Exam Eve open channel with the last 30 messages and exits on unmount and on pagehide.
 * The participant count comes from the enter response and OpenChannelHandler.onParticipantChanged.
 */
export function useOpenChannel(eveId: string, connected: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [entered, setEntered] = useState<EnterState | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const epoch = `${eveId}:${attempt}:${connected}`;

  useEffect(() => {
    if (!connected) return;
    let active = true;
    let channel: OpenChannel | null = null;
    let inside = false;
    let channelKey: string | null = null;
    const handlerId = `eve:${eveId}`;
    let removeHandler = () => {};
    const update = (patch: Omit<EnterState, "epoch">) => { if (active) setEntered({ epoch, ...patch }); };

    const leave = () => {
      if (!inside || !channel) return;
      inside = false;
      void channel.exitChannel().catch(() => undefined);
    };
    const onPageShow = (event: PageTransitionEvent) => {
      // Back/forward cache restores the page after pagehide made us leave. Enter again.
      if (event.persisted) setAttempt((value) => value + 1);
    };

    void initNexconn().then(async (sdk) => {
      if (!active) return;
      sdk.NCEngine.addOpenChannelHandler(handlerId, new sdk.OpenChannelHandler({
        onEntered({ channelId, response }) {
          if (channelId === eveId) update({ status: "inside", count: response.participantCount });
        },
        onEnterFailed({ channelId, code }) {
          if (channelId === eveId) update({ status: "failed", count: null, code });
        },
        onParticipantChanged({ channelId, participantCount }) {
          if (channelId === eveId && active) {
            setEntered((current) => current && current.epoch === epoch ? { ...current, count: participantCount } : current);
          }
        },
        onChannelDestroyed({ channelId }) {
          if (channelId === eveId) update({ status: "destroyed", count: null });
        },
      }));
      removeHandler = () => sdk.NCEngine.removeOpenChannelHandler(handlerId);
      channel = new sdk.OpenChannel(eveId);
      channelKey = channelKeyFor(channel.identifier);
      setKey(channelKey);
      const result = await channel.enterChannel({ messageCount: EVE_HISTORY_COUNT });
      if (!active) {
        if (result.isOk) void channel.exitChannel().catch(() => undefined);
        return;
      }
      inside = result.isOk;
      if (result.isOk && result.data) update({ status: "inside", count: result.data.participantCount });
      else update({ status: "failed", count: null, code: result.code });
    }).catch(() => update({ status: "failed", count: null }));

    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      active = false;
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", onPageShow);
      leave();
      removeHandler();
      if (channelKey) forgetMessages(channelKey);
    };
  }, [eveId, connected, epoch]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const current = entered?.epoch === epoch ? entered : null;
  return {
    key,
    status: (current?.status ?? "entering") as OpenChannelStatus,
    participantCount: current?.count ?? null,
    code: current?.code,
    retry,
  };
}
