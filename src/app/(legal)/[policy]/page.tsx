import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const policies = {
  privacy: {
    title: "Privacy Policy",
    content: (
      <>
        <p>{"DoubtRoom is a study-room service for students to ask questions about their courses and learn with their classmates."}</p>
        <h2 className="pt-4 text-xl font-semibold">{"Information we use"}</h2>
        <p>{"When you sign in with Google, DoubtRoom receives your name, email address, profile picture and an account identifier. We use these to sign you in, maintain your account and show your name and picture in rooms you join. We use the college and class information you provide during setup to assign subject rooms. Sign-in uses cookies to keep your session active."}</p>
        <p>{"DoubtRoom stores messages and photos you send so room members can read them. Other people in the room can see what you post and may make their own copies. Keep passwords, grades, student identification numbers and other private information out of messages and images."}</p>
        <h2 className="pt-4 text-xl font-semibold">{"Services that process data"}</h2>
        <p>{"Google handles sign-in. Supabase processes authentication and stores account and room records. Nexconn carries chat messages and shared media. Vercel hosts the web app and processes web requests. When product analytics are enabled, PostHog processes usage events such as room visits and message sends to help us understand how DoubtRoom is used."}</p>
        <p>{"If you use an AI answer feature, the question and any relevant text or image may be sent to a configured AI provider, such as Google Gemini or Groq, to generate a response. AI features may vary by room or release."}</p>
        <h2 className="pt-4 text-xl font-semibold">{"Your choices"}</h2>
        <p>{"You can stop future Google sign-in access in your Google Account settings. For questions about your data or requests to access, correct or delete it, email clashanimations597@gmail.com. We may ask you to verify your account before acting on a request. Deleting account data cannot remove copies other room members have made."}</p>
      </>
    ),
  },
  terms: {
    title: "Terms of Service",
    content: (
      <>
        <p>{"DoubtRoom is an exam-study aid. Course discussion, peer replies and AI answers can contain mistakes. Check important information against your course materials and your college’s instructions."}</p>
        <h2 className="pt-4 text-xl font-semibold">{"Using DoubtRoom"}</h2>
        <p>{"Use your own account and provide accurate class details. Keep posts relevant to your study room. Share only material you have permission to share. Do not post another person’s private information, harass others, spam rooms, impersonate anyone or try to access rooms or accounts without permission. Follow your college’s academic integrity rules, including rules about using assistance during assessments."}</p>
        <h2 className="pt-4 text-xl font-semibold">{"Room content and availability"}</h2>
        <p>{"When you post a message or photo, you allow DoubtRoom to store and display it to the members of the relevant room and to process it as described in the Privacy Policy. Access may be restricted and content may be removed to address abuse or protect room members. Features and availability may change as the project develops."}</p>
        <p>{"For help or to report abuse, email clashanimations597@gmail.com."}</p>
      </>
    ),
  },
};

type PageProps = { params: Promise<{ policy: string }> };

export function generateStaticParams() {
  return Object.keys(policies).map((policy) => ({ policy }));
}

function getPolicy(policy: string) {
  if (policy === "privacy" || policy === "terms") return policies[policy];
  notFound();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { policy } = await params;
  return { title: getPolicy(policy).title + " | DoubtRoom" };
}

export default async function PolicyPage({ params }: PageProps) {
  const { policy } = await params;
  const { title, content } = getPolicy(policy);
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-5 py-8 sm:py-12">
      <Link href="/" className="text-sm font-medium underline">DoubtRoom</Link>
      <article className="space-y-4 leading-relaxed">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {content}
      </article>
      <nav aria-label="Policies" className="flex flex-wrap gap-4 text-sm">
        <Link href="/privacy" className="underline">Privacy Policy</Link>
        <Link href="/terms" className="underline">Terms of Service</Link>
      </nav>
    </main>
  );
}
