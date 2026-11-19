import { DirectList } from "@/components/dm/DirectList";
import { LiveEveBanners } from "@/components/rooms/EveBanner";
import { RoomList } from "@/components/rooms/RoomList";

export default function RoomsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-7 sm:px-6">
      <h1 className="mb-5 text-3xl font-semibold tracking-tight">Your rooms</h1>
      <LiveEveBanners />
      <RoomList />
      <section aria-labelledby="direct-messages" className="mt-9">
        <h2 id="direct-messages" className="mb-4 text-xl font-semibold tracking-tight">Direct messages</h2>
        <DirectList />
      </section>
    </main>
  );
}
