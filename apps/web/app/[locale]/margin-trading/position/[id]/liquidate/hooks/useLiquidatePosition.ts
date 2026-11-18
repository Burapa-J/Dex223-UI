import { useCallback } from "react";
import { type Address, type Hash, parseEventLogs } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";

import {
  PositionLiquidateStatus,
  usePositionLiquidateStatusStore,
} from "@/app/[locale]/margin-trading/position/[id]/liquidate/stores/usePositionLiquidateStatusStore";
import { MarginPosition } from "@/app/[locale]/margin-trading/types";
import { MARGIN_MODULE_ABI } from "@/config/abis/marginModule";
import { isMarginDeployed } from "@/config/modules";
import { getMinedRevert, isUserRejection, toMarginRevert } from "@/functions/marginRevert";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { MARGIN_TRADING_ADDRESS } from "@/sdk_bi/addresses";
import { useMarginRevertStore } from "@/stores/useMarginRevertStore";

// Dex223MarginModule.MAX_FREEZE_DURATION: a freeze older than this has lapsed, and the next
// liquidate() call places a new one instead of completing the liquidation.
const MAX_FREEZE_DURATION = BigInt(3600);

/**
 * liquidate() does one of two things depending on chain state: with no live freeze it freezes the
 * position; with a live freeze from an earlier block it completes the liquidation. The UI used to
 * send two calls blindly, so when someone else had already frozen the position (Dario, position 53)
 * the first call completed the liquidation and the second reverted with MM22. Read the state first,
 * simulate each call (a revert shows its reason before the wallet opens), and stop as soon as the
 * Liquidation event is seen.
 */
export default function useLiquidatePosition(position: MarginPosition) {
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useCurrentChainId();

  const { setStatus, setPositionLiquidateHash, setPositionFreezeHash } =
    usePositionLiquidateStatusStore();
  const setRevert = useMarginRevertStore((s) => s.setRevert);

  const handleLiquidatePosition = useCallback(async () => {
    // Never build a transaction against the zero address on chains without a margin deployment.
    if (!isMarginDeployed(chainId)) {
      return;
    }

    if (!position || !walletClient || !publicClient || !address) {
      return;
    }

    const moduleAddress = MARGIN_TRADING_ADDRESS[chainId] as Address;
    const positionId = BigInt(position.id);
    const call = {
      abi: MARGIN_MODULE_ABI,
      address: moduleAddress,
      functionName: "liquidate" as const,
      args: [positionId, address] as const,
      account: address,
    };

    const liquidated = (logs: Parameters<typeof parseEventLogs>[0]["logs"]) =>
      parseEventLogs({ abi: MARGIN_MODULE_ABI, eventName: "Liquidation", logs }).some(
        (log) => (log.args as { positionId?: bigint }).positionId === positionId,
      );

    // Simulate, then send. Returns the receipt, or undefined after setting the error state.
    const send = async (
      errorStatus: PositionLiquidateStatus,
      onHash: (hash: Hash) => void,
      loadingStatus: PositionLiquidateStatus,
    ) => {
      let hash: Hash | undefined;
      try {
        const { request } = await publicClient.simulateContract(call);
        hash = await walletClient.writeContract({ ...request, account: undefined });
      } catch (error) {
        if (isUserRejection(error)) {
          setStatus(PositionLiquidateStatus.INITIAL);
        } else {
          setRevert("liquidate", toMarginRevert(error));
          setStatus(errorStatus);
        }
        return undefined;
      }
      onHash(hash);
      setStatus(loadingStatus);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        setRevert("liquidate", await getMinedRevert(publicClient, hash));
        setStatus(errorStatus);
        return undefined;
      }
      return receipt;
    };

    setRevert("liquidate", undefined);

    const [, , frozenTime, isClosed] = (await publicClient.readContract({
      abi: MARGIN_MODULE_ABI,
      address: moduleAddress,
      functionName: "subjectToLiquidationExtended",
      args: [positionId],
    })) as readonly [boolean, Address, bigint, boolean, bigint];

    if (isClosed) {
      setRevert("liquidate", { code: "MM22" });
      setStatus(PositionLiquidateStatus.ERROR_LIQUIDATE);
      return;
    }

    const block = await publicClient.getBlock();
    const liveFreeze =
      frozenTime > BigInt(0) && block.timestamp - frozenTime <= MAX_FREEZE_DURATION;

    let frozenAt = frozenTime;
    if (!liveFreeze) {
      setStatus(PositionLiquidateStatus.PENDING_FREEZE);
      const freezeReceipt = await send(
        PositionLiquidateStatus.ERROR_FREEZE,
        setPositionFreezeHash,
        PositionLiquidateStatus.LOADING_FREEZE,
      );
      if (!freezeReceipt) return;
      if (liquidated(freezeReceipt.logs)) {
        setStatus(PositionLiquidateStatus.SUCCESS);
        return;
      }
      frozenAt = (await publicClient.getBlock({ blockNumber: freezeReceipt.blockNumber }))
        .timestamp;
    }

    // The completing call must land in a later block than the freeze (MM24).
    setStatus(PositionLiquidateStatus.LOADING_BLOCK_CONFIRMATION);
    for (let i = 0; i < 30; i++) {
      const latest = await publicClient.getBlock();
      if (latest.timestamp > frozenAt) break;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    setStatus(PositionLiquidateStatus.PENDING_LIQUIDATE);
    const receipt = await send(
      PositionLiquidateStatus.ERROR_LIQUIDATE,
      setPositionLiquidateHash,
      PositionLiquidateStatus.LOADING_LIQUIDATE,
    );
    if (receipt) {
      setStatus(PositionLiquidateStatus.SUCCESS);
    }
  }, [
    address,
    chainId,
    position,
    publicClient,
    setPositionFreezeHash,
    setPositionLiquidateHash,
    setRevert,
    setStatus,
    walletClient,
  ]);

  return { handleLiquidatePosition };
}
