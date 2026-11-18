import "server-only";

import { ensureGroup } from "@/lib/nexconn/server";
import { adminSupabase } from "@/lib/supabase/admin";
import type { RoomDefinition } from "./definitions";

export async function provisionRooms(rooms: RoomDefinition[], ownerRegistered = false) {
  if (!rooms.length) return;
  const { error } = await adminSupabase().from("rooms").upsert(rooms);
  if (error) throw error;
  for (const room of rooms) await ensureGroup(room.id, Array.from(room.title).slice(0, 64).join(""), ownerRegistered);
}
