import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { BOT_IDS } from "./identities";
import { MSG, doubtSchema } from "./messages";

/** Nexconn retries a webhook for about 15 s; anything older than this is treated as a replay. */
export const WEBHOOK_MAX_SKEW_MS = 5 * 60 * 1000;
const GROUP_CHANNEL = 3;
const BOT_USER_IDS: ReadonlySet<string> = new Set(Object.values(BOT_IDS));

type Credentials = { appKey: string; appSecret: string };

/**
 * Checks the Nexconn webhook headers: AppKey must be ours and
 * Signature = sha1(AppSecret + Nonce + Timestamp) in lowercase hex, within WEBHOOK_MAX_SKEW_MS.
 */
export function verifyWebhookSignature(headers: Headers, { appKey, appSecret }: Credentials, now = Date.now()): boolean {
  const key = headers.get("appkey");
  const nonce = headers.get("nonce");
  const timestamp = headers.get("timestamp");
  const signature = headers.get("signature")?.toLowerCase();
  if (!key || !nonce || !timestamp || !signature || key !== appKey) return false;
  if (nonce.length > 64 || !/^\d{10,16}$/u.test(timestamp)) return false;
  if (Math.abs(now - Number(timestamp)) > WEBHOOK_MAX_SKEW_MS) return false;
  const expected = createHash("sha1").update(appSecret + nonce + timestamp, "utf8").digest("hex");
  return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

const messageSchema = z.object({
  userId: z.string().min(1).max(64),
  channelId: z.string().min(1).max(64),
  messageType: z.string().min(1).max(64),
  content: z.string().max(140_000),
  channelType: z.coerce.number(),
  messageId: z.string().min(1).max(128),
  os: z.string().optional(),
});

const envelopeSchema = z.object({ type: z.string(), id: z.string().optional(), data: z.array(z.unknown()).max(100) });

export type SentMessage = z.infer<typeof messageSchema>;

/** Returns the valid message:send items in a webhook body; other event types yield an empty list. */
export function sentMessages(body: unknown): SentMessage[] {
  const envelope = envelopeSchema.safeParse(body);
  if (!envelope.success || envelope.data.type !== "message:send") return [];
  return envelope.data.data.flatMap((item) => {
    const parsed = messageSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

function json(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Maps a group message to the same body the browser posts to /api/ta/ask,
 * or null when the TA should ignore it (bots, server sends, non-doubt, no @TA).
 */
export function taRequestFromMessage(message: SentMessage): Record<string, unknown> | null {
  if (message.channelType !== GROUP_CHANNEL || BOT_USER_IDS.has(message.userId) || message.os === "Server") return null;
  const content = json(message.content);
  const base = { roomId: message.channelId, messageId: message.messageId };
  if (message.messageType === MSG.DOUBT) {
    const doubt = doubtSchema.safeParse(content);
    if (!doubt.success) return null;
    const { doubtId, text, unit, imageUrl, lang } = doubt.data;
    return { ...base, mode: "doubt", doubtId, text, ...(unit ? { unit } : {}), ...(imageUrl ? { imageUrl } : {}), ...(lang ? { lang } : {}) };
  }
  if (message.messageType === "RC:TxtMsg" && content && typeof content === "object") {
    const record = content as { content?: unknown; text?: unknown };
    const text = typeof record.content === "string" ? record.content : typeof record.text === "string" ? record.text : "";
    // acceptTaRequest checks the @TA mention, exactly as it does for the browser relay.
    return text.includes("@") ? { ...base, mode: "mention", text } : null;
  }
  return null;
}
