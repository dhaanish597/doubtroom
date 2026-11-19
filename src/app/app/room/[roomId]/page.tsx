import { GroupChat } from "@/components/chat/GroupChat";
import { EveBanner } from "@/components/rooms/EveBanner";
import { RoomProvider } from "@/components/rooms/RoomContext";
import { PinnedAnnouncement } from "@/components/rooms/PinnedAnnouncement";
import { RoomHeader } from "@/components/rooms/RoomHeader";
import { viewerRoomState } from "@/lib/answers/server";
import { getPageActor } from "@/lib/auth/actor";
import { viewerModeration } from "@/lib/moderation/server";
import { requireRoom } from "@/lib/rooms/server";

const messageIdPattern = /^[A-Za-z0-9_-]{1,64}$/;

export default async function RoomPage({ params, searchParams }: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const room = await requireRoom((await params).roomId);
  const actor = await getPageActor();
  const viewer = actor
    ? await viewerRoomState(actor, room).catch(() => {
      console.warn("Could not load answer state for the room");
      return { canVerify: false, votedAnswerIds: [] };
    })
    : { canVerify: false, votedAnswerIds: [] };
  const moderation = actor
    ? await viewerModeration(actor, room).catch(() => {
      console.warn("Could not load moderation state for the room");
      return undefined;
    })
    : undefined;
  const { m } = await searchParams;
  const focusMessageId = typeof m === "string" && messageIdPattern.test(m) ? m : undefined;

  return (
    <main data-room-chat className="flex min-h-0 flex-1 flex-col">
      <RoomHeader room={room} tab="chat" />
      {room.eve && <EveBanner eve={room.eve} />}
      <RoomProvider value={{ roomId: room.id, title: room.title, courseCode: room.courseCode, ...viewer,
        kind: room.kind, memberCount: room.memberCount, moderation }}>
        <PinnedAnnouncement />
        <GroupChat key={room.id} roomId={room.id} title={room.title} initialUnits={room.units} focusMessageId={focusMessageId} />
      </RoomProvider>
    </main>
  );
}
