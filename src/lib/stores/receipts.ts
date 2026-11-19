import { create } from "zustand";

/** Group read receipt counts for announcements, or the SDK code when receipts failed. */
export type ReceiptState = { read: number; total: number } | { error: number };

type ReceiptsState = {
  byMessage: Record<string, ReceiptState>;
  setCounts: (entries: readonly { messageId: string; read: number; total: number }[]) => void;
  setError: (messageIds: readonly string[], code: number) => void;
  reset: () => void;
};

export const useReceipts = create<ReceiptsState>((set) => ({
  byMessage: {},
  setCounts(entries) {
    if (!entries.length) return;
    set((state) => {
      const byMessage = { ...state.byMessage };
      for (const { messageId, read, total } of entries) {
        const previous = byMessage[messageId];
        // Counts only grow, so a late lookup cannot undo a live event.
        const floor = previous && "read" in previous ? previous.read : 0;
        byMessage[messageId] = { read: Math.max(read, floor), total: Math.max(total, read) };
      }
      return { byMessage };
    });
  },
  setError(messageIds, code) {
    set((state) => {
      const byMessage = { ...state.byMessage };
      for (const id of messageIds) if (!byMessage[id] || "error" in byMessage[id]) byMessage[id] = { error: code };
      return { byMessage };
    });
  },
  reset: () => set({ byMessage: {} }),
}));
