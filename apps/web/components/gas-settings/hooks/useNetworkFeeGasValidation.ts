import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { parseGwei } from "viem";

import { useGlobalFees } from "@/shared/hooks/useGlobalFees";

export default function useNetworkFeeGasValidation({
  ...values
}: {
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  gasPrice: string;
  gasLimit: string;
  estimatedGas: bigint;
}) {
  const t = useTranslations("GasSettings");
  const { baseFee, priorityFee, gasPrice } = useGlobalFees();

  const maxFeePerGasError = useMemo(() => {
    return baseFee && parseGwei(values.maxFeePerGas) < baseFee ? t("max_fee_too_low") : undefined;
  }, [baseFee, t, values.maxFeePerGas]);

  const maxFeePerGasWarning = useMemo(() => {
    return baseFee && parseGwei(values.maxFeePerGas) > baseFee * BigInt(3)
      ? t("max_fee_too_high")
      : undefined;
  }, [baseFee, t, values.maxFeePerGas]);

  const maxPriorityFeePerGasError = useMemo(() => {
    return parseGwei(values.maxPriorityFeePerGas) === BigInt(0)
      ? t("priority_fee_too_low")
      : undefined;
  }, [t, values.maxPriorityFeePerGas]);

  const maxPriorityFeePerGasWarning = useMemo(() => {
    return priorityFee && parseGwei(values.maxPriorityFeePerGas) > priorityFee * BigInt(3)
      ? t("priority_fee_too_high")
      : undefined;
  }, [priorityFee, t, values.maxPriorityFeePerGas]);

  const legacyGasPriceError = useMemo(() => {
    return gasPrice && parseGwei(values.gasPrice) < gasPrice ? t("gas_price_too_low") : undefined;
  }, [gasPrice, t, values.gasPrice]);

  const legacyGasPriceWarning = useMemo(() => {
    return gasPrice && parseGwei(values.gasPrice) > gasPrice * BigInt(3)
      ? t("gas_price_too_high")
      : undefined;
  }, [gasPrice, t, values.gasPrice]);

  const gasLimitError = useMemo(() => {
    if (values.gasLimit === "") return undefined;
    return !/^\d+$/.test(values.gasLimit) ||
      BigInt(values.gasLimit) <= 0n ||
      BigInt(values.gasLimit) < values.estimatedGas
      ? t("gas_limit_too_low")
      : undefined;
  }, [t, values.gasLimit, values.estimatedGas]);

  return {
    maxFeePerGasError,
    maxFeePerGasWarning,
    maxPriorityFeePerGasError,
    maxPriorityFeePerGasWarning,
    legacyGasPriceError,
    legacyGasPriceWarning,
    gasLimitError,
  };
}
