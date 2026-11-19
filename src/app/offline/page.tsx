import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "Offline · DoubtRoom" };

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-muted/45 px-6">
      <div className="max-w-sm text-center">
        <WifiOff aria-hidden="true" className="mx-auto size-10 text-primary" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">You’re offline</h1>
        <p className="mt-2 text-muted-foreground">DoubtRoom needs a connection to load your rooms. Reconnect and pull to refresh.</p>
        <Link href="/app" prefetch={false} className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground">Try again</Link>
      </div>
    </main>
  );
}
