"use client";

import { useEffect, useState } from "react";

import { doubtPrefill } from "@/lib/mentors/types";
import { initNexconn } from "@/lib/nexconn/client";
import { MSG, safeParseDoubt } from "@/lib/nexconn/messages";
import { useConnection } from "@/lib/stores/connection";
import { channelKeyFor, useMessages } from "@/lib/stores/messages";

/** `own` is false when a senior opens the DM from someone else's doubt. */
export type DoubtContext = { roomId: string; roomTitle: string; doubtMessageId: string; own?: boolean };

function doubtText(messageType: string | undefined, content: unknown) {
  if (messageType !== MSG.DOUBT) return null;
  const doubt = safeParseDoubt(content).data;
  return doubt ? doubt.text || "Photo doubt" : null;
}

/** Composer text quoting the doubt the student came from, from the message store or Nexconn. */
export function useDoubtPrefill(context?: DoubtContext) {
  const connected = useConnection((state) => state.status === "connected" && Boolean(state.userId));
  const cached = useMessages((state) => {
    if (!context) return null;
    const message = state.byChannel[channelKeyFor({ channelType: 3, channelId: context.roomId })]
      ?.find((entry) => entry.messageId === context.doubtMessageId);
    return message ? doubtText(message.messageType, message.content) : null;
  });
  const [fetched, setFetched] = useState<string | null>(null);

  useEffect(() => {
    if (!context || cached || !connected) return;
    let active = true;
    void initNexconn().then(async ({ BaseChannel, GroupChannel }) => {
      const result = await BaseChannel.getMessagesByIds({
        channelIdentifier: new GroupChannel(context.roomId).identifier,
        messageIds: [context.doubtMessageId],
      });
      const message = result.isOk ? result.data?.[context.doubtMessageId] : undefined;
      const text = message ? doubtText(message.messageType, message.content) : null;
      if (active && text) setFetched(text);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [context, cached, connected]);

  const text = cached ?? fetched;
  return context && text ? doubtPrefill(context.roomTitle, text, context.own ?? true) : "";
}
