import { create } from "zustand";

import { OrderActionStep } from "@/app/[locale]/margin-trading/types";

interface CreateOrderStepStore {
  step: OrderActionStep;
  setStep: (step: OrderActionStep) => void;
  reset: () => void;
}

export const useCreateOrderStepStore = create<CreateOrderStepStore>((set, get) => ({
  step: OrderActionStep.FIRST,

  setStep: (step) => set({ step }),
  reset: () => set({ step: OrderActionStep.FIRST }),
}));
