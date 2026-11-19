import { z } from "zod";

export const MSG = {
  DOUBT: "dr:doubt",
  ANSWER: "dr:answer",
  ANNOUNCE: "dr:announce",
  RECAP: "dr:recap",
} as const;

const version = z.literal(1);
const lang = z.enum(["en", "ta", "tanglish"]);

export const doubtSchema = z.object({
  v: version,
  doubtId: z.string(),
  text: z.string(),
  unit: z.string().optional(),
  imageUrl: z.string().optional(),
  courseCode: z.string().optional(),
  lang: lang.optional(),
});

export const answerSchema = z.object({
  v: version,
  answerId: z.string(),
  doubtId: z.string().optional(),
  doubtMessageId: z.string(),
  markdown: z.string(),
  examTip: z.string().optional(),
  sources: z.array(z.object({ title: z.string(), page: z.number().optional() })).optional(),
  lang,
  model: z.string(),
  failed: z.boolean().optional(),
  quotedText: z.string(),
  cached: z.boolean().optional(),
});

export const announceSchema = z.object({
  v: version,
  title: z.string(),
  body: z.string(),
  urgent: z.boolean().optional(),
});

export const recapSchema = z.object({
  v: version,
  date: z.string(),
  items: z.array(z.object({
    doubtMessageId: z.string(),
    question: z.string(),
    answerSummary: z.string(),
    verifiedBy: z.string().optional(),
  })),
});

export type DoubtContent = z.infer<typeof doubtSchema>;
export type AnswerContent = z.infer<typeof answerSchema>;
export type AnnounceContent = z.infer<typeof announceSchema>;
export type RecapContent = z.infer<typeof recapSchema>;

function decodeContent(content: unknown): unknown {
  if (typeof content !== "string") return content;
  try {
    const decoded: unknown = JSON.parse(content);
    return decoded;
  } catch {
    // An undecodable string will fail all object schemas.
    return content;
  }
}

export function safeParseDoubt(content: unknown) {
  return doubtSchema.safeParse(decodeContent(content));
}

export function safeParseAnswer(content: unknown) {
  return answerSchema.safeParse(decodeContent(content));
}

export function safeParseAnnounce(content: unknown) {
  return announceSchema.safeParse(decodeContent(content));
}

export function safeParseRecap(content: unknown) {
  return recapSchema.safeParse(decodeContent(content));
}

// Mirror the pinned SDK values without importing its browser runtime.
export const MESSAGE_STATUS = { SENDING: 10, FAILED: 20 } as const satisfies Record<string, import("@nexconn/chat").SentStatus>;

export const STANDARD_MSG = {
  TEXT: "RC:TxtMsg",
  IMAGE: "RC:ImgMsg",
  FILE: "RC:FileMsg",
} as const;

export function mediaUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

const textSchema = z.object({ text: z.string(), mentionedInfo: z.object({
  userIdList: z.array(z.string().max(64)).max(100).optional(),
}).optional() });
const imageSchema = z.object({ remoteUrl: z.string(), thumbnailBase64: z.string().optional() });
const fileSchema = z.object({ remoteUrl: z.string(), name: z.string(), size: z.number().finite().nonnegative() });

export function renderableMessage(messageType: string, content: unknown) {
  switch (messageType) {
    case STANDARD_MSG.TEXT: {
      const parsed = textSchema.safeParse(decodeContent(content));
      if (parsed.success) return { kind: "text" as const, ...parsed.data };
      break;
    }
    case STANDARD_MSG.IMAGE: {
      const parsed = imageSchema.safeParse(decodeContent(content));
      const url = parsed.success && mediaUrl(parsed.data.remoteUrl);
      if (!url || !parsed.success) break;
      const base64 = parsed.data.thumbnailBase64;
      const thumbnail = base64 && base64.length <= 110_000 && /^[A-Za-z0-9+/]+={0,2}$/.test(base64)
        ? `data:image/jpeg;base64,${base64}` : url;
      return { kind: "image" as const, url, thumbnail };
    }
    case STANDARD_MSG.FILE: {
      const parsed = fileSchema.safeParse(decodeContent(content));
      const url = parsed.success && mediaUrl(parsed.data.remoteUrl);
      if (url && parsed.success) return { kind: "file" as const, url, name: parsed.data.name, size: parsed.data.size };
      break;
    }
    case MSG.DOUBT: {
      const parsed = safeParseDoubt(content);
      if (parsed.success) return { kind: "card" as const, label: "Doubt", text: parsed.data.text };
      break;
    }
    case MSG.ANSWER: {
      const parsed = safeParseAnswer(content);
      if (parsed.success) return { kind: "card" as const, label: "TA answer", text: parsed.data.markdown };
      break;
    }
    case MSG.ANNOUNCE: {
      const parsed = safeParseAnnounce(content);
      if (parsed.success) return { kind: "card" as const, label: "Announcement", text: parsed.data.title };
      break;
    }
    case MSG.RECAP: {
      const parsed = safeParseRecap(content);
      if (parsed.success) return { kind: "card" as const, label: "Recap", text: parsed.data.date };
      break;
    }
  }
  return { kind: "unsupported" as const };
}

export function messagePreview(messageType: string, content: unknown) {
  const message = renderableMessage(messageType, content);
  if (message.kind === "text") return message.text;
  if (message.kind === "image") return "Photo";
  if (message.kind === "file") return message.name;
  if (message.kind === "card") return message.label;
  return "Unsupported message";
}
