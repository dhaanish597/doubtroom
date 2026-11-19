import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { redirect } from "next/navigation";
import { getPageActor } from "@/lib/auth/actor";
import { catalogCourses, onboardingCatalog } from "@/lib/onboarding/catalog";
import { OnboardingForm } from "./onboarding-form";

export default function OnboardingPage() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-8 sm:py-14">
      <p className="font-semibold text-primary">DoubtRoom</p>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight">Set up your rooms</h1>
      <Suspense fallback={<Skeleton role="status" aria-label="Loading onboarding" className="mt-6 h-60 rounded-2xl" />}>
        <AuthenticatedOnboarding />
      </Suspense>
    </main>
  );
}

async function AuthenticatedOnboarding() {
  const actor = await getPageActor();
  if (actor?.kind !== "user") redirect("/login");
  if (actor.profile.onboarded_at) redirect("/app");
  const pending = actor.profile.pending_onboarding;

  return (
    <OnboardingForm
      catalog={onboardingCatalog}
      courses={catalogCourses}
      pending={pending ? { dept: pending.dept, year: pending.year, section: pending.section } : null}
    />
  );
}
