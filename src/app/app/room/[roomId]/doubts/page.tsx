import { DoubtBoard } from "@/components/doubts/DoubtBoard";
import { RoomHeader } from "@/components/rooms/RoomHeader";
import { requireRoom } from "@/lib/rooms/server";

export default async function DoubtsPage({ params }: { params: Promise<{ roomId: string }> }) {
  const room = await requireRoom((await params).roomId);
  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <RoomHeader room={room} tab="doubts" />
      <section aria-labelledby="doubt-board" className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 sm:px-5">
        <h2 id="doubt-board" className="sr-only">Doubt board</h2>
        <DoubtBoard roomId={room.id} />
      </section>
    </main>
  );
}
