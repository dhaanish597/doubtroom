"use client";

import { useState, type FormEvent } from "react";
import { Megaphone, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { trackRoomEvent } from "@/lib/analytics";
import { recordAnnouncement } from "@/lib/moderation/client";
import { ANNOUNCE_BODY_MAX, ANNOUNCE_TITLE_MAX } from "@/lib/moderation/rules";
import { initNexconn } from "@/lib/nexconn/client";
import { MSG } from "@/lib/nexconn/messages";
import { notifyChannelChange, useConnection } from "@/lib/stores/connection";
import { useMessages } from "@/lib/stores/messages";
import { recordRoomMessage } from "@/lib/stores/rooms";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "failed"; message: string }
  | { kind: "unsaved"; retry: () => void; message: string };

/** Sends dr:announce with needReceipt through the client SDK, then records it (PLAN F6). */
async function sendAnnouncement(roomId: string, owner: string, payload: { title: string; body: string; urgent: boolean }) {
  const { GroupChannel, SendMessageParams } = await initNexconn();
  if (useConnection.getState().userId !== owner) throw new Error("Chat identity changed");
  const params = new SendMessageParams({ v: 1, ...payload }, MSG.ANNOUNCE);
  params.needReceipt = true;
  const result = await new GroupChannel(roomId).sendMessage(params);
  if (useConnection.getState().userId !== owner || !result.isOk || !result.data) throw new Error("Announcement could not be sent");
  useMessages.getState().mergeMessages([result.data]);
  recordRoomMessage(result.data, false);
  notifyChannelChange();
  return result.data.messageId;
}

export function AnnounceComposer({ roomId, connected, onClose }: { roomId: string; connected: boolean; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const userId = useConnection((state) => state.userId);
  const ready = connected && Boolean(userId) && title.trim() && body.trim() && status.kind !== "sending";

  async function save(payload: { title: string; body: string; urgent: boolean }, messageId: string) {
    try {
      await recordAnnouncement({ roomId, messageId, ...payload });
      setStatus({ kind: "idle" });
      onClose();
    } catch (error) {
      setStatus({
        kind: "unsaved", retry: () => void save(payload, messageId),
        message: error instanceof Error ? error.message : "Your announcement is in the chat, but it wasn’t saved",
      });
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || !userId) return;
    const payload = { title: title.trim(), body: body.trim(), urgent };
    setStatus({ kind: "sending" });
    let messageId: string;
    try {
      messageId = await sendAnnouncement(roomId, userId, payload);
    } catch {
      setStatus({ kind: "failed", message: "Couldn’t post the announcement. Check your connection and try again." });
      return;
    }
    trackRoomEvent("message_sent", roomId);
    setTitle("");
    setBody("");
    setUrgent(false);
    await save(payload, messageId);
  }

  return (
    <div className="shrink-0 border-t border-[#e9e7f4] bg-background px-2.5 py-2 sm:px-5">
      <form aria-label="Post an announcement" onSubmit={submit} className="mx-auto max-w-3xl space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
            <Megaphone aria-hidden="true" className="size-4" />Announcement
          </p>
          <Button type="button" variant="ghost" aria-label="Back to chat" className="size-11 shrink-0" onClick={onClose} disabled={status.kind === "sending"}>
            <X aria-hidden="true" />
          </Button>
        </div>
        <label className="block text-sm font-medium">
          Title
          <input value={title} maxLength={ANNOUNCE_TITLE_MAX} required disabled={!connected} onChange={(event) => setTitle(event.target.value)}
            placeholder="CN internal moved to Friday"
            className="mt-1 block min-h-11 w-full rounded-lg border bg-white px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary/45" />
        </label>
        <label className="block text-sm font-medium">
          Message
          <textarea value={body} maxLength={ANNOUNCE_BODY_MAX} required rows={3} disabled={!connected} onChange={(event) => setBody(event.target.value)}
            placeholder="Room, time and anything to bring"
            className="mt-1 block max-h-40 min-h-20 w-full resize-y rounded-lg border bg-white px-3 py-2 text-base leading-6 outline-none focus-visible:ring-2 focus-visible:ring-primary/45" />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={urgent} onChange={(event) => setUrgent(event.target.checked)} className="size-5 accent-red-600" />
            Mark as urgent
          </label>
          <Button type="submit" className="h-11 rounded-xl px-4" disabled={!ready}>
            <Send aria-hidden="true" />{status.kind === "sending" ? "Posting…" : "Post to room"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Everyone in the room gets it. You’ll see who has read it.</p>
        {status.kind === "failed" && <p role="alert" className="text-sm text-destructive">{status.message}</p>}
        {status.kind === "unsaved" && (
          <p role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
            {status.message}
            <Button type="button" variant="ghost" className="h-11 text-destructive" onClick={status.retry}>Try again</Button>
          </p>
        )}
      </form>
    </div>
  );
}
