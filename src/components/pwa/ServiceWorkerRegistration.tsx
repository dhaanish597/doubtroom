"use client";

import { useEffect } from "react";

import { listenForInstallPrompt } from "@/lib/pwa/install";

/** Registers the app-shell service worker in production builds only, so dev reloads stay fresh. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    listenForInstallPrompt();
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // The app works without offline support; installation simply stays unavailable.
    });
  }, []);
  return null;
}
