"use client";

export function trackRoomEvent(name: "message_sent" | "room_opened", roomId: string) {
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, props: { roomId } }),
    keepalive: true,
  }).catch(() => undefined);
}
