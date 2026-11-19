import { notFound, redirect } from "next/navigation";

import { DirectChat } from "@/components/chat/DirectChat";
import { DmHeader, type DmPeer } from "@/components/dm/DmHeader";
import { getPageActor } from "@/lib/auth/actor";
import { roomsForActor } from "@/lib/rooms/server";
import { adminSupabase } from "@/lib/supabase/admin";

const chatId = /^[a-z0-9_]{1,64}$/;
const messageId = /^[A-Za-z0-9_-]{1,64}$/;

type PeerRow = { nexconn_user_id: string; display_name: string; avatar_url: string | null; role: string; dept: string | null; year: number | null };

async function findPeer(peerId: string): Promise<DmPeer | null> {
  const { data, error } = await adminSupabase().from("profiles")
    .select("nexconn_user_id,display_name,avatar_url,role,dept,year")
    .eq("nexconn_user_id", peerId).eq("is_try", false).neq("role", "bot")
    .maybeSingle<PeerRow>();
  if (error) throw error;
  return data && {
    nexconnId: data.nexconn_user_id, name: data.display_name, avatar: data.avatar_url,
    role: data.role, dept: data.dept, year: data.year,
  };
}

/** A senior opening a DM from the inbox quotes the student's doubt, not their own. */
async function askedByActor(roomId: string, doubtMessageId: string, profileId: string) {
  const { data, error } = await adminSupabase().from("doubts").select("asker_id")
    .eq("room_id", roomId).eq("message_id", doubtMessageId).maybeSingle<{ asker_id: string }>();
  if (error) {
    // The wording of a prefill is not worth failing the page over.
    console.warn("Could not look up the doubt asker", { code: error.code });
    return true;
  }
  return !data || data.asker_id === profileId;
}

export default async function DirectMessagePage({ params, searchParams }: {
  params: Promise<{ peerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getPageActor();
  if (!actor) redirect("/login");
  if (actor.kind === "user" && !actor.profile.onboarded_at) redirect("/onboarding");
  // Try visitors message the demo mentor from Phase 9.
  if (actor.kind === "try") notFound();

  const { peerId } = await params;
  if (!chatId.test(peerId) || peerId === actor.profile.nexconn_user_id) notFound();
  const peer = await findPeer(peerId);
  if (!peer) notFound();

  const query = await searchParams;
  const roomId = typeof query.room === "string" && chatId.test(query.room) ? query.room : null;
  const doubtMessageId = typeof query.doubt === "string" && messageId.test(query.doubt) ? query.doubt : null;
  const [room] = roomId && doubtMessageId ? await roomsForActor(actor, roomId) : [];
  const doubt = room && doubtMessageId
    ? { roomId: room.id, roomTitle: room.title, doubtMessageId, own: await askedByActor(room.id, doubtMessageId, actor.profile.id) }
    : undefined;

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <DmHeader peer={peer} />
      <DirectChat key={peer.nexconnId} peerId={peer.nexconnId} peerName={peer.name} doubt={doubt} />
    </main>
  );
}
