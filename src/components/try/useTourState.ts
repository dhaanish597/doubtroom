"use client";

import { create } from "zustand";

import { track } from "@/lib/analytics";
import { isTourStep, TOUR_STEPS, type TourStep } from "@/lib/try/tour";

type Saved = { done: TourStep[]; collapsed: boolean };

const storageKey = (userId: string) => `dr_tour:${userId}`;

function read(userId: string): Saved {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(storageKey(userId)) ?? "null");
    if (raw && typeof raw === "object") {
      const { done, collapsed } = raw as { done?: unknown; collapsed?: unknown };
      return { done: Array.isArray(done) ? done.filter(isTourStep) : [], collapsed: collapsed === true };
    }
  } catch {
    // Storage may be blocked or hold an old shape. Start the tour fresh.
  }
  return { done: [], collapsed: false };
}

function write(userId: string, saved: Saved) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(saved));
  } catch {
    // Progress then lasts only for this page view.
  }
}

/** Demo tour progress for one sandbox visitor, remembered in this browser. */
export const useTourState = create<{
  userId: string | null;
  done: TourStep[];
  collapsed: boolean;
  load: (userId: string) => void;
  markDone: (steps: readonly TourStep[]) => void;
  setCollapsed: (collapsed: boolean) => void;
}>((set, get) => ({
  userId: null,
  done: [],
  collapsed: false,
  load(userId) {
    if (get().userId === userId) return;
    set({ userId, ...read(userId) });
  },
  markDone(steps) {
    const { userId, done, collapsed } = get();
    const fresh = steps.filter((step) => !done.includes(step));
    if (!userId || !fresh.length) return;
    const next = TOUR_STEPS.filter((step) => done.includes(step) || fresh.includes(step));
    set({ done: next });
    write(userId, { done: next, collapsed });
    for (const step of fresh) track("try_step_done", { step, completed: next.length });
  },
  setCollapsed(collapsed) {
    const { userId, done } = get();
    set({ collapsed });
    if (userId) write(userId, { done, collapsed });
  },
}));
