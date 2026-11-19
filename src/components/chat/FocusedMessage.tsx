"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { initNexconn } from "@/lib/nexconn/client";
import type { ChatMessage } from "@/lib/stores/messages";
import { loadProfiles } from "@/lib/stores/profiles";
import { MessageBubble } from "./MessageBubble";

type LoadState = { status: "loading" } | { status: "failed" } | { status: "ready"; message: ChatMessage };

/** Shows a linked message on its own when it is older than the history we page through. */
export function FocusedMessage({ roomId, messageId, userId, onClose }: {
  roomId: string; messageId: string; userId: string | null; onClose: () => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    void initNexconn().then(async ({ BaseChannel, GroupChannel }) => {
      const result = await BaseChannel.getMessagesByIds({
        channelIdentifier: new GroupChannel(roomId).identifier, messageIds: [messageId],
      });
      const found = result.isOk ? result.data?.[messageId] : undefined;
      if (!found) throw new Error("Message not found");
      void loadProfiles([found.senderUserId]);
      if (active) {
        setState({ status: "ready", message: {
          messageId: found.messageId, messageType: found.messageType, senderUserId: found.senderUserId,
          sentTime: found.sentTime, content: found.content, metadata: found.metadata, sentStatus: found.sentStatus,
        } });
      }
    }).catch(() => { if (active) setState({ status: "failed" }); });
    return () => { active = false; };
  }, [roomId, messageId]);

  return (
    <section aria-label="Linked message" className="max-h-[45dvh] shrink-0 overflow-y-auto border-b border-amber-200 bg-amber-50 px-3 py-2 sm:px-5">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-amber-950">This doubt is further back in the chat</p>
          <Button type="button" variant="ghost" aria-label="Close linked message" className="size-11 shrink-0" onClick={onClose}><X aria-hidden="true" /></Button>
        </div>
        {state.status === "loading" && <p role="status" className="pb-2 text-sm text-muted-foreground">Finding the message…</p>}
        {state.status === "failed" && <p role="alert" className="pb-2 text-sm text-muted-foreground">We couldn’t find this message. It may have been removed.</p>}
        {state.status === "ready" && (
          <div className="pb-2">
            <MessageBubble message={state.message} roomId={roomId} own={state.message.senderUserId === userId} grouped={false} />
          </div>
        )}
      </div>
    </section>
  );
}
