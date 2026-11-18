"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { browserSupabase } from "@/lib/supabase/client";

export function GoogleSignIn({ failed }: { failed: boolean }) {
  const [error, setError] = useState(failed ? "Google sign-in could not be completed. Try again." : "");
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    setError("");
    try {
      const { data, error } = await browserSupabase().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: new URL("/auth/callback", window.location.origin).href },
      });
      if (error || !data.url) throw new Error("OAuth redirect unavailable");
    } catch {
      setError("Google sign-in could not start. Try again.");
      setPending(false);
    }
  }

  return (
    <div className="mt-7 space-y-3">
      <Button type="button" className="h-12 w-full" onClick={signIn} disabled={pending}>
        {pending ? "Opening Google…" : "Continue with Google"}
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
