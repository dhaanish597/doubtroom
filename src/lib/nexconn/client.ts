"use client";

import { publicEnv } from "@/lib/public-env";
import { notifyChannelChange, useConnection, type ChatStatus } from "@/lib/stores/connection";
import { channelKeyFor, useMessages } from "@/lib/stores/messages";
import { resetProfiles } from "@/lib/stores/profiles";
import { recordRoomMessage, resetRooms } from "@/lib/stores/rooms";
import { identifyAnalytics, track } from "@/lib/analytics";
import { BOT_IDS } from "./identities";
import { MSG, safeParseAnswer } from "./messages";

type ReceivedMessage = { messageType: string; senderUserId: string; content: unknown; sentTime: number; channelIdentifier: Parameters<typeof channelKeyFor>[0] };
const LIVE_WINDOW_MS = 2 * 60 * 1000;
const MAX_ANSWER_LATENCY_MS = 30 * 60 * 1000;
let trackedConnection: string | null = null;

/** Reports how long the TA took to answer one of my doubts. Only IDs and timings leave the page. */
function trackAnswerLatency(messages: readonly ReceivedMessage[], userId: string | null) {
  if (!userId) return;
  const now = Date.now();
  for (const message of messages) {
    if (message.messageType !== MSG.ANSWER || message.senderUserId !== BOT_IDS.TA || now - message.sentTime > LIVE_WINDOW_MS) continue;
    const answer = safeParseAnswer(message.content).data;
    if (!answer || answer.failed) continue;
    const doubt = useMessages.getState().byChannel[channelKeyFor(message.channelIdentifier)]
      ?.find((entry) => entry.messageId === answer.doubtMessageId);
    const latency = doubt && doubt.senderUserId === userId ? message.sentTime - doubt.sentTime : Number.NaN;
    if (latency >= 0 && latency <= MAX_ANSWER_LATENCY_MS) {
      track("answer_received", { roomId: message.channelIdentifier.channelId, latency_ms: latency, cached: Boolean(answer.cached) });
    }
  }
}

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
        if (!currentToken) return;
        const store = useMessages.getState();
        const seen = new Set<string>();
        const userId = useConnection.getState().userId;
        for (const message of messages) {
          const key = channelKeyFor(message.channelIdentifier);
          const identity = `${key}:${message.messageId}`;
          if (!message.messageId || seen.has(identity)) continue;
          seen.add(identity);
          const known = store.byChannel[key]?.some((entry) => entry.messageId === message.messageId);
          recordRoomMessage(message, !known && Boolean(userId) && message.senderUserId !== userId && message.isCounted);
        }
        store.mergeMessages(messages);
        notifyChannelChange();
        trackAnswerLatency(messages, userId);
      },
      onMessageMetadataUpdated({ channelIdentifier, messageId, metadata }) {
        if (currentToken) useMessages.getState().mergeMetadata(channelIdentifier, messageId, metadata);
      },
    }));
    NCEngine.addChannelHandler("app", new ChannelHandler({
      onChannelsSyncComplete() {
        if (currentToken) useConnection.setState({ channelsSynced: true });
      },
      onChannelUnreadStatusSync() {
        if (currentToken) notifyChannelChange();
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
        resetChatStores();
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
      if (trackedConnection !== userId) {
        trackedConnection = userId;
        identifyAnalytics(userId, userId.startsWith("try_") ? "try" : "user");
        track("connected");
      }
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
      resetChatStores();
      useConnection.setState({ status: "idle", userId: null, code: null, error: null, channelsSynced: false });
    }
  });
}

function resetChatStores() {
  useMessages.getState().reset();
  resetProfiles();
  resetRooms();
}
