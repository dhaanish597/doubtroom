import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";

import { getPageActor } from "@/lib/auth/actor";
import { NexconnProvider } from "@/lib/nexconn/provider";
import { AppNav } from "./nav";
import Loading from "./loading";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Loading />}><AuthenticatedApp>{children}</AuthenticatedApp></Suspense>;
}

async function AuthenticatedApp({ children }: { children: ReactNode }) {
  const actor = await getPageActor();
  if (!actor) redirect("/login");
  if (actor.kind === "user" && !actor.profile.onboarded_at) redirect("/onboarding");

  return (
    <div className="flex min-h-dvh flex-col">
      <NexconnProvider>
        <div className="flex-1">{children}</div>
        <AppNav mentor={actor.profile.role === "mentor"} />
      </NexconnProvider>
    </div>
  );
}
