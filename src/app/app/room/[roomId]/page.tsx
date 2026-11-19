import { GroupChat } from "@/components/chat/GroupChat";
import { RoomProvider } from "@/components/rooms/RoomContext";
import { RoomHeader } from "@/components/rooms/RoomHeader";
import { requireRoom } from "@/lib/rooms/server";

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const room = await requireRoom((await params).roomId);

  return (
    <main data-room-chat className="flex min-h-0 flex-1 flex-col">
      <RoomHeader room={room} tab="chat" />
      <RoomProvider value={{ roomId: room.id, title: room.title, courseCode: room.courseCode }}>
        <GroupChat key={room.id} roomId={room.id} title={room.title} initialUnits={room.units} />
      </RoomProvider>
    </main>
  );
}
