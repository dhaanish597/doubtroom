import { z } from "zod";

import script from "../data/demo-seed.json";
import { BOT_IDS } from "@/lib/nexconn/identities";
import { MSG, answerSchema, type AnswerContent } from "@/lib/nexconn/messages";
import { NexconnError, sendGroupCustom, sendGroupText, setMessageMetadata } from "@/lib/nexconn/server";
import { adminSupabase } from "@/lib/supabase/admin";

const MARKER_EVENT = "demo_seed_message";
const SEED_MODEL = "demo-seed";
const demoUser = z.enum([BOT_IDS.DEMO_MENTOR, BOT_IDS.DEMO_PRIYA]);
const key = z.string().regex(/^[a-z0-9_]{1,48}$/);

const messageSchema = z.discriminatedUnion("kind", [
  z.strictObject({ key, kind: z.literal("announce"), from: demoUser, title: z.string().min(1), body: z.string().min(1) }),
  z.strictObject({ key, kind: z.literal("text"), from: demoUser, text: z.string().min(1) }),
  z.strictObject({ key, kind: z.literal("doubt"), from: demoUser, doubtId: z.uuid(), unit: z.string(), text: z.string().min(1) }),
  z.strictObject({
    key, kind: z.literal("answer"), doubt: key, answerId: z.uuid(), markdown: z.string().min(1), examTip: z.string().optional(),
    sources: answerSchema.shape.sources,
    verifiedBy: demoUser.optional(), verName: z.string().optional(), upvotedBy: z.array(demoUser).default([]),
  }),
]);
const scriptSchema = z.strictObject({
  roomId: z.string().regex(/^demo_[a-z0-9_]{1,59}$/),
  courseCode: z.string().regex(/^[A-Z0-9]{2,12}$/),
  messages: z.array(messageSchema).min(1),
});

export type DemoScript = z.infer<typeof scriptSchema>;
type DemoMessage = DemoScript["messages"][number];
type DoubtMessage = Extract<DemoMessage, { kind: "doubt" }>;
type AnswerMessage = Extract<DemoMessage, { kind: "answer" }>;
type Db = ReturnType<typeof adminSupabase>;

export function loadDemoScript(): DemoScript {
  const parsed = scriptSchema.parse(script);
  const keys = new Set<string>();
  for (const message of parsed.messages) {
    if (keys.has(message.key)) throw new Error(`Duplicate demo message key ${message.key}`);
    if (message.kind === "answer" && !parsed.messages.some((item) => item.kind === "doubt" && item.key === message.doubt && keys.has(item.key))) {
      throw new Error(`Demo answer ${message.key} must follow its doubt`);
    }
    keys.add(message.key);
  }
  return parsed;
}

async function sentMarkers(db: Db, roomId: string) {
  const { data, error } = await db.from("events").select("props").eq("name", MARKER_EVENT).eq("props->>room", roomId)
    .returns<{ props: { key?: string; messageId?: string } }[]>();
  if (error) throw error;
  return new Map(data.flatMap(({ props }) => props.key && props.messageId ? [[props.key, props.messageId] as const] : []));
}

function answerPayload(message: AnswerMessage, doubt: DoubtMessage, doubtMessageId: string): AnswerContent {
  return {
    v: 1, answerId: message.answerId, doubtId: doubt.doubtId, doubtMessageId, markdown: message.markdown,
    examTip: message.examTip, sources: message.sources, lang: "en", model: SEED_MODEL, quotedText: doubt.text,
  };
}

function answerMetadata(message: AnswerMessage): Record<string, string> {
  return {
    up: String(new Set(message.upvotedBy).size),
    ver: message.verifiedBy ? "1" : "0",
    ...(message.verifiedBy ? { verBy: message.verifiedBy, verName: message.verName ?? "A senior" } : {}),
  };
}

/** Points the doubt card at its answer, as the TA route does (asker first, then the bot). */
async function linkDoubt(roomId: string, doubt: DoubtMessage, doubtMessageId: string, answer: AnswerMessage, answerMessageId: string) {
  const metadata = { st: answer.verifiedBy ? "verified" : "ai", ans: answerMessageId, did: doubt.doubtId };
  for (const writer of [doubt.from, BOT_IDS.TA]) {
    try {
      await setMessageMetadata(3, roomId, doubtMessageId, writer, metadata);
      return;
    } catch (error) {
      console.warn(`Could not update demo doubt metadata as ${writer}${error instanceof NexconnError ? ` (Nexconn ${error.errorCode})` : ""}`);
    }
  }
}

