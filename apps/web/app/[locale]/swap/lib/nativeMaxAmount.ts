import { formatUnits } from "viem";

export const SWAP_ESTIMATE_FALLBACK = BigInt(195000);
export const SWAP_GAS_BUFFER = BigInt(30000);

/** Gas limit the swap transaction will request, so Max can leave that much for the fee. */
export function swapGasUnits(estimatedGas: bigint, customGasLimit: bigint | undefined): bigint {
  if (customGasLimit && customGasLimit > BigInt(0)) {
    return customGasLimit;
  }

  const estimate = estimatedGas > BigInt(0) ? estimatedGas : SWAP_ESTIMATE_FALLBACK;
  return estimate + SWAP_GAS_BUFFER;
}

export function nativeMaxAmount({
  balance,
  decimals,
  gasUnits,
  gasPrice,
}: {
  balance: bigint;
  decimals: number;
  gasUnits: bigint;
  gasPrice: bigint | undefined;
}): string {
  if (gasPrice === undefined || gasPrice <= BigInt(0) || gasUnits <= BigInt(0)) {
    return "";
  }

  const reserve = gasUnits * gasPrice;
  if (reserve >= balance) {
    return "";
  }

  return trimTrailingZeros(formatUnits(balance - reserve, decimals));
}

function trimTrailingZeros(value: string): string {
  if (!value.includes(".")) {
    return value;
  }

  return value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}
