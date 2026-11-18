import { RoomList } from "@/components/rooms/RoomList";

export default function RoomsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-7 sm:px-6">
      <h1 className="mb-5 text-3xl font-semibold tracking-tight">Your rooms</h1>
      <RoomList />
    </main>
  );
}
