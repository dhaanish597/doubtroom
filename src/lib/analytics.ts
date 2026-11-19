"use client";

/**
 * Client analytics. `track()` sends an allowlisted event to PostHog (when configured) and
 * re-broadcasts it in the page so features such as the demo tour can react to it.
 * Message text, emails and other free text are never sent.
 */
export const ANALYTICS_EVENTS = [
  "signed_up", "onboarded", "connected", "room_opened", "doubt_posted", "answer_received",
  "upvoted", "verified", "dm_started", "try_started", "try_step_done", "install_clicked",
] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];
export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;
export const TRACK_EVENT = "doubtroom:track";
export type TrackDetail = { name: AnalyticsEvent; props: Record<string, string | number | boolean> };

type Capture = { capture: (name: string, props?: Record<string, unknown>) => unknown; identify: (id: string, props?: Record<string, unknown>) => unknown };

const BLOCKED_KEY = /text|message|body|content|email|name|markdown|quote/i;
const MAX_VALUE_LENGTH = 64;
const MAX_QUEUE = 50;

let client: Capture | null = null;
let identity: { id: string; props: Record<string, string> } | null = null;
const queue: TrackDetail[] = [];

/** Keeps only short, non-text values under safe keys. IDs, counts, flags and step names pass. */
export function sanitizeProps(props: AnalyticsProps = {}): Record<string, string | number | boolean> {
  const clean: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (BLOCKED_KEY.test(key) || value === null || value === undefined) continue;
    if (typeof value === "string" && (value.length > MAX_VALUE_LENGTH || /\s/.test(value))) continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    clean[key] = value;
  }
  return clean;
}

export function isAnalyticsEvent(name: string): name is AnalyticsEvent {
  return (ANALYTICS_EVENTS as readonly string[]).includes(name);
}

export function track(name: AnalyticsEvent, props?: AnalyticsProps) {
  if (!isAnalyticsEvent(name)) return;
  const detail: TrackDetail = { name, props: sanitizeProps(props) };
  if (client) client.capture(name, detail.props);
  else if (queue.length < MAX_QUEUE) queue.push(detail);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<TrackDetail>(TRACK_EVENT, { detail }));
}

/** Subscribes to tracked events in this page. Returns the unsubscribe function. */
export function onTrack(listener: (detail: TrackDetail) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<TrackDetail>).detail);
  window.addEventListener(TRACK_EVENT, handler);
  return () => window.removeEventListener(TRACK_EVENT, handler);
}

/** Identify by Nexconn user ID only (never email). */
export function identifyAnalytics(nexconnUserId: string, kind: "user" | "try") {
  identity = { id: nexconnUserId, props: { actor_kind: kind } };
  client?.identify(nexconnUserId, identity.props);
}

/** Called once by the PostHog provider after initialization. */
export function attachAnalytics(capture: Capture) {
  client = capture;
  if (identity) capture.identify(identity.id, identity.props);
  for (const event of queue.splice(0)) capture.capture(event.name, event.props);
}

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
  if (name !== "message_sent") track(name, { roomId });
}

export function trackDmEvent(name: "dm_started" | "dm_message_sent", peerId: string) {
  sendEvent(name, { peerId });
  if (name === "dm_started") track(name, { peerId });
}
