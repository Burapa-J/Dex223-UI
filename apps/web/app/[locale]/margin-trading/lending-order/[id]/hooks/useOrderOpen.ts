import { useCallback } from "react";
import { getAbiItem } from "viem";
import { useAccount, usePublicClient } from "wagmi";

import { useMarginWriteGas } from "@/app/[locale]/margin-trading/components/MarginGasSettings";
import useMarginGasEstimate from "@/app/[locale]/margin-trading/hooks/useMarginGasEstimate";
import useMarginWalletClient from "@/app/[locale]/margin-trading/hooks/useMarginWalletClient";
import {
  OpenOrderStatus,
  useOpenOrderStatusStore,
} from "@/app/[locale]/margin-trading/lending-order/[id]/stores/useOpenOrderStatusStore";
import { LendingOrder } from "@/app/[locale]/margin-trading/types";
import { SwapError } from "@/app/[locale]/swap/stores/useSwapStatusStore";
import { MARGIN_MODULE_ABI } from "@/config/abis/marginModule";
import { isMarginDeployed } from "@/config/modules";
import { getTransactionWithRetries } from "@/functions/getTransactionWithRetries";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { MARGIN_TRADING_ADDRESS } from "@/sdk_bi/addresses";
import { DexChainId } from "@/sdk_bi/chains";
import {
  GasFeeModel,
  RecentTransactionTitleTemplate,
  stringifyObject,
  useRecentTransactionsStore,
} from "@/stores/useRecentTransactionsStore";

export default function useOrderOpen({ order }: { order: LendingOrder }) {
  const { setOpenOrderHash, setStatus, setErrorType } = useOpenOrderStatusStore();
  const { data: walletClient } = useMarginWalletClient("openOrder");
  const publicClient = usePublicClient();
  const { addRecentTransaction } = useRecentTransactionsStore();
  const chainId = useCurrentChainId();
  const gasOverrides = useMarginWriteGas("openOrder");
  const { address } = useAccount();

  useMarginGasEstimate("openOrder", () => {
    return {
      abi: MARGIN_MODULE_ABI,
      address: MARGIN_TRADING_ADDRESS[chainId],
      functionName: "setOrderStatus",
      args: [BigInt(order.id), true],
    };
  });

  const handleOrderOpen = useCallback(
    async (orderId: number) => {
      // Never build a transaction against the zero address on chains without a margin deployment.
      if (!isMarginDeployed(chainId)) {
        return;
      }

      if (!walletClient || !publicClient || !address) {
        return;
      }

      setStatus(OpenOrderStatus.PENDING_OPEN_ORDER);
      try {
        const params = {
          abi: MARGIN_MODULE_ABI,
          address: MARGIN_TRADING_ADDRESS[chainId],
          functionName: "setOrderStatus" as const,
          args: [BigInt(orderId), true] as const,
        };

        const hash = await walletClient.writeContract({
          ...gasOverrides,
          ...params,
        });

        setOpenOrderHash(hash);

        setStatus(OpenOrderStatus.LOADING_OPEN_ORDER);

        const transaction = await getTransactionWithRetries({
          hash,
          publicClient,
        });

        const nonce = transaction.nonce;

        addRecentTransaction(
          {
            hash,
            nonce,
            chainId,
            gas: {
              model: GasFeeModel.EIP1559,
              gas: "0",
              maxFeePerGas: undefined,
              maxPriorityFeePerGas: undefined,
            },
            params: {
              ...stringifyObject(params),
              abi: [getAbiItem({ name: "setOrderStatus", abi: MARGIN_MODULE_ABI })],
            },
            title: {
              symbol: order.baseAsset.symbol!,
              orderId,
              template: RecentTransactionTitleTemplate.OPEN_LENDING_ORDER,
              logoURI: order.baseAsset?.logoURI || "/images/tokens/placeholder.svg",
            },
          },
          address,
        );

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "success") {
          setStatus(OpenOrderStatus.SUCCESS);
        }

        if (receipt.status === "reverted") {
          setErrorType(SwapError.UNKNOWN);
          setStatus(OpenOrderStatus.ERROR_OPEN_ORDER);
        }
      } catch (e) {
        setStatus(OpenOrderStatus.ERROR_OPEN_ORDER);
      }
    },
    [
      walletClient,
      publicClient,
      address,
      setStatus,
      setOpenOrderHash,
      addRecentTransaction,
      chainId,
      gasOverrides,
      order.baseAsset.symbol,
      order.baseAsset?.logoURI,
      setErrorType,
    ],
  );

  return { handleOrderOpen };
}
