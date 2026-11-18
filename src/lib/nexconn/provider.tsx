"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { useConnection } from "@/lib/stores/connection";
import { connectNexconn, disconnectNexconn } from "./client";

export function useNexconnStatus() {
  return useConnection((state) => state.status);
}

export function NexconnProvider({ token, children }: { token: string | null; children: ReactNode }) {
  const lifecycleRef = useRef({ generation: 0 });

  useEffect(() => {
    const lifecycle = lifecycleRef.current;
    const session = ++lifecycle.generation;
    // The adapter stores connection errors for the UI.
    if (token) void connectNexconn(token).catch(() => undefined);
    else void disconnectNexconn().catch(() => undefined);

    return () => {
      // A replacement effect owns the connection if React remounts it immediately.
      queueMicrotask(() => {
        if (session === lifecycle.generation) void disconnectNexconn().catch(() => undefined);
      });
    };
  }, [token]);

  return children;
}
