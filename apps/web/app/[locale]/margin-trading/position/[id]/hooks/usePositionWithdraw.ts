import { useCallback } from "react";
import { encodeFunctionData } from "viem";
import { usePublicClient } from "wagmi";

import { useMarginWriteGas } from "@/app/[locale]/margin-trading/components/MarginGasSettings";
import useMarginGasEstimate from "@/app/[locale]/margin-trading/hooks/useMarginGasEstimate";
import useMarginWalletClient from "@/app/[locale]/margin-trading/hooks/useMarginWalletClient";
import {
  PositionWithdrawStatus,
  useWithdrawPositionStatusStore,
} from "@/app/[locale]/margin-trading/position/[id]/stores/usePositionWithdrawStatusStore";
import { MarginPosition } from "@/app/[locale]/margin-trading/types";
import { MARGIN_MODULE_ABI } from "@/config/abis/marginModule";
import { isMarginDeployed } from "@/config/modules";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { MARGIN_TRADING_ADDRESS } from "@/sdk_bi/addresses";

export default function usePositionWithdraw({ position }: { position: MarginPosition }) {
  const { setStatus } = useWithdrawPositionStatusStore();
  const chainId = useCurrentChainId();
  const gasOverrides = useMarginWriteGas("withdrawPosition");
  const { data: walletClient } = useMarginWalletClient("withdrawPosition");

  const publicClient = usePublicClient();

  useMarginGasEstimate("withdrawPosition", () => {
    if (!position.isClosed) return;
    const calls = position.assetAddresses
      .filter((asset) => asset.balance > 0n)
      .map((asset) =>
        encodeFunctionData({
          abi: MARGIN_MODULE_ABI,
          functionName: "positionWithdraw",
          args: [BigInt(position.id), asset.address],
        }),
      );
    if (!calls.length) return;
    return {
      abi: MARGIN_MODULE_ABI,
      address: MARGIN_TRADING_ADDRESS[chainId],
      functionName: "multicall",
      args: [calls],
    };
  });

  const handlePositionWithdraw = useCallback(async () => {
    // Never build a transaction against the zero address on chains without a margin deployment.
    if (!isMarginDeployed(chainId)) {
      return;
    }

    if (!walletClient || !publicClient || !position.isClosed) {
      return;
    }

    setStatus(PositionWithdrawStatus.PENDING_WITHDRAW);

    try {
      // Preserve the exact on-chain address, including ERC-223 and native assets.
      const encodedWithdrawData = position.assetAddresses
        .filter((asset) => asset.balance > 0n)
        .map((asset) => {
          return encodeFunctionData({
            abi: MARGIN_MODULE_ABI,
            functionName: "positionWithdraw",
            args: [
              BigInt(position.id), // _orderId
              asset.address,
            ],
          });
        });

      if (encodedWithdrawData.length === 0) {
        setStatus(PositionWithdrawStatus.ERROR_WITHDRAW);
        return;
      }

      const withdrawPositionHash = await walletClient.writeContract({
        ...gasOverrides,
        abi: MARGIN_MODULE_ABI,
        address: MARGIN_TRADING_ADDRESS[chainId],
        functionName: "multicall",
        args: [encodedWithdrawData],
        account: undefined,
      });
      setStatus(PositionWithdrawStatus.LOADING_WITHDRAW);

      const receipt = await publicClient.waitForTransactionReceipt({ hash: withdrawPositionHash });

      if (receipt.status === "success") {
        setStatus(PositionWithdrawStatus.SUCCESS);
      } else {
        setStatus(PositionWithdrawStatus.ERROR_WITHDRAW);
      }
    } catch (e) {
      console.error(e);
      setStatus(PositionWithdrawStatus.ERROR_WITHDRAW);
    }

    return;
  }, [
    chainId,
    gasOverrides,
    position.assetAddresses,
    position.id,
    position.isClosed,
    publicClient,
    setStatus,
    walletClient,
  ]);

  return { handlePositionWithdraw };
}

/**
 * Whether withdrawing `position` sends any ERC-223 token: positionWithdraw transfers each asset at
 * the exact address the position holds, and an ERC-223 address is delivered as ERC-223, which a
 * smart account (EIP-7702) can't receive.
 */
export function positionWithdrawDeliversErc223(position: MarginPosition): boolean {
  const erc20 = new Set(position.assets.map((asset) => asset.wrapped.address0.toLowerCase()));
  const erc223 = new Set(position.assets.map((asset) => asset.wrapped.address1.toLowerCase()));
  return position.assetAddresses.some(({ address, balance }) => {
    const a = address.toLowerCase();
    return balance > 0n && erc223.has(a) && !erc20.has(a);
  });
}
