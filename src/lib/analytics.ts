"use client";

function sendEvent(name: string, props: Record<string, string>) {
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, props }),
    keepalive: true,
  }).catch(() => undefined);
}

export function trackRoomEvent(name: "message_sent" | "room_opened" | "doubt_posted", roomId: string) {
  sendEvent(name, { roomId });
}

export function trackDmEvent(name: "dm_started" | "dm_message_sent", peerId: string) {
  sendEvent(name, { peerId });
}
