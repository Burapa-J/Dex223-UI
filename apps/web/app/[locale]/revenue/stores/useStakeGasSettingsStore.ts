import { createGasLimitStore } from "@/stores/factories/createGasLimitStore";
import { createGasPriceStore } from "@/stores/factories/createGasPriceStore";
import { createGasModeStore } from "@/stores/factories/createGasSettingsStore";

/** Isolated from claim gas stores so stake/claim fee edits do not leak across flows. */
export const useStakeGasPriceStore = createGasPriceStore();
export const useStakeGasLimitStore = createGasLimitStore();
export const useStakeGasModeStore = createGasModeStore();
