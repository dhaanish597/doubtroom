import { notFound, redirect } from "next/navigation";

import { DirectChat } from "@/components/chat/DirectChat";
import { DmHeader, type DmPeer } from "@/components/dm/DmHeader";
import { getPageActor } from "@/lib/auth/actor";
import { canDirectMessage } from "@/lib/auth/sandbox";
import { BOT_IDS } from "@/lib/nexconn/identities";
import { roomsForActor } from "@/lib/rooms/server";
import { adminSupabase } from "@/lib/supabase/admin";

const chatId = /^[a-z0-9_]{1,64}$/;
const messageId = /^[A-Za-z0-9_-]{1,64}$/;

type PeerRow = { nexconn_user_id: string; display_name: string; avatar_url: string | null; role: string; dept: string | null; year: number | null };

async function findPeer(peerId: string): Promise<DmPeer | null> {
  // The demo senior is a server identity (role bot) that the sandbox presents as a mentor.
  const demo = peerId === BOT_IDS.DEMO_MENTOR;
  let query = adminSupabase().from("profiles")
    .select("nexconn_user_id,display_name,avatar_url,role,dept,year")
    .eq("nexconn_user_id", peerId).eq("is_try", false);
  if (!demo) query = query.neq("role", "bot");
  const { data, error } = await query.maybeSingle<PeerRow>();
  if (error) throw error;
  return data && {
    nexconnId: data.nexconn_user_id, name: data.display_name, avatar: data.avatar_url,
    role: demo ? "mentor" : data.role, dept: data.dept, year: data.year,
  };
}

export default async function DirectMessagePage({ params, searchParams }: {
  params: Promise<{ peerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getPageActor();
  if (!actor) redirect("/login");
  if (actor.kind === "user" && !actor.profile.onboarded_at) redirect("/onboarding");
  const { peerId } = await params;
  // Try visitors may only message the demo senior. Real students never reach bots or sandbox users.
  if (!canDirectMessage(actor.kind, actor.profile.nexconn_user_id, peerId)) notFound();
  const peer = await findPeer(peerId);
  if (!peer) notFound();

  const query = await searchParams;
  const roomId = typeof query.room === "string" && chatId.test(query.room) ? query.room : null;
  const doubtMessageId = typeof query.doubt === "string" && messageId.test(query.doubt) ? query.doubt : null;
  const [room] = roomId && doubtMessageId ? await roomsForActor(actor, roomId) : [];
  const doubt = room && doubtMessageId ? { roomId: room.id, roomTitle: room.title, doubtMessageId } : undefined;

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <DmHeader peer={peer} />
      <DirectChat key={peer.nexconnId} peerId={peer.nexconnId} peerName={peer.name} doubt={doubt} />
    </main>
  );
}
