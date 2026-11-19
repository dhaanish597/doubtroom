"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, Share } from "lucide-react";

import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { isIos, isStandalone, useInstallPrompt } from "@/lib/pwa/install";

type Platform = "unknown" | "standalone" | "ios" | "other";

const subscribeNoop = () => () => undefined;
function detectPlatform(): Platform {
  if (isStandalone()) return "standalone";
  return isIos() ? "ios" : "other";
}

export function InstallApp() {
  const platform = useSyncExternalStore(subscribeNoop, detectPlatform, () => "unknown" as const);
  const prompt = useInstallPrompt((state) => state.prompt);
  const installed = useInstallPrompt((state) => state.installed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function install() {
    if (!prompt) return;
    track("install_clicked", { platform: "android" });
    setBusy(true);
    setError(false);
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") useInstallPrompt.setState({ prompt: null, installed: true });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (platform === "unknown") return <p role="status" className="text-sm text-muted-foreground">Checking install options…</p>;
  if (installed || platform === "standalone") return <p className="text-sm text-muted-foreground">DoubtRoom is installed on this device.</p>;
  if (platform === "ios") {
    return (
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Share aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
        In Safari, tap Share, then “Add to Home Screen”.
      </p>
    );
  }
  if (!prompt) {
    return <p className="text-sm text-muted-foreground">Open DoubtRoom in Chrome on Android to install it, or use your browser’s menu.</p>;
  }
  return (
    <>
      <Button type="button" className="h-11 px-4" disabled={busy} onClick={install}>
        <Download aria-hidden="true" />{busy ? "Opening…" : "Install app"}
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">Could not open the installer. Try again.</p>}
    </>
  );
}
