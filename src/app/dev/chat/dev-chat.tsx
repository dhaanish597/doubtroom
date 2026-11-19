"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";

import { ConnectionBanner } from "@/components/chat/ConnectionBanner";
import { connectNexconn } from "@/lib/nexconn/client";
import { CONNECTION_CODE } from "@/lib/nexconn/codes";
import { DEV_ROOM_ID } from "@/lib/nexconn/dev-room";
import { NexconnProvider, useNexconnStatus } from "@/lib/nexconn/provider";
import { useConnection } from "@/lib/stores/connection";
import { GroupChat } from "@/components/chat/GroupChat";

const tokenSchema = z.object({ token: z.string().min(1), roomId: z.literal(DEV_ROOM_ID) });
const errorSchema = z.object({ error: z.object({ message: z.string() }) });
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
          <button className={`${buttonClass} self-start`} type="submit">
            {requesting ? "Requesting token…" : "Connect"}
          </button>
        </fieldset>
      </form>
      <ConnectionBanner onReconnect={reconnect} />
      {error && <p role="alert">{error}</p>}
      {connectedUser && <div className="flex h-[min(65dvh,38rem)] min-h-72 flex-col overflow-hidden rounded-2xl border"><GroupChat roomId={DEV_ROOM_ID} title="DoubtRoom test chat" dev /></div>}
    </main>
  );
}
