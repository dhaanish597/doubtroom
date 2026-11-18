import Link from "next/link";

export default function Home() {
  return (
    <main className="grid min-h-dvh place-items-center bg-primary px-6 py-16 text-primary-foreground sm:px-12">
      <div className="w-full max-w-4xl">
        <div aria-hidden="true" className="mb-8 h-1.5 w-12 rounded-full bg-accent" />
        <h1 className="text-5xl font-semibold tracking-tight sm:text-7xl">
          DoubtRoom
        </h1>
        <p className="mt-5 max-w-2xl text-xl leading-relaxed text-primary-foreground/90 sm:text-3xl">
          Exam doubts answered in seconds, verified by seniors.
        </p>
        <Link href="/login" className="mt-8 inline-flex min-h-12 items-center rounded-xl bg-primary-foreground px-5 font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-foreground">
          Sign in with Google
        </Link>
      </div>
    </main>
  );
}
