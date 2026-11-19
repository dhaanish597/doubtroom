"use client";

import { create } from "zustand";
import type { MuteStatus } from "./types";

export class ModerationFailure extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ModerationFailure";
  }
}

async function call<T>(url: string, init: RequestInit, fallback: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ModerationFailure("You seem to be offline. Try again.", 0);
  }
  const data = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  if (!response.ok) throw new ModerationFailure(data?.error?.message ?? fallback, response.status);
  return data as T;
}

function post<T>(url: string, body: object, fallback: string) {
  return call<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, fallback);
}

export function recordAnnouncement(body: { roomId: string; messageId: string; title: string; body: string; urgent: boolean }) {
  return post<{ ok: true }>("/api/announcements", body, "Your announcement is in the chat, but it wasn’t saved");
}

export function sendReport(body: { roomId: string; messageId: string; reason: string; excerpt?: string; senderId?: string }) {
  return post<{ ok: true }>("/api/reports", body, "Could not send the report");
}

type RoomMutes = MuteStatus & { loadedAt: number };

/** Mute state per room: the viewer's own mute, and muted members for reps and admins. */
export const useMutes = create<{ byRoom: Record<string, RoomMutes> }>(() => ({ byRoom: {} }));

function storeStatus(roomId: string, status: MuteStatus) {
  useMutes.setState((state) => ({ byRoom: { ...state.byRoom, [roomId]: { ...status, loadedAt: Date.now() } } }));
}

export function seedMuteStatus(roomId: string, mutedUntil: number | null) {
  if (useMutes.getState().byRoom[roomId]) return;
  storeStatus(roomId, { mutedUntil });
}

export async function refreshMuteStatus(roomId: string) {
  const status = await call<MuteStatus>(`/api/moderation/mute?roomId=${encodeURIComponent(roomId)}`,
    { cache: "no-store" }, "Could not load the mute status");
  storeStatus(roomId, status);
  return status;
}

/** minutes 0 unmutes. */
export async function setMemberMute(roomId: string, nexconnUserId: string, minutes: number) {
  const result = await post<{ ok: true; mutedUntil: number | null }>("/api/moderation/mute",
    { roomId, nexconnUserId, minutes }, "Could not update the mute");
  useMutes.setState((state) => {
    const current = state.byRoom[roomId] ?? { mutedUntil: null, loadedAt: Date.now() };
    const members = { ...current.members };
    if (result.mutedUntil) members[nexconnUserId] = result.mutedUntil;
    else delete members[nexconnUserId];
    return { byRoom: { ...state.byRoom, [roomId]: { ...current, members } } };
  });
  return result;
}
