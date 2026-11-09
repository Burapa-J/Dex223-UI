import { useCallback } from "react";
import { useReadContract } from "wagmi";

import { MarginPosition } from "@/app/[locale]/margin-trading/types";
import { MARGIN_MODULE_ABI } from "@/config/abis/marginModule";
import { isMarginDeployed } from "@/config/modules";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { MARGIN_TRADING_ADDRESS } from "@/sdk_bi/addresses";

export default function usePositionLiquidationState(position: MarginPosition) {
  const chainId = useCurrentChainId();
  const open = !position.isClosed && !position.isLiquidated;
  const enabled = isMarginDeployed(chainId) && open;

  const { data: onChainPosition, refetch: refetchPosition } = useReadContract({
    abi: MARGIN_MODULE_ABI,
    address: MARGIN_TRADING_ADDRESS[chainId],
    functionName: "positions",
    args: [BigInt(position.id)],
    query: { enabled },
  });

  const {
    data: subjectToLiquidation,
    isFetched,
    isError,
    refetch: refetchLiquidation,
  } = useReadContract({
    abi: MARGIN_MODULE_ABI,
    address: MARGIN_TRADING_ADDRESS[chainId],
    functionName: "subjectToLiquidation",
    args: [BigInt(position.id)],
    query: { enabled },
  });

  const refetch = useCallback(() => {
    return Promise.all([refetchPosition(), refetchLiquidation()]);
  }, [refetchLiquidation, refetchPosition]);

  const frozenTime =
    onChainPosition !== undefined ? Number(onChainPosition[7]) : Number(position.frozenTime || 0);

  return {
    frozenTime,
    isFrozen: open && frozenTime > 0,
    isLiquidatable: Boolean(subjectToLiquidation),
    isLiquidatableKnown: enabled && isFetched && !isError,
    refetch,
  };
}
