"use client";

export function trackRoomEvent(name: "message_sent" | "room_opened" | "doubt_posted", roomId: string) {
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, props: { roomId } }),
    keepalive: true,
  }).catch(() => undefined);
}
