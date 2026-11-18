"use client";

import { useEffect, useMemo, useState } from "react";

import {
  useCreateOrderGasLimitStore,
  useCreateOrderGasModeStore,
  useCreateOrderGasPriceStore,
} from "@/app/[locale]/margin-trading/lending-order/create/stores/useSwapGasSettingsStore";
import GasSettingsBlock from "@/components/common/GasSettingsBlock";
import NetworkFeeConfigDialog from "@/components/dialogs/NetworkFeeConfigDialog";
import { getFormattedGasPrice, getGasSettings } from "@/functions/gasSettings";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { useGlobalFees } from "@/shared/hooks/useGlobalFees";
import { createGasLimitStore } from "@/stores/factories/createGasLimitStore";
import { createGasPriceStore, GasOption } from "@/stores/factories/createGasPriceStore";
import { createGasModeStore } from "@/stores/factories/createGasSettingsStore";

const createSettings = () => ({
  usePrice: createGasPriceStore(),
  useLimit: createGasLimitStore(),
  useMode: createGasModeStore(),
  chainId: undefined as number | undefined,
  requestKey: undefined as string | undefined,
});

// A custom limit for a withdrawal must not override a later borrow or create-order call.
export const marginGasStores = {
  createOrder: {
    usePrice: useCreateOrderGasPriceStore,
    useLimit: useCreateOrderGasLimitStore,
    useMode: useCreateOrderGasModeStore,
    chainId: undefined as number | undefined,
    requestKey: undefined as string | undefined,
  },
  editOrder: createSettings(),
  borrow: createSettings(),
  depositPosition: createSettings(),
  withdrawPosition: createSettings(),
  closePosition: createSettings(),
  liquidatePosition: createSettings(),
  depositOrder: createSettings(),
  withdrawOrder: createSettings(),
  openOrder: createSettings(),
  closeOrder: createSettings(),
};

export type MarginGasOperation = keyof typeof marginGasStores;

export function useOperationStores(operation: MarginGasOperation) {
  const chainId = useCurrentChainId();
  const stores = marginGasStores[operation];
  useEffect(() => {
    if (stores.chainId !== chainId) {
      stores.usePrice.getState().updateDefaultState(chainId);
      stores.useLimit.getState().setCustomGasLimit(undefined);
      stores.useLimit.getState().setEstimatedGas(0n);
      stores.requestKey = undefined;
      stores.chainId = chainId;
    }
  }, [chainId, stores]);
  return stores;
}

export function useMarginWriteGas(operation: MarginGasOperation) {
  const chainId = useCurrentChainId();
  const stores = useOperationStores(operation);
  const { gasPriceOption, gasPriceSettings } = stores.usePrice();
  const { baseFee, priorityFee, gasPrice } = useGlobalFees();
  const settingsChainId = stores.chainId;

  return useMemo(
    () =>
      settingsChainId === chainId
        ? getGasSettings({
            baseFee,
            chainId,
            gasPrice,
            priorityFee,
            gasPriceOption,
            gasPriceSettings,
          })
        : undefined,
    [settingsChainId, baseFee, chainId, gasPrice, gasPriceOption, gasPriceSettings, priorityFee],
  );
}

export default function MarginGasSettings({ operation }: { operation: MarginGasOperation }) {
  const [isOpen, setIsOpen] = useState(false);
  const chainId = useCurrentChainId();
  const stores = useOperationStores(operation);
  const { baseFee, gasPrice } = useGlobalFees();
  const { gasPriceOption, gasPriceSettings, setGasPriceOption, setGasPriceSettings } =
    stores.usePrice();
  const { customGasLimit, estimatedGas, setCustomGasLimit, setEstimatedGas } = stores.useLimit();
  const { isAdvanced, setIsAdvanced } = stores.useMode();

  const formattedGasPrice = getFormattedGasPrice({
    baseFee,
    chainId,
    gasPrice,
    gasPriceOption,
    gasPriceSettings,
  });

  return (
    <>
      <GasSettingsBlock
        formattedGasPrice={formattedGasPrice}
        customGasLimit={customGasLimit}
        estimatedGas={estimatedGas}
        gasOption={
          gasPriceOption === GasOption.FAST
            ? "fast"
            : gasPriceOption === GasOption.CUSTOM
              ? "custom"
              : "cheap"
        }
        handleClick={() => setIsOpen(true)}
      />
      <NetworkFeeConfigDialog
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        isAdvanced={isAdvanced}
        setIsAdvanced={setIsAdvanced}
        gasPriceOption={gasPriceOption}
        gasPriceSettings={gasPriceSettings}
        setGasPriceOption={setGasPriceOption}
        setGasPriceSettings={setGasPriceSettings}
        customGasLimit={customGasLimit}
        estimatedGas={estimatedGas}
        setCustomGasLimit={setCustomGasLimit}
        setEstimatedGas={setEstimatedGas}
      />
    </>
  );
}
