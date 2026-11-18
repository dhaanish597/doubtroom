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
