import { createGasLimitStore } from "@/stores/factories/createGasLimitStore";
import { createGasPriceStore } from "@/stores/factories/createGasPriceStore";
import { createGasModeStore } from "@/stores/factories/createGasSettingsStore";

/** Claim-only gas settings. Stake uses useStakeGasSettingsStore. */
export const useClaimGasPriceStore = createGasPriceStore();
export const useClaimGasLimitStore = createGasLimitStore();
export const useClaimGasModeStore = createGasModeStore();
