import { Address, encodeFunctionData, Hex, isAddress, zeroAddress } from "viem";
import { useReadContracts } from "wagmi";

import { MARGIN_MODULE_ABI } from "@/config/abis/marginModule";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { MARGIN_TRADING_ADDRESS } from "@/sdk_bi/addresses";

// Contract defaults (Dex223MarginModule: MAINTENANCE_MARGIN_BPS, MAX_MAINTENANCE_MARGIN_BPS).
export const DEFAULT_MAINTENANCE_MARGIN_PERCENT = 10;
export const MAX_MAINTENANCE_MARGIN_PERCENT = 50;

/** Highest leverage a margin allows: a loan must open above debt * (1 + margin). */
export function maxLeverageForMargin(percent: number): number {
  return 1 + 100 / percent;
}

/**
 * Whether the deployed margin module has lender protection (orderSetLenderProtection, added in
 * Dex223-contracts #182), and, for `orderId`, its current settings. Modules deployed before it
 * revert on the getters, so `supported` is false there and the fields stay hidden.
 */
export function useOrderLenderProtection(orderId?: number | bigint) {
  const chainId = useCurrentChainId();
  const address = MARGIN_TRADING_ADDRESS[chainId];
  const id = BigInt(orderId ?? 0);
  const { data, isLoading } = useReadContracts({
    allowFailure: true,
    contracts: [
      { address, abi: MARGIN_MODULE_ABI, functionName: "orderMaintenanceMarginBps", args: [id] },
      { address, abi: MARGIN_MODULE_ABI, functionName: "orderLiquidationKeeper", args: [id] },
    ],
    query: { enabled: Boolean(address) && address !== zeroAddress },
  });

  const supported = data?.[0]?.status === "success";
  const bps = supported ? Number(data![0].result as bigint) : 0;
  const keeper =
    data?.[1]?.status === "success" ? (data[1].result as Address) : (zeroAddress as Address);

  return {
    supported,
    loading: isLoading,
    marginPercent: bps === 0 ? DEFAULT_MAINTENANCE_MARGIN_PERCENT : bps / 100,
    keeper: keeper === zeroAddress ? "" : keeper,
  };
}

/**
 * The orderSetLenderProtection call for a multicall, or undefined when both settings are at their
 * defaults and nothing needs to be sent (unless `always`, used when editing to clear old values).
 */
export function encodeLenderProtection(
  orderId: bigint,
  marginPercent: string | number,
  keeper: string,
  always = false,
): Hex | undefined {
  const percent = Number(marginPercent || DEFAULT_MAINTENANCE_MARGIN_PERCENT);
  const isDefault = percent === DEFAULT_MAINTENANCE_MARGIN_PERCENT && !keeper;
  if (isDefault && !always) return undefined;
  return encodeFunctionData({
    abi: MARGIN_MODULE_ABI,
    functionName: "orderSetLenderProtection",
    args: [
      orderId,
      percent === DEFAULT_MAINTENANCE_MARGIN_PERCENT
        ? BigInt(0)
        : BigInt(Math.round(percent * 100)),
      keeper && isAddress(keeper) ? (keeper as Address) : zeroAddress,
    ],
  });
}
