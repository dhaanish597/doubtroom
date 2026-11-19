export type MentorSummary = {
  nexconnId: string;
  name: string;
  avatar: string | null;
  role: string;
  dept: string | null;
  year: number | null;
  /** null when Nexconn could not report the status. */
  online: boolean | null;
};

export function dmHref(peerId: string, context?: { roomId?: string; doubtMessageId?: string }) {
  const query = new URLSearchParams();
  if (context?.doubtMessageId) query.set("doubt", context.doubtMessageId);
  if (context?.roomId) query.set("room", context.roomId);
  const suffix = query.size ? `?${query}` : "";
  return `/app/dm/${encodeURIComponent(peerId)}${suffix}`;
}

const QUOTE_LIMIT = 600;

/** Composer text for a DM that started from a doubt. Seniors writing to the asker say "your". */
export function doubtPrefill(roomTitle: string, text: string, own = true) {
  const quote = text.length > QUOTE_LIMIT ? `${text.slice(0, QUOTE_LIMIT - 1)}…` : text;
  return `About ${own ? "my" : "your"} doubt in ${roomTitle}: "${quote}"`;
}