async function send(roomId: string, courseCode: string, message: DemoMessage, doubts: Map<string, DoubtMessage>, sent: Map<string, string>) {
  const delivery = { isEchoToSender: 0, shouldPersist: 1 } as const;
  let result;
  if (message.kind === "announce") {
    result = await sendGroupCustom(message.from, roomId, MSG.ANNOUNCE, { v: 1, title: message.title, body: message.body },
      { ...delivery, needReadReceipt: 1, pushContent: "New class announcement" });
  } else if (message.kind === "text") {
    result = await sendGroupText(message.from, roomId, message.text, delivery);
  } else if (message.kind === "doubt") {
    result = await sendGroupCustom(message.from, roomId, MSG.DOUBT,
      { v: 1, doubtId: message.doubtId, text: message.text, unit: message.unit, courseCode, lang: "en" },
      { ...delivery, hasMetadata: true, metadata: { st: "open", did: message.doubtId } });
  } else {
    const doubt = doubts.get(message.doubt);
    const doubtMessageId = sent.get(message.doubt);
    if (!doubt || !doubtMessageId) throw new Error(`Demo answer ${message.key} has no sent doubt`);
    result = await sendGroupCustom(BOT_IDS.TA, roomId, MSG.ANSWER, answerPayload(message, doubt, doubtMessageId),
      { ...delivery, hasMetadata: true, metadata: answerMetadata(message), pushContent: "DoubtRoom TA answered a doubt" });
  }
  const messageId = result?.messageIds?.find((item) => item.channelId === roomId)?.messageId;
  if (!messageId) throw new Error(`Nexconn returned no message ID for demo message ${message.key}`);
  if (message.kind === "answer") {
    const doubt = doubts.get(message.doubt);
    const doubtMessageId = sent.get(message.doubt);
    if (doubt && doubtMessageId) await linkDoubt(roomId, doubt, doubtMessageId, message, messageId);
  }
  return messageId;
}

async function upsertRows(db: Db, demo: DemoScript, sent: Map<string, string>, profileIds: Map<string, string>) {
  const now = new Date().toISOString();
  const profile = (id: string) => {
    const value = profileIds.get(id);
    if (!value) throw new Error(`Missing demo profile ${id}`);
    return value;
  };
  const doubts = new Map(demo.messages.flatMap((message) => message.kind === "doubt" ? [[message.key, message] as const] : []));

  for (const message of demo.messages) {
    const messageId = sent.get(message.key);
    if (!messageId) continue;
    if (message.kind === "announce") {
      const { error } = await db.from("announcements").upsert({ room_id: demo.roomId, author_id: profile(message.from),
        message_id: messageId, title: message.title, body: message.body }, { onConflict: "message_id" });
      if (error) throw error;
    }
    if (message.kind !== "answer") continue;
    const doubt = doubts.get(message.doubt);
    const doubtMessageId = sent.get(message.doubt);
    if (!doubt || !doubtMessageId) continue;
    const verified = Boolean(message.verifiedBy);
    const doubtRow = await db.from("doubts").upsert({
      id: doubt.doubtId, room_id: demo.roomId, asker_id: profile(doubt.from), message_id: doubtMessageId, text: doubt.text,
      unit: doubt.unit, lang: "en", status: verified ? "verified" : "ai_answered", ai_answered_at: now, verified_at: verified ? now : null,
    });
    if (doubtRow.error) throw doubtRow.error;
    const voters = [...new Set(message.upvotedBy)];
    const answerRow = await db.from("answers").upsert({
      id: message.answerId, doubt_id: doubt.doubtId, room_id: demo.roomId, message_id: messageId, author_kind: "ai",
      body_md: message.markdown, sources: message.sources ?? null, model: SEED_MODEL, exam_tip: message.examTip ?? null, confidence: "high", upvotes: voters.length,
      verified_by: message.verifiedBy ? profile(message.verifiedBy) : null, verified_at: verified ? now : null,
    });
    if (answerRow.error) throw answerRow.error;
    if (voters.length) {
      const votes = await db.from("answer_votes").upsert(voters.map((id) => ({ answer_id: message.answerId, profile_id: profile(id) })),
        { ignoreDuplicates: true });
      if (votes.error) throw votes.error;
    }
  }
}

/**
 * Seeds the demo room conversation once. Each delivered message gets a marker event, so a
 * rerun skips everything already sent and only resends what failed.
 */
export async function seedDemoConversation(profileIds: Map<string, string>, demo = loadDemoScript()) {
  const db = adminSupabase();
  const sent = await sentMarkers(db, demo.roomId);
  const doubts = new Map<string, DoubtMessage>();
  let delivered = 0;

  for (const message of demo.messages) {
    if (message.kind === "doubt") doubts.set(message.key, message);
    if (sent.has(message.key)) continue;
    const messageId = await send(demo.roomId, demo.courseCode, message, doubts, sent);
    const marker = await db.from("events").insert({ name: MARKER_EVENT, props: { room: demo.roomId, key: message.key, messageId } });
    if (marker.error) throw marker.error;
    sent.set(message.key, messageId);
    delivered += 1;
  }

  await upsertRows(db, demo, sent, profileIds);
  return { delivered, skipped: demo.messages.length - delivered };
}
