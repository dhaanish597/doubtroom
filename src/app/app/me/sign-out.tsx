"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { browserSupabase } from "@/lib/supabase/client";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function signOut() {
    setBusy(true);
    setError(false);
    try {
      const { error } = await browserSupabase().auth.signOut({ scope: "local" });
      if (error) throw error;
      window.location.replace("/login");
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" className="h-11 px-4" disabled={busy} onClick={signOut}>{busy ? "Signing out…" : "Sign out"}</Button>
      {error && <p role="alert" className="text-sm text-destructive">Could not sign out. Try again.</p>}
    </>
  );
}
