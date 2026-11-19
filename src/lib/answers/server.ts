import "server-only";

import type { Actor } from "@/lib/auth/actor";
import { BOT_IDS } from "@/lib/nexconn/ids";
import { NexconnError, setMessageMetadata } from "@/lib/nexconn/server";
import { adminSupabase } from "@/lib/supabase/admin";
import {
  BOARD_TABS, answerPreview, boardTab, canVerifyAnswers, pickBoardAnswer, statusesForTab, verifierLabel,
  type BoardTab, type DoubtStatus,
} from "./rules";
import type { BoardDoubt, InboxDoubt, ViewerRoomState } from "./types";

const BOARD_LIMIT = 100;
const INBOX_LIMIT = 50;
const VOTED_LIMIT = 500;

type SeniorRow = { display_name: string; dept: string | null; year: number | null } | null;
type AnswerRow = {
  id: string; message_id: string | null; author_kind: "ai" | "mentor"; body_md: string; upvotes: number;
  verified_at: string | null; created_at: string; verifier: SeniorRow; author: SeniorRow;
};
type DoubtRow = {
  id: string; room_id: string; message_id: string | null; text: string; unit: string | null; image_url: string | null;
  status: DoubtStatus; created_at: string;
  asker: { nexconn_user_id: string; display_name: string } | null;
  answers: AnswerRow[];
};

const doubtColumns = "id,room_id,message_id,text,unit,image_url,status,created_at,"
  + "asker:profiles(nexconn_user_id,display_name),"
  + "answers(id,message_id,author_kind,body_md,upvotes,verified_at,created_at,"
  + "verifier:profiles!answers_verified_by_fkey(display_name,dept,year),"
  + "author:profiles!answers_author_id_fkey(display_name,dept,year))";

function seniorLabel(row: SeniorRow) {
  return row ? verifierLabel(row.display_name, row.year, row.dept) : null;
}

function toBoardDoubt(row: DoubtRow): BoardDoubt {
  const best = pickBoardAnswer(row.answers.map((answer) => ({
    ...answer, authorKind: answer.author_kind, verifiedAt: answer.verified_at, createdAt: answer.created_at,
  })));
  return {
    id: row.id, roomId: row.room_id, messageId: row.message_id, text: row.text || "Photo doubt",
    unit: row.unit, hasPhoto: Boolean(row.image_url), status: row.status, tab: boardTab(row.status),
    createdAt: row.created_at,
    asker: row.asker ? { nexconnId: row.asker.nexconn_user_id, name: row.asker.display_name } : null,
    answer: best && {
      id: best.id, messageId: best.message_id, authorKind: best.author_kind,
      seniorLabel: seniorLabel(best.author_kind === "mentor" ? best.author : best.verifier),
      preview: answerPreview(best.body_md), upvotes: best.upvotes, verifiedAt: best.verified_at,
    },
  };
}

export async function mentorCourses(profileId: string): Promise<string[]> {
  const { data, error } = await adminSupabase().from("mentor_subjects").select("course_code").eq("profile_id", profileId);
  if (error) throw error;
  return data.map(({ course_code }) => course_code as string);
}

/** Whether the actor may verify answers and post senior answers in a room they belong to. */
export async function canActorVerify(actor: Actor, room: { courseCode: string | null; isMember: boolean }) {
  const { role, is_try } = actor.profile;
  if (is_try || (role !== "mentor" && role !== "admin")) return false;
  const courses = role === "mentor" ? await mentorCourses(actor.profile.id) : [];
  return canVerifyAnswers({ role, is_try }, room, courses);
}

export async function viewerRoomState(actor: Actor, room: { id: string; courseCode: string | null }): Promise<ViewerRoomState> {
  const [canVerify, votes] = await Promise.all([
    canActorVerify(actor, { courseCode: room.courseCode, isMember: true }),
    adminSupabase().from("answer_votes").select("answer_id,answers!inner(room_id)")
      .eq("profile_id", actor.profile.id).eq("answers.room_id", room.id)
      .order("created_at", { ascending: false }).limit(VOTED_LIMIT),
  ]);
  if (votes.error) throw votes.error;
  return { canVerify, votedAnswerIds: votes.data.map(({ answer_id }) => answer_id as string) };
}

