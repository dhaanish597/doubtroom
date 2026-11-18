import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main role="status" aria-label="Loading DoubtRoom" className="mx-auto w-full max-w-2xl space-y-3 px-4 py-7 sm:px-6">
      <Skeleton className="mb-5 h-9 w-44" />
      <Skeleton className="h-21 w-full" />
      <Skeleton className="h-21 w-full" />
    </main>
  );
}
