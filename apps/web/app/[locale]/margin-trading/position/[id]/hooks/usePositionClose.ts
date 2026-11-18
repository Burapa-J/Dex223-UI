import { useCallback } from "react";
import { getAbiItem } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";

import {
  PositionCloseStatus,
  usePositionCloseStatusStore,
} from "@/app/[locale]/margin-trading/position/[id]/stores/usePositionCloseStatusStore";
import { MarginPosition } from "@/app/[locale]/margin-trading/types";
import { MARGIN_MODULE_ABI } from "@/config/abis/marginModule";
import { isMarginDeployed } from "@/config/modules";
import { getTransactionWithRetries } from "@/functions/getTransactionWithRetries";
import { getMinedRevert, isUserRejection, toMarginRevert } from "@/functions/marginRevert";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { MARGIN_TRADING_ADDRESS } from "@/sdk_bi/addresses";
import { useMarginRevertStore } from "@/stores/useMarginRevertStore";
import {
  GasFeeModel,
  RecentTransactionTitleTemplate,
  stringifyObject,
  useRecentTransactionsStore,
} from "@/stores/useRecentTransactionsStore";

export default function usePositionClose({ position }: { position: MarginPosition }) {
  const { setStatus, setPositionCloseHash } = usePositionCloseStatusStore();
  const chainId = useCurrentChainId();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { addRecentTransaction } = useRecentTransactionsStore();
  const setRevert = useMarginRevertStore((s) => s.setRevert);

  const handlePositionClose = useCallback(async () => {
    // Never build a transaction against the zero address on chains without a margin deployment.
    if (!isMarginDeployed(chainId)) {
      return;
    }

    if (!walletClient || !publicClient || !address) {
      return;
    }

    setRevert("close", undefined);
    setStatus(PositionCloseStatus.PENDING_CLOSE);

    const params = {
      abi: MARGIN_MODULE_ABI,
      address: MARGIN_TRADING_ADDRESS[chainId],
      functionName: "positionClose" as const,
      args: [BigInt(position.id), true] as const,
    };

    // Simulate first: a revert (MM29 not yet matured, MM30 liquidatable, MM31 holdings short of the
    // debt) shows its reason instead of the dialog failing silently.
    let closePositionHash;
    try {
      const { request } = await publicClient.simulateContract({ ...params, account: address });
      closePositionHash = await walletClient.writeContract({ ...request, account: undefined });
    } catch (error) {
      if (isUserRejection(error)) {
        setStatus(PositionCloseStatus.INITIAL);
      } else {
        setRevert("close", toMarginRevert(error));
        setStatus(PositionCloseStatus.ERROR_CLOSE);
      }
      return;
    }
    setStatus(PositionCloseStatus.LOADING_CLOSE);
    setPositionCloseHash(closePositionHash);

    const transaction = await getTransactionWithRetries({
      hash: closePositionHash,
      publicClient,
    });

    const nonce = transaction.nonce;

    addRecentTransaction(
      {
        hash: closePositionHash,
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
          abi: [getAbiItem({ name: "positionClose", abi: MARGIN_MODULE_ABI })],
        },
        title: {
          template: RecentTransactionTitleTemplate.CLOSE_MARGIN_POSITION,
          symbol: position.loanAsset.symbol!,
          positionId: position.id,
          logoURI: position.loanAsset?.logoURI || "/images/tokens/placeholder.svg",
        },
      },
      address,
    );

    const receipt = await publicClient.waitForTransactionReceipt({ hash: closePositionHash });

    if (receipt.status === "success") {
      setStatus(PositionCloseStatus.SUCCESS);
    } else {
      setRevert("close", await getMinedRevert(publicClient, closePositionHash));
      setStatus(PositionCloseStatus.ERROR_CLOSE);
    }

    return;
  }, [
    addRecentTransaction,
    address,
    chainId,
    position.id,
    position.loanAsset?.logoURI,
    position.loanAsset.symbol,
    publicClient,
    setPositionCloseHash,
    setRevert,
    setStatus,
    walletClient,
  ]);

  return { handlePositionClose };
}
