import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { DemoFlowId } from "../flows";

export type DemoBalances = {
  usdt20: number;
  usdt223: number;
  eth: number;
  d223: number;
};

export const INITIAL_DEMO_BALANCES: DemoBalances = {
  usdt20: 1000,
  usdt223: 250,
  eth: 2,
  d223: 50000,
};

interface DemoStore {
  completed: DemoFlowId[];
  balances: DemoBalances;
  completeFlow: (flow: DemoFlowId) => void;
  canChangeBalances: (delta: Partial<DemoBalances>) => boolean;
  changeBalances: (delta: Partial<DemoBalances>) => boolean;
  reset: () => void;
}

function updatedBalances(balances: DemoBalances, delta: Partial<DemoBalances>) {
  const next = { ...balances };
  for (const [key, value] of Object.entries(delta) as [keyof DemoBalances, number][]) {
    const amount = next[key] + value;
    if (!Number.isFinite(value) || !Number.isFinite(amount) || amount < 0) return null;
    next[key] = amount;
  }
  return next;
}

// Progress and pretend balances live in this browser only. Nothing here is sent anywhere.
export const useDemoStore = create<DemoStore>()(
  persist(
    (set, get) => ({
      completed: [],
      balances: INITIAL_DEMO_BALANCES,
      completeFlow: (flow) => {
        if (get().completed.includes(flow)) return;
        set({ completed: [...get().completed, flow] });
      },
      canChangeBalances: (delta) => updatedBalances(get().balances, delta) !== null,
      changeBalances: (delta) => {
        const balances = updatedBalances(get().balances, delta);
        if (!balances) return false;
        set({ balances });
        return true;
      },
      reset: () => set({ completed: [], balances: INITIAL_DEMO_BALANCES }),
    }),
    { name: "dex223-demo" },
  ),
);

// The server render has no localStorage, so the first client render uses the initial state
// too and the saved progress appears right after mount, without a hydration mismatch.
export function useHydratedDemoStore() {
  const store = useDemoStore();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated ? store : { ...store, completed: [], balances: INITIAL_DEMO_BALANCES };
}
