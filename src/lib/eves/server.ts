import "server-only";

import type { Actor } from "@/lib/auth/actor";
import { examEveIdFor, roomIdFor } from "@/lib/nexconn/ids";
import { NexconnError, createOpenChannel, openChannelParticipantCount } from "@/lib/nexconn/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { addDays, eveDateKey, eveScheduleProblem, eveWindowForExam, istDate, ttlMinutesUntil, type EveWindow } from "./time";
import type { EveSummary } from "./types";

export class EveError extends Error {
  constructor(
    public readonly code: "COURSE_NOT_FOUND" | "ROOM_NOT_FOUND" | "EVE_EXISTS" | "INVALID_WINDOW" | "CHANNEL_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "EveError";
  }
}

type CourseRow = { code: string; title: string; dept: string; year: number };
type EveRow = {
  id: string; course_code: string | null; room_id: string | null; opens_at: string; closes_at: string;
  courses: { title: string } | null;
};

export function isAdminActor(actor: Actor | null): actor is Actor {
  return actor?.kind === "user" && actor.profile.role === "admin" && !actor.profile.is_try;
}

/**
 * Creates the Nexconn open channel first, then the database row, so a stored Eve always has a
 * channel. The channel destroys itself at closes_at (fixed-time destroy).
 */
export async function createEve(courseCode: string, window: EveWindow, now = new Date()) {
  const problem = eveScheduleProblem(window, now);
  if (problem) throw new EveError("INVALID_WINDOW", problem);
  const db = adminSupabase();
  const course = await db.from("courses").select("code,title,dept,year").eq("code", courseCode).maybeSingle<CourseRow>();
  if (course.error) throw course.error;
  if (!course.data) throw new EveError("COURSE_NOT_FOUND", "Course not found");

  const roomId = roomIdFor(course.data.code, course.data.dept, course.data.year);
  const room = await db.from("rooms").select("id").eq("id", roomId).maybeSingle();
  if (room.error) throw room.error;
  if (!room.data) throw new EveError("ROOM_NOT_FOUND", "The room for this course is not set up yet");

  const eveId = examEveIdFor(course.data.code, eveDateKey(window.closesAt));
  const existing = await db.from("exam_eves").select("id").eq("id", eveId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) throw new EveError("EVE_EXISTS", "An Exam Eve already exists for this course that night");

  const ttl = ttlMinutesUntil(window.closesAt, now);
  if (ttl === null) throw new EveError("INVALID_WINDOW", "too_far");
  try {
    await createOpenChannel(eveId, ttl);
  } catch (error) {
    console.error("Could not create the Exam Eve channel", {
      eveId, code: error instanceof NexconnError ? error.errorCode : undefined,
    });
    throw new EveError("CHANNEL_FAILED", "Nexconn could not create the Eve");
  }

  const inserted = await db.from("exam_eves").insert({
    id: eveId, course_code: course.data.code, room_id: roomId,
    opens_at: window.opensAt.toISOString(), closes_at: window.closesAt.toISOString(),
  });
  if (inserted.error && inserted.error.code !== "23505") throw inserted.error;
  return { eveId, roomId, ttlMinutes: ttl };
}

/** Eves for every paper whose exam_date is tomorrow (IST). Existing Eves are skipped. */
export async function createTomorrowEves(now = new Date()) {
  const examDate = addDays(istDate(now), 1);
  const { data, error } = await adminSupabase().from("courses").select("code").eq("exam_date", examDate)
    .returns<{ code: string }[]>();
  if (error) throw error;
  const outcome = { created: 0, skipped: 0, failed: 0 };
  for (const { code } of data) {
    try {
      await createEve(code, eveWindowForExam(examDate), now);
      outcome.created += 1;
    } catch (failure) {
      if (failure instanceof EveError && (failure.code === "EVE_EXISTS" || failure.code === "ROOM_NOT_FOUND")) {
        outcome.skipped += 1;
      } else {
        outcome.failed += 1;
        console.error("Could not create tomorrow's Exam Eve", { code, reason: failure instanceof EveError ? failure.code : "error" });
      }
    }
  }
  return outcome;
}

/** The Eve if the actor may enter it: signed-in members of the subject room, and admins. Never try visitors. */
export async function eveForActor(actor: Actor, eveId: string): Promise<EveSummary | null> {
  if (actor.kind !== "user" || actor.profile.is_try || !/^eve_[a-z0-9]+_\d{8}$/.test(eveId)) return null;
  const db = adminSupabase();
  const { data, error } = await db.from("exam_eves")
    .select("id,course_code,room_id,opens_at,closes_at,courses(title)").eq("id", eveId).maybeSingle<EveRow>();
  if (error) throw error;
  if (!data?.room_id) return null;
  if (actor.profile.role !== "admin") {
    const member = await db.from("room_members").select("room_id")
      .eq("room_id", data.room_id).eq("profile_id", actor.profile.id).maybeSingle();
    if (member.error) throw member.error;
    if (!member.data) return null;
  }
  return {
    id: data.id, roomId: data.room_id, courseCode: data.course_code, title: data.courses?.title ?? data.course_code ?? "Exam Eve",
    opensAt: data.opens_at, closesAt: data.closes_at,
  };
}

const COUNT_TTL_MS = 30_000;
const counts = new Map<string, { value: number | null; expires: number }>();

/** Participant count from Nexconn, cached for 30 seconds per server instance. Null when unavailable. */
export async function eveParticipantCount(eveId: string): Promise<number | null> {
  const cached = counts.get(eveId);
  if (cached && cached.expires > Date.now()) return cached.value;
  try {
    const value = await openChannelParticipantCount(eveId);
    counts.set(eveId, { value, expires: Date.now() + COUNT_TTL_MS });
    if (counts.size > 500) counts.delete(counts.keys().next().value as string);
    return value;
  } catch (error) {
    console.warn("Could not read the Exam Eve participant count", { code: error instanceof NexconnError ? error.errorCode : undefined });
    return null;
  }
}
