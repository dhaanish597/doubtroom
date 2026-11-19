import { RoomHeader } from "@/components/rooms/RoomHeader";
import { requireRoom } from "@/lib/rooms/server";

export default async function DoubtsPage({ params }: { params: Promise<{ roomId: string }> }) {
  const room = await requireRoom((await params).roomId);
  return (
    <main>
      <RoomHeader room={room} tab="doubts" />
      <section className="mx-auto max-w-3xl px-4 py-9 sm:px-5">
        <h2 className="text-xl font-semibold">Doubts</h2>
        <p className="mt-2 text-sm text-muted-foreground">The doubt board is coming soon. You can ask in Chat now.</p>
      </section>
    </main>
  );
}
