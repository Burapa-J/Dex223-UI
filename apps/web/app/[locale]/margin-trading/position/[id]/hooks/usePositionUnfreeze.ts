import { useCallback, useState } from "react";
import { getAbiItem } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";

import { MarginPosition } from "@/app/[locale]/margin-trading/types";
import { MARGIN_MODULE_ABI } from "@/config/abis/marginModule";
import { isMarginDeployed } from "@/config/modules";
import { getTransactionWithRetries } from "@/functions/getTransactionWithRetries";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { MARGIN_TRADING_ADDRESS } from "@/sdk_bi/addresses";
import {
  GasFeeModel,
  RecentTransactionTitleTemplate,
  stringifyObject,
  useRecentTransactionsStore,
} from "@/stores/useRecentTransactionsStore";

export default function usePositionUnfreeze(
  position: MarginPosition,
  onSuccess?: () => void | Promise<unknown>,
) {
  const chainId = useCurrentChainId();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { addRecentTransaction } = useRecentTransactionsStore();
  const [pending, setPending] = useState(false);

  const unfreeze = useCallback(async () => {
    if (!isMarginDeployed(chainId) || !walletClient || !publicClient || !address || pending) {
      return;
    }

    setPending(true);

    const params = {
      abi: MARGIN_MODULE_ABI,
      address: MARGIN_TRADING_ADDRESS[chainId],
      functionName: "unfreeze" as const,
      args: [BigInt(position.id)] as const,
    };

    try {
      const hash = await walletClient.writeContract({
        ...params,
        account: undefined,
      });

      const transaction = await getTransactionWithRetries({
        hash,
        publicClient,
      });

      addRecentTransaction(
        {
          hash,
          nonce: transaction.nonce,
          chainId,
          gas: {
            model: GasFeeModel.EIP1559,
            gas: "0",
            maxFeePerGas: undefined,
            maxPriorityFeePerGas: undefined,
          },
          params: {
            ...stringifyObject(params),
            abi: [getAbiItem({ name: "unfreeze", abi: MARGIN_MODULE_ABI })],
          },
          title: {
            template: RecentTransactionTitleTemplate.UNFREEZE_MARGIN_POSITION,
            symbol: position.loanAsset.symbol!,
            positionId: position.id,
            logoURI: position.loanAsset?.logoURI || "/images/tokens/placeholder.svg",
          },
        },
        address,
      );

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        await onSuccess?.();
      } else {
        console.error("Unfreeze transaction reverted", hash);
      }
    } catch (error) {
      console.error("Failed to unfreeze margin position", error);
    } finally {
      setPending(false);
    }
  }, [
    addRecentTransaction,
    address,
    chainId,
    pending,
    position.id,
    position.loanAsset?.logoURI,
    onSuccess,
    position.loanAsset.symbol,
    publicClient,
    walletClient,
  ]);

  return { unfreeze, pending };
}
