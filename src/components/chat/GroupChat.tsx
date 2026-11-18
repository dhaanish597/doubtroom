"use client";

import { useEffect, useState, type FormEvent } from "react";
import { initNexconn } from "@/lib/nexconn/client";
import { notifyChannelChange, useConnection } from "@/lib/stores/connection";
import { channelKeyFor, useMessages, type ChatMessage } from "@/lib/stores/messages";

const EMPTY_MESSAGES: ChatMessage[] = [];
const fieldClass = "h-11 w-full rounded-lg border px-3";
const buttonClass = "h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground disabled:opacity-50";

export function GroupChat({ roomId, title }: { roomId: string; title: string }) {
  const userId = useConnection((state) => state.userId);
  const status = useConnection((state) => state.status);
  const connected = status === "connected" && Boolean(userId);
  const [channelKey, setChannelKey] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const messages = useMessages((state) => channelKey ? state.byChannel[channelKey] ?? EMPTY_MESSAGES : EMPTY_MESSAGES);

  useEffect(() => {
    if (!connected) return;
    let active = true;

    async function loadHistory() {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const { BaseChannel, GroupChannel } = await initNexconn();
        if (!active) return;
        const room = new GroupChannel(roomId);
        setChannelKey(channelKeyFor(room.identifier));
        const page = await BaseChannel.createMessagesQuery({
          channelIdentifier: room.identifier,
          isAscending: false,
          pageSize: 30,
        }).loadNextPage();
        if (!active) return;
        if (page.isOk) {
          useMessages.getState().mergeMessages(page.data?.data ?? []);
          void room.clearUnreadCount().then((result) => {
            if (result.isOk) notifyChannelChange();
          }).catch(() => undefined);
        } else {
          setHistoryError(`Could not load messages (code ${page.code})`);
        }
      } catch {
        if (active) setHistoryError("Could not load messages");
      } finally {
        if (active) setHistoryLoading(false);
      }
    }

    void loadHistory();
    return () => { active = false; };
  }, [connected, historyAttempt, roomId]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending || !connected) return;

    setSending(true);
    setSendError(null);
    try {
      const { GroupChannel, SendTextMessageParams } = await initNexconn();
      if (useConnection.getState().userId !== userId) return;
      const result = await new GroupChannel(roomId).sendMessage(new SendTextMessageParams({ text }));
      if (useConnection.getState().userId !== userId) return;
      if (!result.isOk || !result.data) {
        setSendError(`Message could not be sent (code ${result.code})`);
        return;
      }
      useMessages.getState().mergeMessages([result.data]);
      notifyChannelChange();
      setDraft("");
    } catch {
      setSendError("Message could not be sent");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="flex flex-col gap-3" aria-label={`Chat in ${title}`}>
      {connected && historyLoading && <p role="status">Loading messages…</p>}
      {historyError && (
        <div>
          <p role="alert">{historyError}</p>
          <button type="button" disabled={!connected} onClick={() => setHistoryAttempt((attempt) => attempt + 1)} className="underline">Retry history</button>
        </div>
      )}
      {!historyLoading && !historyError && !messages.length && <p>No messages yet.</p>}
      <ul aria-label="Messages" aria-live="polite" className="flex max-h-96 flex-col gap-2 overflow-y-auto">
        {messages.map(({ messageId, senderUserId, content }) => (
          <li key={messageId} className="wrap-break-word rounded-lg bg-muted px-3 py-2 text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{senderUserId}</span>
            {content && "text" in content && typeof content.text === "string" ? content.text : "Unsupported message"}
          </li>
        ))}
      </ul>
      <form onSubmit={send} className="flex items-end gap-2 border-t pt-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          Message
          <input className={fieldClass} required maxLength={2_000} disabled={!connected || sending} value={draft} onChange={(event) => setDraft(event.target.value)} />
        </label>
        <button className={buttonClass} type="submit" disabled={!connected || sending || !draft.trim()}>
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
      {sendError && <p role="alert">{sendError}</p>}
    </section>
  );
}