export type StoredAnswer = {
  id: string; doubt_id: string | null; room_id: string; message_id: string | null; author_kind: "ai" | "mentor";
  verified_by: string | null; verified_at: string | null;
  doubts: { id: string; message_id: string | null; asker: { nexconn_user_id: string } | null } | null;
};

export async function loadAnswer(answerId: string): Promise<StoredAnswer | null> {
  const { data, error } = await adminSupabase().from("answers")
    .select("id,doubt_id,room_id,message_id,author_kind,verified_by,verified_at,"
      + "doubts(id,message_id,asker:profiles(nexconn_user_id))")
    .eq("id", answerId).maybeSingle<StoredAnswer>();
  if (error) throw error;
  return data;
}

/**
 * Writes group message metadata as the first writer Nexconn accepts. Nexconn may not send the
 * update event to the writer itself (D-007), so callers list the least affected writer first.
 */
export async function writeGroupMetadata(roomId: string, messageId: string, writers: string[],
  metadata: Record<string, string>, label: string) {
  for (const userId of [...new Set(writers.filter(Boolean))]) {
    try {
      await setMessageMetadata(3, roomId, messageId, userId, metadata);
      return true;
    } catch (error) {
      console.warn(`${label} metadata update failed`, {
        writer: userId === BOT_IDS.TA ? "bot" : "user",
        code: error instanceof NexconnError ? error.errorCode : undefined,
      });
    }
  }
  return false;
}

export async function roomDoubts(roomId: string, tab?: BoardTab) {
  const db = adminSupabase();
  let list = db.from("doubts").select(doubtColumns).eq("room_id", roomId);
  if (tab) list = list.in("status", statusesForTab(tab));
  const counts = BOARD_TABS.map((name) => db.from("doubts").select("id", { count: "exact", head: true })
    .eq("room_id", roomId).in("status", statusesForTab(name)));
  const [rows, ...totals] = await Promise.all([
    list.order("created_at", { ascending: false }).limit(BOARD_LIMIT).returns<DoubtRow[]>(),
    ...counts,
  ]);
  if (rows.error) throw rows.error;
  const tabCounts = { open: 0, ai: 0, verified: 0 } as Record<BoardTab, number>;
  totals.forEach((result, index) => {
    if (result.error) throw result.error;
    tabCounts[BOARD_TABS[index]] = result.count ?? 0;
  });
  return { doubts: rows.data.map(toBoardDoubt), counts: tabCounts };
}

/** AI-answered doubts awaiting a senior, in the actor's subjects and rooms, oldest first. */
export async function mentorInbox(actor: Actor): Promise<{ doubts: InboxDoubt[]; count: number }> {
  const courses = await mentorCourses(actor.profile.id);
  if (!courses.length) return { doubts: [], count: 0 };

  const db = adminSupabase();
  const memberships = await db.from("room_members").select("rooms!inner(id,title,course_code)")
    .eq("profile_id", actor.profile.id).in("rooms.course_code", courses)
    .returns<{ rooms: { id: string; title: string; course_code: string | null } }[]>();
  if (memberships.error) throw memberships.error;
  const rooms = new Map(memberships.data.map(({ rooms: room }) => [room.id, room]));
  if (!rooms.size) return { doubts: [], count: 0 };

  const ids = [...rooms.keys()];
  const [rows, total] = await Promise.all([
    db.from("doubts").select(doubtColumns).in("room_id", ids).eq("status", "ai_answered")
      .order("created_at", { ascending: true }).limit(INBOX_LIMIT).returns<DoubtRow[]>(),
    db.from("doubts").select("id", { count: "exact", head: true }).in("room_id", ids).eq("status", "ai_answered"),
  ]);
  if (rows.error) throw rows.error;
  if (total.error) throw total.error;
  return {
    doubts: rows.data.map((row) => {
      const room = rooms.get(row.room_id);
      return { ...toBoardDoubt(row), roomTitle: room?.title ?? "Room", courseCode: room?.course_code ?? null };
    }),
    count: total.count ?? rows.data.length,
  };
}
