import "server-only";

import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { getPageActor, type Actor } from "@/lib/auth/actor";
import { canUseRoom } from "@/lib/auth/sandbox";
import { adminSupabase } from "@/lib/supabase/admin";
import type { Room } from "./types";

type RoomRow = {
  id: string;
  title: string;
  kind: Room["kind"];
  course_code: string | null;
  courses: { units: string[] } | null;
  room_members: { count: number }[];
  exam_eves: { id: string; opens_at: string; closes_at: string }[];
};

export async function roomsForActor(actor: Actor, roomId?: string): Promise<Room[]> {
  if (roomId && !canUseRoom(actor.kind, roomId)) return [];
  await connection();
  const now = new Date().toISOString();
  const db = adminSupabase();
  let membership = db.from("room_members").select("room_id").eq("profile_id", actor.profile.id);
  if (roomId) membership = membership.eq("room_id", roomId);
  if (actor.kind === "try") membership = membership.like("room_id", "demo\\_%");
  const member = await membership;
  if (member.error) throw member.error;

  const ids = member.data.map(({ room_id }) => room_id).filter((id) => canUseRoom(actor.kind, id));
  if (!ids.length) return [];

  const result = await db.from("rooms")
    .select("id,title,kind,course_code,courses(units),room_members(count),exam_eves(id,opens_at,closes_at)")
    .in("id", ids)
    .lte("exam_eves.opens_at", now)
    .gt("exam_eves.closes_at", now)
    .order("opens_at", { referencedTable: "exam_eves", ascending: false })
    .limit(1, { referencedTable: "exam_eves" })
    .order("kind").order("title").returns<RoomRow[]>();
  if (result.error) throw result.error;

  return result.data.filter((room) => canUseRoom(actor.kind, room.id, room.kind)).map((room) => {
    const eve = room.exam_eves[0];
    return {
      id: room.id,
      title: room.title,
      kind: room.kind,
      courseCode: room.course_code,
      units: room.courses?.units ?? [],
      memberCount: room.room_members[0]?.count ?? 0,
      ...(eve ? { eve: { id: eve.id, opensAt: eve.opens_at, closesAt: eve.closes_at } } : {}),
    };
  });
}

export async function requireRoom(roomId: string) {
  const actor = await getPageActor();
  if (!actor) redirect("/login");
  if (actor.kind === "user" && !actor.profile.onboarded_at) redirect("/onboarding");
  if (!/^[a-z0-9_]{1,64}$/.test(roomId)) notFound();
  const [room] = await roomsForActor(actor, roomId);
  if (!room) notFound();
  return room;
}
