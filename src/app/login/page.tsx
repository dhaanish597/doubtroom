import Link from "next/link";
import { Suspense } from "react";
import { MessagesSquare } from "lucide-react";
import { GoogleSignIn } from "./sign-in";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-muted/60 px-4 py-8">
      <section className="w-full max-w-sm rounded-3xl border bg-card p-6 shadow-sm sm:p-8" aria-labelledby="login-heading">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold text-primary">
          <MessagesSquare aria-hidden="true" className="size-5" />
          DoubtRoom
        </Link>
        <h1 id="login-heading" className="mt-8 text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Use your Google account to access your class and subject rooms.</p>
        <Suspense fallback={<p role="status" className="mt-7 text-sm text-muted-foreground">Loading sign-in…</p>}>
          <LoginAction searchParams={searchParams} />
        </Suspense>
      </section>
    </main>
  );
}

async function LoginAction({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <GoogleSignIn failed={error === "oauth"} />;
}
