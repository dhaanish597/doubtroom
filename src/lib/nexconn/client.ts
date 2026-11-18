"use client";

import { publicEnv } from "@/lib/public-env";
import { useConnection, type ChatStatus } from "@/lib/stores/connection";
import { useMessages } from "@/lib/stores/messages";
import { MSG } from "./messages";

type ChatSdk = typeof import("@nexconn/chat");

let initialization: Promise<ChatSdk> | undefined;
let connectionQueue: Promise<unknown> = Promise.resolve();
let currentToken: string | undefined;
let sdk: ChatSdk | undefined;

export function initNexconn(): Promise<ChatSdk> {
  if (typeof window === "undefined") return Promise.reject(new Error("Nexconn Chat requires a browser"));
  const appKey = publicEnv.NEXT_PUBLIC_NEXCONN_APP_KEY;
  if (!appKey) return Promise.reject(new Error("NEXT_PUBLIC_NEXCONN_APP_KEY is required"));

  return initialization ??= import("@nexconn/chat").then((chat) => {
    const { AreaCode, ChannelHandler, ConnectionStatus, ConnectionStatusHandler, LogLevel, MessageHandler, NCEngine } = chat;
    NCEngine.initialize({
      appKey,
      areaCode: AreaCode.SG,
      logLevel: process.env.NODE_ENV === "development" ? LogLevel.DEBUG : LogLevel.WARN,
    });
    NCEngine.registerCustomMessages(Object.values(MSG).map((messageType) => ({
      messageType,
      isPersisted: true,
      isCounted: messageType !== MSG.RECAP,
    })));

    NCEngine.addConnectionStatusHandler("app", new ConnectionStatusHandler({
      onConnectionStatusChanged({ status, code }) {
        if (!currentToken) return;
        const next: ChatStatus = status === ConnectionStatus.CONNECTED ? "connected"
          : status === ConnectionStatus.CONNECTING ? "connecting"
          : "offline";
        // The event can precede the connect response that identifies the user.
        useConnection.setState({ status: next, code: code ?? null, error: null });
      },
    }));
    NCEngine.addMessageHandler("app", new MessageHandler({
      onMessageReceived({ messages }) {
        if (currentToken) useMessages.getState().mergeMessages(messages);
      },
      onMessageMetadataUpdated({ channelIdentifier, messageId, metadata }) {
        if (currentToken) useMessages.getState().mergeMetadata(channelIdentifier, messageId, metadata);
      },
    }));
    NCEngine.addChannelHandler("app", new ChannelHandler({
      onChannelsSyncComplete() {
        if (currentToken) useConnection.setState({ channelsSynced: true });
      },
    }));
    sdk = chat;
    return chat;
  });
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = connectionQueue.then(operation, operation);
  connectionQueue = result;
  return result;
}

export function connectNexconn(token: string): Promise<string> {
  return enqueue(async () => {
    const current = useConnection.getState();
    if (token === currentToken && current.status === "connected" && current.userId) return current.userId;

    try {
      const chat = await initNexconn();
      if (currentToken && currentToken !== token) {
        currentToken = undefined;
        await chat.NCEngine.disconnect();
        useMessages.getState().reset();
      }
      currentToken = token;
      useConnection.setState({ status: "connecting", userId: null, code: null, error: null, channelsSynced: false });
      const result = await chat.NCEngine.connect({ token });
      const userId = result.data?.userId;
      if (!result.isOk || !userId) {
        useConnection.setState({ code: result.code });
        throw new Error(`Nexconn connection failed (code ${result.code})`);
      }
      useConnection.setState({ status: "connected", userId, code: null, error: null });
      return userId;
    } catch (error) {
      const message = error instanceof Error && /^Nexconn connection failed \(code \d+\)$/.test(error.message)
        ? error.message
        : publicEnv.NEXT_PUBLIC_NEXCONN_APP_KEY
          ? "The Nexconn connection could not be started"
          : "NEXT_PUBLIC_NEXCONN_APP_KEY is required";
      useConnection.setState({ status: "offline", userId: null, error: message });
      throw new Error(message);
    }
  });
}

export function disconnectNexconn(): Promise<void> {
  return enqueue(async () => {
    try {
      if (currentToken) {
        currentToken = undefined;
        await sdk?.NCEngine.disconnect();
      }
    } finally {
      useMessages.getState().reset();
      useConnection.setState({ status: "idle", userId: null, code: null, error: null, channelsSynced: false });
    }
  });
}
