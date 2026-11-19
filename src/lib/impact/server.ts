import "server-only";

import { BOT_IDS } from "@/lib/nexconn/identities";
import { adminSupabase } from "@/lib/supabase/admin";
import { buildImpact, seriesStart, type Impact, type ImpactCounts } from "./aggregate";

const CACHE_MS = 60_000;
const PAGE_SIZE = 1000;
const MAX_PAGES = 20;
const TIMING_SAMPLE = 1000;
const NOT_DEMO = "demo\\_%";

type Db = ReturnType<typeof adminSupabase>;
type CountQuery = PromiseLike<{ count: number | null; error: unknown }>;
type PageQuery<T> = (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>;

let cached: { value: Impact; expiresAt: number } | null = null;
let inflight: Promise<Impact> | null = null;

async function count(query: CountQuery): Promise<number> {
  const { count: value, error } = await query;
  if (error) throw error;
  return value ?? 0;
}

/** PostgREST caps responses at 1,000 rows, so read in pages up to a fixed ceiling. */
async function readAll<T>(page: PageQuery<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let index = 0; index < MAX_PAGES; index += 1) {
    const { data, error } = await page(index * PAGE_SIZE, (index + 1) * PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

function realProfiles(db: Db) {
  return db.from("profiles").select("id", { count: "exact", head: true }).eq("is_try", false).neq("role", "bot");
}

async function readCounts(db: Db, now: Date): Promise<ImpactCounts> {
  const since = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const answers = () => db.from("answers").select("id", { count: "exact", head: true })
    .eq("author_kind", "ai").not("message_id", "is", null).not("room_id", "like", NOT_DEMO);

  const [users, onboarded, mentors, active24h, active7d, doubts, aiAnswers, verified, upvotes, dmsStarted, demoSessions] = await Promise.all([
    count(realProfiles(db)),
    count(realProfiles(db).not("onboarded_at", "is", null)),
    count(realProfiles(db).eq("role", "mentor")),
    count(realProfiles(db).gte("last_seen_at", since(24 * 60 * 60 * 1000))),
    count(realProfiles(db).gte("last_seen_at", since(7 * 24 * 60 * 60 * 1000))),
    count(db.from("doubts").select("id", { count: "exact", head: true }).not("room_id", "like", NOT_DEMO)),
    count(answers()),
    count(answers().not("verified_at", "is", null)),
    count(db.from("answer_votes").select("answer_id,answers!inner(room_id)", { count: "exact", head: true })
      .not("answers.room_id", "like", NOT_DEMO)),
    count(db.from("events").select("id", { count: "exact", head: true })
      .eq("name", "dm_started").neq("props->>peerId", BOT_IDS.DEMO_MENTOR)),
    count(db.from("profiles").select("id", { count: "exact", head: true }).eq("is_try", true)),
  ]);
  return { users, onboarded, mentors, active24h, active7d, doubts, aiAnswers, verified, upvotes, dmsStarted, demoSessions };
}

async function readRows(db: Db, now: Date) {
  const start = seriesStart(now);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [doubtRooms, messageRooms, answerTimings, verifyTimings, doubtDates, aiAnswerDates, verifiedDates] = await Promise.all([
    readAll<{ room_id: string }>((from, to) => db.from("doubts").select("room_id")
      .not("room_id", "like", NOT_DEMO).order("created_at", { ascending: false }).range(from, to)),
    readAll<{ room_id: string | null }>((from, to) => db.from("events").select("room_id:props->>roomId")
      .eq("name", "message_sent").gte("created_at", weekAgo).range(from, to)),
    db.from("doubts").select("created_at,ai_answered_at").not("ai_answered_at", "is", null)
      .not("room_id", "like", NOT_DEMO).order("created_at", { ascending: false }).limit(TIMING_SAMPLE),
    db.from("answers").select("created_at,verified_at").eq("author_kind", "ai").not("verified_at", "is", null)
      .not("room_id", "like", NOT_DEMO).order("verified_at", { ascending: false }).limit(TIMING_SAMPLE),
    readAll<{ created_at: string }>((from, to) => db.from("doubts").select("created_at")
      .not("room_id", "like", NOT_DEMO).gte("created_at", start).range(from, to)),
    readAll<{ created_at: string }>((from, to) => db.from("answers").select("created_at").eq("author_kind", "ai")
      .not("message_id", "is", null).not("room_id", "like", NOT_DEMO).gte("created_at", start).range(from, to)),
    readAll<{ verified_at: string }>((from, to) => db.from("answers").select("verified_at")
      .not("room_id", "like", NOT_DEMO).gte("verified_at", start).range(from, to)),
  ]);
  if (answerTimings.error) throw answerTimings.error;
  if (verifyTimings.error) throw verifyTimings.error;

  return {
    activeRoomIds: [...doubtRooms, ...messageRooms].flatMap(({ room_id }) => (room_id ? [room_id] : [])),
    answerTimings: answerTimings.data ?? [],
    verifyTimings: verifyTimings.data ?? [],
    doubtDates: doubtDates.map(({ created_at }) => created_at),
    aiAnswerDates: aiAnswerDates.map(({ created_at }) => created_at),
    verifiedDates: verifiedDates.map(({ verified_at }) => verified_at),
  };
}

async function computeImpact(): Promise<Impact> {
  const db = adminSupabase();
  const now = new Date();
  const [counts, rows] = await Promise.all([readCounts(db, now), readRows(db, now)]);
  return buildImpact(counts, rows, now);
}

/** Live impact numbers, cached for 60 s per server instance. Failures are not cached. */
export async function getImpact(): Promise<Impact> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  inflight ??= computeImpact().then((value) => {
    cached = { value, expiresAt: Date.now() + CACHE_MS };
    return value;
  }).finally(() => { inflight = null; });
  return inflight;
}

export const IMPACT_CACHE_SECONDS = CACHE_MS / 1000;
