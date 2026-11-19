"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { z } from "zod";

import { ConnectionBanner } from "@/components/chat/ConnectionBanner";
import { publicEnv } from "@/lib/public-env";
import { useConnection } from "@/lib/stores/connection";
import { connectNexconn, disconnectNexconn } from "./client";
import { CONNECTION_CODE } from "./codes";

const sessionSchema = z.object({
  token: z.string().min(1),
  appKey: z.string().min(1),
  nexconnUserId: z.string().min(1),
});

export function useNexconnStatus() {
  return useConnection((state) => state.status);
}

export function NexconnProvider({ token, children }: { token?: string | null; children: ReactNode }) {
  const lifecycleRef = useRef({ generation: 0 });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const lifecycle = lifecycleRef.current;
    const session = ++lifecycle.generation;
    const controller = new AbortController();

    async function connectSession(refresh = false) {
      const response = await fetch(refresh ? "/api/session?refresh=1" : "/api/session", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Could not prepare your chat session");
      const result = sessionSchema.parse(await response.json());
      if (result.appKey !== publicEnv.NEXT_PUBLIC_NEXCONN_APP_KEY) throw new Error("Chat configuration does not match");
      if (controller.signal.aborted) return;
      try {
        const userId = await connectNexconn(result.token);
        if (userId !== result.nexconnUserId) {
          await disconnectNexconn();
          throw new Error("Chat identity does not match");
        }
      } catch (error) {
        const { code } = useConnection.getState();
        if (!refresh && (code === CONNECTION_CODE.TOKEN_EXPIRED || code === CONNECTION_CODE.TOKEN_INCORRECT) && !controller.signal.aborted) {
          await connectSession(true);
          return;
        }
        throw error;
      }
    }

    if (token === undefined) {
      useConnection.setState({ status: "connecting", error: null });
      void connectSession().catch(() => {
        if (!controller.signal.aborted && useConnection.getState().status !== "offline") {
          useConnection.setState({ status: "offline", error: "Could not connect to chat" });
        }
      });
    } else if (token) {
      void connectNexconn(token).catch(() => undefined);
    } else {
      void disconnectNexconn().catch(() => undefined);
    }

    function resume() {
      const { status, code } = useConnection.getState();
      if (token === undefined && document.visibilityState === "visible" && status === "offline" && code !== CONNECTION_CODE.KICKED) {
        setAttempt((value) => value + 1);
      }
    }
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      controller.abort();
      queueMicrotask(() => {
        if (session === lifecycle.generation) void disconnectNexconn().catch(() => undefined);
      });
    };
  }, [token, attempt]);

  return (
    <>
      {token === undefined && (
        <div className="border-b bg-muted/50 px-4 py-2 text-sm text-muted-foreground">
          <div className="mx-auto max-w-2xl"><ConnectionBanner onReconnect={() => setAttempt((value) => value + 1)} /></div>
        </div>
      )}
      {children}
    </>
  );
}
