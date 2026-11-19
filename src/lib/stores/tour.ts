import { create } from "zustand";

export type TourPrefill = { roomId: string; text: string; unit?: string };

/** Hands the demo tour's example doubt to the room composer across client navigation. */
export const useTourPrefill = create<{
  prefill: TourPrefill | null;
  setPrefill: (prefill: TourPrefill) => void;
  clear: () => void;
}>((set) => ({
  prefill: null,
  setPrefill: (prefill) => set({ prefill }),
  clear: () => set({ prefill: null }),
}));
