import "server-only";

import { summarizeRecap } from "@/lib/ai/summarize";
import { createTomorrowEves } from "@/lib/eves/server";
import { istDate } from "@/lib/eves/time";
import { BOT_IDS } from "@/lib/nexconn/ids";
import { MSG } from "@/lib/nexconn/messages";
import { NexconnError, sendGroupCustom } from "@/lib/nexconn/server";
import { adminSupabase } from "@/lib/supabase/admin";
import {
  RECAP_UPVOTE_THRESHOLD, RECAP_WINDOW_MS, buildRecapContent, groupByRoom, rankRecapItems, type RecapCandidate,
} from "./rules";

/** Stop starting new rooms after this long so the function finishes inside its time limit. */
const ROOM_BUDGET_MS = 40_000;
const CANDIDATE_LIMIT = 1_000;

type AnswerRow = {
  id: string; room_id: string; body_md: string; upvotes: number; verified_by: string | null;
  verified_at: string | null; created_at: string;
  doubts: { message_id: string | null; text: string } | null;
};

export type RecapRun = {
  date: string;
  rooms: number;
  sent: number;
  skipped: number;
  failed: number;
  deferred: number;
  eves: { created: number; skipped: number; failed: number } | null;
};

/** Verified AI answers from the last 24 h, and AI answers with enough upvotes created in that time. */
async function loadCandidates(now: Date): Promise<RecapCandidate[]> {
  const since = new Date(now.getTime() - RECAP_WINDOW_MS).toISOString();
  const db = adminSupabase();
  const { data, error } = await db.from("answers")
    .select("id,room_id,body_md,upvotes,verified_by,verified_at,created_at,doubts!inner(message_id,text)")
    .eq("author_kind", "ai").not("message_id", "is", null).not("doubts.message_id", "is", null)
    .or(`verified_at.gte."${since}",and(upvotes.gte.${RECAP_UPVOTE_THRESHOLD},created_at.gte."${since}")`)
    .order("created_at", { ascending: false }).limit(CANDIDATE_LIMIT).returns<AnswerRow[]>();
  if (error) throw error;

  const verifierIds = [...new Set(data.flatMap((row) => row.verified_by ? [row.verified_by] : []))];
  const names = new Map<string, string>();
  if (verifierIds.length) {
    const profiles = await db.from("profiles").select("id,display_name").in("id", verifierIds)
      .returns<{ id: string; display_name: string }[]>();
    if (profiles.error) throw profiles.error;
    for (const profile of profiles.data) names.set(profile.id, profile.display_name);
  }

  return data.flatMap((row) => row.doubts?.message_id ? [{
    answerId: row.id, roomId: row.room_id, doubtMessageId: row.doubts.message_id, question: row.doubts.text,
    answer: row.body_md, upvotes: row.upvotes, verified: Boolean(row.verified_at),
    verifiedBy: row.verified_by ? names.get(row.verified_by) : undefined, createdAt: row.created_at,
  }] : []);
}

async function courseTitles(roomIds: string[]) {
  const titles = new Map<string, string>();
  if (!roomIds.length) return titles;
  const { data, error } = await adminSupabase().from("rooms").select("id,title,courses(title)").in("id", roomIds)
    .returns<{ id: string; title: string; courses: { title: string } | null }[]>();
  if (error) throw error;
  for (const room of data) titles.set(room.id, room.courses?.title ?? room.title);
  return titles;
}

async function claim(roomId: string, date: string): Promise<boolean> {
  const { data, error } = await adminSupabase().rpc("claim_recap", { p_room: roomId, p_date: date });
  if (error) throw error;
  return data === true;
}

async function finish(roomId: string, date: string, messageId: string | null, count: number) {
  const { error } = await adminSupabase().rpc("finish_recap", {
    p_room: roomId, p_date: date, p_message: messageId, p_count: count,
  });
  if (error) console.error("Could not record the recap run", { roomId, code: error.code });
}

async function postRoomRecap(roomId: string, date: string, title: string, items: RecapCandidate[]) {
  const summaries = await summarizeRecap(title, items.map(({ question, answer }) => ({ question, answer })))
    .catch(() => null);
  const content = buildRecapContent(date, items, summaries);
  // No pushContent: the recap is a quiet card, and clients register dr:recap with isCounted false.
  const result = await sendGroupCustom(BOT_IDS.TA, roomId, MSG.RECAP, content, { isEchoToSender: 0, shouldPersist: 1 });
  const messageId = result?.messageIds?.find((delivery) => delivery.channelId === roomId)?.messageId;
  if (!messageId) throw new Error("Missing Nexconn recap message ID");
  return messageId;
}

/**
 * Posts each room's morning recap at most once per IST day and creates tomorrow's Exam Eves.
 * Shared by the Vercel cron and the admin "Run recap now" button.
 */
export async function runRecap(now = new Date()): Promise<RecapRun> {
  const started = Date.now();
  const date = istDate(now);
  const eves = await createTomorrowEves(now).catch((error: unknown) => {
    console.error("Could not create tomorrow's Exam Eves", { reason: error instanceof Error ? error.name : "error" });
    return null;
  });

  const rooms = [...groupByRoom(await loadCandidates(now))]
    .map(([roomId, candidates]) => [roomId, rankRecapItems(candidates)] as const)
    .filter(([, items]) => items.length > 0);
  const titles = await courseTitles(rooms.map(([roomId]) => roomId));
  const run: RecapRun = { date, rooms: rooms.length, sent: 0, skipped: 0, failed: 0, deferred: 0, eves };

  for (const [roomId, items] of rooms) {
    if (Date.now() - started > ROOM_BUDGET_MS) {
      run.deferred += 1;
      continue;
    }
    try {
      if (!await claim(roomId, date)) {
        run.skipped += 1;
        continue;
      }
    } catch (error) {
      run.failed += 1;
      console.error("Could not claim the recap", { roomId, code: (error as { code?: string }).code });
      continue;
    }
    try {
      const messageId = await postRoomRecap(roomId, date, titles.get(roomId) ?? "your course", items);
      await finish(roomId, date, messageId, items.length);
      run.sent += 1;
    } catch (error) {
      await finish(roomId, date, null, items.length);
      run.failed += 1;
      console.error("Could not post the recap", { roomId, code: error instanceof NexconnError ? error.errorCode : undefined });
    }
  }
  return run;
}
