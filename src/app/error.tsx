"use client";

import { Button } from "@/components/ui/button";

export default function PageError({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-lg px-5 py-16">
      <h1 className="text-2xl font-semibold">This page couldn’t load</h1>
      <p className="my-4 text-muted-foreground">Check your connection and try again.</p>
      <Button type="button" onClick={retry}>Try again</Button>
    </main>
  );
}
