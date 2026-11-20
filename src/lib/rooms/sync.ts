import "server-only";

import catalog from "../../../data/catalog.json";
import { NexconnError, ensureGroup, groups, joinGroup, listGroupMemberIds, request } from "@/lib/nexconn/server";
import { adminSupabase } from "@/lib/supabase/admin";
import {
  JOIN_BATCH_SIZE, catalogCourses, catalogRooms, chunk, missingMembers, type SyncResult,
} from "./sync-plan";

type MemberRow = { room_id: string; profiles: { nexconn_user_id: string; is_try: boolean; role: string } | null };
const PAGE = 1000;
const GROUP_LOOKUP_BATCH = 20;

async function existingGroupIds(ids: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (const batch of chunk(ids, GROUP_LOOKUP_BATCH)) {
    try {
      const data = await request("look up the groups", () => groups.batchGetGroupChannelProfiles({ channelIds: batch }));
      for (const profile of data.result?.profiles ?? []) if (profile.channelId) found.add(profile.channelId);
    } catch (error) {
      // An unknown group reports not-found for the whole batch; ensureGroup below decides per room.
      if (!(error instanceof NexconnError)) throw error;
    }
  }
  return found;
}

/** Real (non-try, non-bot) members of catalog rooms, by room. Demo rooms are never read. */
async function wantedMembers(roomIds: string[]): Promise<Map<string, string[]>> {
  const byRoom = new Map<string, string[]>();
  const db = adminSupabase();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from("room_members")
      .select("room_id,profiles!inner(nexconn_user_id,is_try,role)")
      .in("room_id", roomIds).eq("profiles.is_try", false).neq("profiles.role", "bot")
      .order("room_id").order("profile_id").range(from, from + PAGE - 1).returns<MemberRow[]>();
    if (error) throw error;
    for (const { room_id, profiles } of data) {
      if (profiles) byRoom.set(room_id, [...(byRoom.get(room_id) ?? []), profiles.nexconn_user_id]);
    }
    if (data.length < PAGE) return byRoom;
  }
}

/**
 * Idempotently upserts the catalog's courses and subject + section rooms, makes sure each Nexconn
 * group exists (owner bot_ta), then joins members whose Nexconn membership is missing.
 * `created` counts groups newly created, `joined` counts users newly joined, `deferred` counts
 * rooms left for another run when `deadline` (epoch ms) passes.
 */
export async function syncCatalogRooms(
  options: { deadline?: number; ownerRegistered?: boolean; syncMembers?: boolean } = {},
): Promise<SyncResult> {
  const { deadline = Infinity, ownerRegistered = false, syncMembers = true } = options;
  const expired = () => Date.now() >= deadline;
  const rooms = catalogRooms(catalog);

  const db = adminSupabase();
  const { error } = await db.from("courses").upsert(catalogCourses(catalog));
  if (error) throw error;
  const { error: roomError } = await db.from("rooms").upsert(rooms);
  if (roomError) throw roomError;

  const known = await existingGroupIds(rooms.map(({ id }) => id));
  const missing = rooms.filter(({ id }) => !known.has(id));
  let created = 0;
  for (const room of missing) {
    if (expired()) return { created, joined: 0, deferred: missing.length - created + (syncMembers ? rooms.length : 0) };
    await ensureGroup(room.id, Array.from(room.title).slice(0, 64).join(""), ownerRegistered);
    created += 1;
  }
  if (!syncMembers) return { created, joined: 0, deferred: 0 };

  const wanted = await wantedMembers(rooms.map(({ id }) => id));
  let joined = 0;
  let done = 0;
  for (const [roomId, ids] of wanted) {
    if (expired()) break;
    const todo = missingMembers(ids, await listGroupMemberIds(roomId));
    for (const batch of chunk(todo, JOIN_BATCH_SIZE)) {
      await joinGroup(roomId, batch);
      joined += batch.length;
    }
    done += 1;
  }
  return { created, joined, deferred: wanted.size - done };
}
