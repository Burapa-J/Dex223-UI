import { useCallback } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";

import {
  PositionLiquidateStatus,
  usePositionLiquidateStatusStore,
} from "@/app/[locale]/margin-trading/position/[id]/liquidate/stores/usePositionLiquidateStatusStore";
import { MarginPosition } from "@/app/[locale]/margin-trading/types";
import { MARGIN_MODULE_ABI } from "@/config/abis/marginModule";
import { isMarginDeployed } from "@/config/modules";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { MARGIN_TRADING_ADDRESS } from "@/sdk_bi/addresses";

const MAX_FREEZE_DURATION = 3600n;

export default function useLiquidatePosition(position: MarginPosition) {
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useCurrentChainId();
  const { setStatus, setPositionLiquidateHash, setPositionFreezeHash } =
    usePositionLiquidateStatusStore();

  const handleLiquidatePosition = useCallback(async () => {
    if (!isMarginDeployed(chainId) || !walletClient || !publicClient || !position || !address)
      return;
    let failureStatus = PositionLiquidateStatus.ERROR_LIQUIDATE;
    try {
      const readPosition = () =>
        publicClient.readContract({
          abi: MARGIN_MODULE_ABI,
          address: MARGIN_TRADING_ADDRESS[chainId],
          functionName: "positions",
          args: [BigInt(position.id)],
        });
      const current = await readPosition();
      // positions()[6] is `open`. A closed position was already liquidated or closed by its owner.
      if (!current[6]) {
        setStatus(PositionLiquidateStatus.ALREADY_CLOSED);
        return;
      }
      const liquidatable = await publicClient.readContract({
        abi: MARGIN_MODULE_ABI,
        address: MARGIN_TRADING_ADDRESS[chainId],
        functionName: "subjectToLiquidation",
        args: [BigInt(position.id)],
      });
      if (!liquidatable) throw new Error("Position is not liquidatable");
      const block = await publicClient.getBlock({ blockTag: "latest" });
      const frozenTime = current[7];
      const send = () =>
        walletClient.writeContract({
          abi: MARGIN_MODULE_ABI,
          address: MARGIN_TRADING_ADDRESS[chainId],
          functionName: "liquidate",
          args: [BigInt(position.id), address],
        });

      // Fresh positions and expired freezes need a freeze call; a live freeze only needs liquidation.
      if (frozenTime === 0n || block.timestamp - frozenTime > MAX_FREEZE_DURATION) {
        failureStatus = PositionLiquidateStatus.ERROR_FREEZE;
        setStatus(PositionLiquidateStatus.PENDING_FREEZE);
        const hash = await send();
        setPositionFreezeHash(hash);
        setStatus(PositionLiquidateStatus.LOADING_FREEZE);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("Freeze failed");
        const after = await readPosition();
        if (!after[6]) {
          setStatus(PositionLiquidateStatus.ALREADY_CLOSED);
          return;
        }
        // The contract forbids freezing and liquidating in the same block.
        setStatus(PositionLiquidateStatus.LOADING_BLOCK_CONFIRMATION);
        await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });
      } else if (block.timestamp <= frozenTime) {
        throw new Error("Wait for the next block before liquidating");
      }

      failureStatus = PositionLiquidateStatus.ERROR_LIQUIDATE;
      setStatus(PositionLiquidateStatus.PENDING_LIQUIDATE);
      const hash = await send();
      setPositionLiquidateHash(hash);
      setStatus(PositionLiquidateStatus.LOADING_LIQUIDATE);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Liquidation failed");
      // A liquidate call that lands after MAX_FREEZE_DURATION re-freezes instead of reverting.
      // The receipt still succeeds, so confirm the position actually closed.
      const liquidated = await readPosition();
      if (!liquidated[6]) {
        setStatus(PositionLiquidateStatus.SUCCESS);
        return;
      }
      setStatus(PositionLiquidateStatus.FREEZE_RENEWED);
    } catch (error) {
      console.error(error);
      setStatus(failureStatus);
    }
  }, [
    address,
    chainId,
    position,
    publicClient,
    setPositionFreezeHash,
    setPositionLiquidateHash,
    setStatus,
    walletClient,
  ]);

  return { handleLiquidatePosition };
}
