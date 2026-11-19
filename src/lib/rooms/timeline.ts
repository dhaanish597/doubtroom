import type { ChatMessage } from "../stores/messages";

const dateLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const timeLabel = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });

export function messageDate(time: number) {
  return Number.isFinite(time) && Math.abs(time) <= 8.64e15 ? dateLabel.format(time) : "";
}

export function messageTime(time: number) {
  return Number.isFinite(time) && Math.abs(time) <= 8.64e15 ? timeLabel.format(time) : "";
}

export function groupMessages(previous: ChatMessage | undefined, message: ChatMessage) {
  return Boolean(previous && previous.senderUserId === message.senderUserId
    && message.sentTime >= previous.sentTime && message.sentTime - previous.sentTime <= 5 * 60_000
    && messageDate(previous.sentTime) === messageDate(message.sentTime));
}

export function mentionAt(text: string, cursor: number) {
  const match = /(?:^|\s)@([\p{L}\p{M}\p{N}_-]*)$/u.exec(text.slice(0, cursor));
  return match ? { query: match[1], from: cursor - match[1].length - 1, to: cursor } : null;
}

export function escapePattern(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function mentionPattern(label: string) {
  return `(?<![\\p{L}\\p{M}\\p{N}_@])@${escapePattern(label)}(?![\\p{L}\\p{M}\\p{N}_-])`;
}
