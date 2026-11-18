import { create } from "zustand";

import type { MarginRevert } from "@/functions/marginRevert";

/** Why the last liquidation or close failed, shown by the dialog's error state. */
type MarginAction = "liquidate" | "close";

interface MarginRevertStore {
  reverts: Partial<Record<MarginAction, MarginRevert>>;
  setRevert: (action: MarginAction, revert: MarginRevert | undefined) => void;
}

export const useMarginRevertStore = create<MarginRevertStore>()((set, get) => ({
  reverts: {},
  setRevert: (action, revert) => set({ reverts: { ...get().reverts, [action]: revert } }),
}));
