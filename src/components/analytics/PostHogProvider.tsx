"use client";

import { useEffect } from "react";

import { attachAnalytics } from "@/lib/analytics";
import { publicEnv } from "@/lib/public-env";

let started = false;

/** Loads PostHog only when NEXT_PUBLIC_POSTHOG_KEY is set. Otherwise analytics stay a no-op. */
export function PostHogProvider() {
  useEffect(() => {
    const key = publicEnv.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || started) return;
    started = true;
    void import("posthog-js").then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: publicEnv.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        person_profiles: "identified_only",
        capture_pageview: "history_change",
        // Clicks and recordings could capture message text, so only explicit events are sent.
        autocapture: false,
        disable_session_recording: true,
        disable_surveys: true,
      });
      attachAnalytics(posthog);
    }).catch(() => { started = false; });
  }, []);

  return null;
}
