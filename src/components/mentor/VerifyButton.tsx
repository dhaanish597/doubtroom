"use client";

import { useState } from "react";
import { BadgeCheck, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiFailure, refreshInboxBadge, setVerified } from "@/lib/answers/client";
import type { VerifyResult } from "@/lib/answers/types";

type Props = {
  answerId: string;
  verified: boolean;
  /** Shows Undo instead of nothing once verified. The server re-checks the 10-minute rule. */
  canUndo?: boolean;
  onDone?: (result: VerifyResult) => void;
  className?: string;
};

export function VerifyButton({ answerId, verified, canUndo = false, onDone, className = "" }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (verified && !canUndo) return null;

  async function toggle() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await setVerified(answerId, !verified);
      onDone?.(result);
      void refreshInboxBadge();
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : "Could not verify the answer. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start">
      {verified ? (
        <Button type="button" variant="ghost" className={`min-h-11 px-2 text-xs ${className}`} disabled={pending} onClick={toggle}>
          <Undo2 aria-hidden="true" />{pending ? "Undoing…" : "Undo verify"}
        </Button>
      ) : (
        <Button type="button" className={`min-h-11 rounded-xl bg-emerald-700 px-3 text-xs text-white hover:bg-emerald-800 ${className}`} disabled={pending} onClick={toggle}>
          <BadgeCheck aria-hidden="true" />{pending ? "Verifying…" : "Verify"}
        </Button>
      )}
      {error && <span role="alert" className="px-1 text-xs text-destructive">{error}</span>}
    </span>
  );
}
