import { useCallback } from "react";
import { getAbiItem } from "viem";
import { useAccount, usePublicClient } from "wagmi";

import { useMarginWriteGas } from "@/app/[locale]/margin-trading/components/MarginGasSettings";
import useMarginGasEstimate from "@/app/[locale]/margin-trading/hooks/useMarginGasEstimate";
import useMarginWalletClient from "@/app/[locale]/margin-trading/hooks/useMarginWalletClient";
import {
  OrderCloseStatus,
  useCloseOrderStatusStore,
} from "@/app/[locale]/margin-trading/lending-order/[id]/stores/useCloseOrderStatusStore";
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

export default function useOrderClose({ order }: { order: LendingOrder }) {
  const { setCloseOrderHash, setStatus, setErrorType } = useCloseOrderStatusStore();
  const { data: walletClient } = useMarginWalletClient("closeOrder");
  const publicClient = usePublicClient();
  const { addRecentTransaction } = useRecentTransactionsStore();
  const chainId = useCurrentChainId();
  const gasOverrides = useMarginWriteGas("closeOrder");
  const { address } = useAccount();

  useMarginGasEstimate("closeOrder", () => {
    return {
      abi: MARGIN_MODULE_ABI,
      address: MARGIN_TRADING_ADDRESS[chainId],
      functionName: "setOrderStatus",
      args: [BigInt(order.id), false],
    };
  });

  const handleOrderClose = useCallback(
    async (orderId: number) => {
      // Never build a transaction against the zero address on chains without a margin deployment.
      if (!isMarginDeployed(chainId)) {
        return;
      }

      if (!walletClient || !publicClient || !address) {
        return;
      }

      try {
        setStatus(OrderCloseStatus.PENDING_CLOSE_ORDER);

        const params = {
          abi: MARGIN_MODULE_ABI,
          address: MARGIN_TRADING_ADDRESS[chainId],
          functionName: "setOrderStatus" as const,
          args: [BigInt(orderId), false] as const,
        };

        const hash = await walletClient.writeContract({
          ...gasOverrides,
          ...params,
        });

        setCloseOrderHash(hash);

        setStatus(OrderCloseStatus.LOADING_CLOSE_ORDER);

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
              template: RecentTransactionTitleTemplate.CLOSE_LENDING_ORDER,
              logoURI: order.baseAsset?.logoURI || "/images/tokens/placeholder.svg",
            },
          },
          address,
        );

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "success") {
          setStatus(OrderCloseStatus.SUCCESS);
        }

        if (receipt.status === "reverted") {
          setStatus(OrderCloseStatus.ERROR_CLOSE_ORDER);
          setErrorType(SwapError.UNKNOWN);
        }
      } catch (e) {
        setStatus(OrderCloseStatus.ERROR_CLOSE_ORDER);
      }
    },
    [
      addRecentTransaction,
      address,
      chainId,
      gasOverrides,
      order.baseAsset?.logoURI,
      order.baseAsset.symbol,
      publicClient,
      setCloseOrderHash,
      setErrorType,
      setStatus,
      walletClient,
    ],
  );

  return { handleOrderClose };
}
