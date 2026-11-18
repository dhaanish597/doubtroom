"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";

import { ConnectionBanner } from "@/components/chat/ConnectionBanner";
import { connectNexconn, initNexconn } from "@/lib/nexconn/client";
import { CONNECTION_CODE } from "@/lib/nexconn/codes";
import { DEV_ROOM_ID } from "@/lib/nexconn/dev-room";
import { NexconnProvider, useNexconnStatus } from "@/lib/nexconn/provider";
import { useConnection } from "@/lib/stores/connection";
import { channelKeyFor, useMessages, type ChatMessage } from "@/lib/stores/messages";

const tokenSchema = z.object({ token: z.string().min(1), roomId: z.literal(DEV_ROOM_ID) });
const errorSchema = z.object({ error: z.object({ message: z.string() }) });
const EMPTY_MESSAGES: ChatMessage[] = [];
const fieldClass = "w-full rounded-md border px-3 py-2";
const buttonClass = "rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50";

export default function DevChatPage() {
  const [token, setToken] = useState<string | null>(null);

  return (
    <NexconnProvider token={token}>
      <DevChat token={token} onToken={setToken} />
    </NexconnProvider>
  );
}

function DevChat({ token, onToken }: { token: string | null; onToken: (token: string | null) => void }) {
  const status = useNexconnStatus();
  const connectedUser = useConnection((state) => state.userId);
  const code = useConnection((state) => state.code);
  const connected = status === "connected" && !!connectedUser;
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [devKey, setDevKey] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  async function requestToken(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (request.current) return;

    const controller = new AbortController();
    request.current = controller;
    setRequesting(true);
    setError(null);
    try {
      const query = new URLSearchParams({ userId: userId.trim(), name: name.trim() });
      const response = await fetch(`/api/dev/token?${query}`, {
        signal: controller.signal,
        headers: devKey ? { "x-dev-key": devKey } : undefined,
        cache: "no-store",
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const problem = errorSchema.safeParse(body);
        setError(problem.success ? problem.data.error.message : "The test token request failed");
        return;
      }
      const session = tokenSchema.safeParse(body);
      if (!session.success) {
        setError("The test token response was invalid");
        return;
      }
      if (session.data.token === token) {
        await connectNexconn(token);
      } else {
        onToken(session.data.token);
      }
    } catch {
      if (!controller.signal.aborted && useConnection.getState().status !== "offline") {
        setError("The test chat request could not finish");
      }
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setRequesting(false);
    }
  }

  function reconnect() {
    if (!token || code === CONNECTION_CODE.TOKEN_EXPIRED || code === CONNECTION_CODE.TOKEN_INCORRECT) {
      void requestToken();
    } else {
      void connectNexconn(token).catch(() => undefined);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold">DoubtRoom test chat</h1>
        <p className="mt-1 text-sm text-muted-foreground">Use a different dev user ID in each browser.</p>
      </header>
      <form onSubmit={requestToken} className="flex flex-col gap-3">
        <fieldset disabled={requesting || status === "connecting" || connected} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            User ID
            <input className={fieldClass} required placeholder="dev_alice" pattern="dev_[a-z0-9_]{1,60}" value={userId} onChange={(event) => setUserId(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            Display name
            <input className={fieldClass} required maxLength={64} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          {process.env.NODE_ENV === "production" && (
            <label className="flex flex-col gap-1">
              Dev key
              <input className={fieldClass} required type="password" autoComplete="off" value={devKey} onChange={(event) => setDevKey(event.target.value)} />
            </label>
          )}
          <button className={`${buttonClass} self-start`} type="submit">
            {requesting ? "Requesting token…" : "Connect"}
          </button>
        </fieldset>
      </form>
      <ConnectionBanner onReconnect={reconnect} />
      {error && <p role="alert">{error}</p>}
      {connectedUser && <DevRoom userId={connectedUser} connected={connected} />}
    </main>
  );
}

function DevRoom({ userId, connected }: { userId: string; connected: boolean }) {
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
        const room = new GroupChannel(DEV_ROOM_ID);
        setChannelKey(channelKeyFor(room.identifier));
        const page = await BaseChannel.createMessagesQuery({
          channelIdentifier: room.identifier,
          isAscending: false,
          pageSize: 30,
        }).loadNextPage();
        if (!active) return;
        if (page.isOk) useMessages.getState().mergeMessages(page.data?.data ?? []);
        else setHistoryError(`Could not load messages (code ${page.code})`);
      } catch {
        if (active) setHistoryError("Could not load messages");
      } finally {
        if (active) setHistoryLoading(false);
      }
    }

    void loadHistory();
    return () => { active = false; };
  }, [connected, historyAttempt]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending || !connected) return;

    setSending(true);
    setSendError(null);
    try {
      const { GroupChannel, SendTextMessageParams } = await initNexconn();
      if (useConnection.getState().userId !== userId) return;
      const result = await new GroupChannel(DEV_ROOM_ID).sendMessage(new SendTextMessageParams({ text }));
      if (useConnection.getState().userId !== userId) return;
      if (!result.isOk || !result.data) {
        setSendError(`Message could not be sent (code ${result.code})`);
        return;
      }
      useMessages.getState().mergeMessages([result.data]);
      setDraft("");
    } catch {
      setSendError("Message could not be sent");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="devroom-heading">
      <h2 id="devroom-heading" className="text-lg font-semibold">Devroom · {userId}</h2>
      {connected && historyLoading && <p role="status">Loading messages…</p>}
      {historyError && (
        <div>
          <p role="alert">{historyError}</p>
          <button type="button" disabled={!connected} onClick={() => setHistoryAttempt((attempt) => attempt + 1)} className="underline">Retry history</button>
        </div>
      )}
      {!historyLoading && !historyError && !messages.length && <p>No messages yet.</p>}
      <ul aria-label="Devroom messages" aria-live="polite" className="flex max-h-96 flex-col gap-2 overflow-y-auto">
        {messages.map(({ messageId, senderUserId, content }) => (
          <li key={messageId} className="wrap-break-word">
            <strong>{senderUserId}</strong>{" "}
            {content && "text" in content && typeof content.text === "string" ? content.text : "Unsupported message"}
          </li>
        ))}
      </ul>
      <form onSubmit={send} className="flex items-end gap-2">
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
