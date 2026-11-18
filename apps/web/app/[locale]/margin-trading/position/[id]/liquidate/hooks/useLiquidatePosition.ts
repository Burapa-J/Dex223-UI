import { useCallback } from "react";
import { type Address, type Hash } from "viem";
import { useAccount, usePublicClient } from "wagmi";

import useMarginGasEstimate from "@/app/[locale]/margin-trading/hooks/useMarginGasEstimate";
import useMarginWalletClient from "@/app/[locale]/margin-trading/hooks/useMarginWalletClient";
import {
  PositionLiquidateStatus,
  usePositionLiquidateStatusStore,
} from "@/app/[locale]/margin-trading/position/[id]/liquidate/stores/usePositionLiquidateStatusStore";
import { MarginPosition } from "@/app/[locale]/margin-trading/types";
import { MARGIN_MODULE_ABI } from "@/config/abis/marginModule";
import { isMarginDeployed } from "@/config/modules";
import {
  getMarginRevertCode,
  getMinedRevert,
  isUserRejection,
  type MarginRevert,
  toMarginRevert,
} from "@/functions/marginRevert";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { MARGIN_TRADING_ADDRESS } from "@/sdk_bi/addresses";
import { useMarginRevertStore } from "@/stores/useMarginRevertStore";

// Dex223MarginModule.MAX_FREEZE_DURATION: after this a liquidate() call places a new freeze
// instead of completing the liquidation.
const MAX_FREEZE_DURATION = BigInt(3600);

// Reverts that mean someone else closed the position first (Dario, position 53: the UI's second
// call reverted MM22 after the first one had already completed the liquidation).
const CLOSED_CODES = new Set(["MM22", "MM28"]);

class LiquidationStop extends Error {
  constructor(
    readonly status: PositionLiquidateStatus,
    readonly revert?: MarginRevert,
  ) {
    super("liquidation stopped");
  }
}

/**
 * liquidate() freezes a position when it has no live freeze, and completes the liquidation when a
 * freeze from an earlier block is still live. Read the position first so only the calls still
 * needed are sent, simulate each call so a revert shows its reason before the wallet opens, and
 * confirm on chain that the position closed (a call that lands after the freeze lapsed only
 * re-freezes, and its receipt still succeeds).
 */
export default function useLiquidatePosition(position: MarginPosition) {
  const { data: walletClient } = useMarginWalletClient("liquidatePosition");
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useCurrentChainId();

  // Gas preview for the next liquidate() call (freeze or completion: same calldata).
  useMarginGasEstimate("liquidatePosition", () => {
    if (position.isLiquidated || !address) return;
    return {
      abi: MARGIN_MODULE_ABI,
      address: MARGIN_TRADING_ADDRESS[chainId],
      functionName: "liquidate",
      args: [BigInt(position.id), address],
    };
  });
  const { setStatus, setPositionLiquidateHash, setPositionFreezeHash } =
    usePositionLiquidateStatusStore();
  const setRevert = useMarginRevertStore((s) => s.setRevert);

  const handleLiquidatePosition = useCallback(async () => {
    if (!isMarginDeployed(chainId) || !walletClient || !publicClient || !position || !address)
      return;

    const moduleAddress = MARGIN_TRADING_ADDRESS[chainId] as Address;
    const positionId = BigInt(position.id);

    const readPosition = () =>
      publicClient.readContract({
        abi: MARGIN_MODULE_ABI,
        address: moduleAddress,
        functionName: "positions",
        args: [positionId],
      });

    // Simulate, then send and wait. Throws LiquidationStop with the state to show on failure.
    const send = async (
      errorStatus: PositionLiquidateStatus,
      loadingStatus: PositionLiquidateStatus,
      onHash: (hash: Hash) => void,
    ) => {
      let hash: Hash;
      try {
        const { request } = await publicClient.simulateContract({
          abi: MARGIN_MODULE_ABI,
          address: moduleAddress,
          functionName: "liquidate",
          args: [positionId, address],
          account: address,
        });
        // useMarginWalletClient adds the gas settings and limit from the dialog.
        hash = await walletClient.writeContract({ ...request, account: undefined });
      } catch (error) {
        if (isUserRejection(error)) throw new LiquidationStop(PositionLiquidateStatus.INITIAL);
        const code = getMarginRevertCode(error);
        if (code && CLOSED_CODES.has(code)) {
          throw new LiquidationStop(PositionLiquidateStatus.ALREADY_CLOSED);
        }
        throw new LiquidationStop(errorStatus, toMarginRevert(error));
      }
      onHash(hash);
      setStatus(loadingStatus);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new LiquidationStop(errorStatus, await getMinedRevert(publicClient, hash));
      }
      return receipt;
    };

    setRevert("liquidate", undefined);
    let failureStatus = PositionLiquidateStatus.ERROR_LIQUIDATE;
    try {
      const current = await readPosition();
      // positions()[6] is `open`, [7] is `frozenTime`.
      if (!current[6]) {
        setStatus(PositionLiquidateStatus.ALREADY_CLOSED);
        return;
      }

      const block = await publicClient.getBlock({ blockTag: "latest" });
      let frozenAt = current[7];

      // Fresh positions and lapsed freezes need a freeze call; a live freeze only needs the
      // completing call.
      if (frozenAt === BigInt(0) || block.timestamp - frozenAt > MAX_FREEZE_DURATION) {
        failureStatus = PositionLiquidateStatus.ERROR_FREEZE;
        setStatus(PositionLiquidateStatus.PENDING_FREEZE);
        const receipt = await send(
          PositionLiquidateStatus.ERROR_FREEZE,
          PositionLiquidateStatus.LOADING_FREEZE,
          setPositionFreezeHash,
        );
        const after = await readPosition();
        if (!after[6]) {
          setStatus(PositionLiquidateStatus.ALREADY_CLOSED);
          return;
        }
        frozenAt = (await publicClient.getBlock({ blockNumber: receipt.blockNumber })).timestamp;
      }

      // The completing call must land in a later block than the freeze (MM24).
      failureStatus = PositionLiquidateStatus.ERROR_LIQUIDATE;
      setStatus(PositionLiquidateStatus.LOADING_BLOCK_CONFIRMATION);
      for (let i = 0; i < 40; i++) {
        if ((await publicClient.getBlock({ blockTag: "latest" })).timestamp > frozenAt) break;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      setStatus(PositionLiquidateStatus.PENDING_LIQUIDATE);
      await send(
        PositionLiquidateStatus.ERROR_LIQUIDATE,
        PositionLiquidateStatus.LOADING_LIQUIDATE,
        setPositionLiquidateHash,
      );

      const liquidated = await readPosition();
      setStatus(
        liquidated[6] ? PositionLiquidateStatus.FREEZE_RENEWED : PositionLiquidateStatus.SUCCESS,
      );
    } catch (error) {
      if (error instanceof LiquidationStop) {
        setRevert("liquidate", error.revert);
        setStatus(error.status);
        return;
      }
      console.error(error);
      setRevert("liquidate", toMarginRevert(error));
      setStatus(failureStatus);
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
