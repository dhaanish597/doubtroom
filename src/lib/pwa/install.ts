"use client";

import { create } from "zustand";

/** Chromium's install prompt event (not in the DOM lib types). */
export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export const useInstallPrompt = create<{ prompt: InstallPromptEvent | null; installed: boolean }>(() => ({
  prompt: null,
  installed: false,
}));

let listening = false;

/** Captures beforeinstallprompt as early as the app shell loads, so /app/me can offer it later. */
export function listenForInstallPrompt() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    useInstallPrompt.setState({ prompt: event as InstallPromptEvent });
  });
  window.addEventListener("appinstalled", () => useInstallPrompt.setState({ prompt: null, installed: true }));
}

export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
