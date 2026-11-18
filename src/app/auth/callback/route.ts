import { NextResponse, type NextRequest } from "next/server";
import { requestOrigin } from "@/lib/request-origin";
import { actorForUser } from "@/lib/auth/actor";
import { serverSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  let destination = "/login?error=oauth";
  if (code) {
    try {
      const supabase = await serverSupabase();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data.user) {
        const actor = await actorForUser(data.user);
        destination = actor.profile.onboarded_at ? "/app" : "/onboarding";
      }
    } catch {
      console.error("Could not finish Google sign-in");
    }
  }
  return NextResponse.redirect(new URL(destination, requestOrigin(request)), {
    status: 303,
    headers: { "Cache-Control": "private, no-store" },
  });
}
