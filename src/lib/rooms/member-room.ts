import "server-only";

import type { Actor } from "@/lib/auth/actor";
import { adminSupabase } from "@/lib/supabase/admin";

export async function memberRoom(actor: Actor, roomId: unknown) {
  if (typeof roomId !== "string" || !/^[a-z0-9_]{1,64}$/.test(roomId)) return null;
  if (actor.kind === "try" && !roomId.startsWith("demo_")) return null;

  const { data, error } = await adminSupabase().from("room_members")
    .select("rooms!inner(id,title,kind,course_code,courses(title,units))")
    .eq("profile_id", actor.profile.id).eq("room_id", roomId)
    .maybeSingle<{
      rooms: { id: string; title: string; kind: string; course_code: string | null;
        courses: { title: string; units: string[] } | null };
    }>();
  if (error) throw error;
  const room = data?.rooms;
  return room && (actor.kind !== "try" || room.kind === "demo") ? room : null;
}
