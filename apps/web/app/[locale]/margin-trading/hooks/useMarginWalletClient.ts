import { useMemo } from "react";
import { usePublicClient, useWalletClient } from "wagmi";

import {
  MarginGasOperation,
  useMarginWriteGas,
  useOperationStores,
} from "@/app/[locale]/margin-trading/components/MarginGasSettings";
import {
  getMarginGasLimit,
  getMarginGasRequest,
  getMarginGasRequestKey,
  MarginGasRequest,
} from "@/app/[locale]/margin-trading/helpers/marginGas";
import useCurrentChainId from "@/hooks/useCurrentChainId";

export default function useMarginWalletClient(operation: MarginGasOperation) {
  const result = useWalletClient();
  const chainId = useCurrentChainId();
  const publicClient = usePublicClient({ chainId });
  const stores = useOperationStores(operation);
  const gasOverrides = useMarginWriteGas(operation);
  const walletClient = result.data;

  const data = useMemo(() => {
    if (!walletClient || !publicClient) return undefined;
    const writeContract: typeof walletClient.writeContract = async (request) => {
      // Viem's generic args resolve to unknown here; callers retain its full ABI validation.
      const gasRequest = request as MarginGasRequest;
      if (walletClient.chain.id !== chainId || stores.chainId !== chainId) {
        throw new Error("Wallet network changed; review the transaction again");
      }
      const requestKey = getMarginGasRequestKey(gasRequest, chainId, walletClient.account.address);
      let estimatedGas = 0n;
      try {
        // Every step is estimated with its own calldata after earlier receipts have confirmed.
        estimatedGas = await publicClient.estimateGas({
          ...getMarginGasRequest(gasRequest),
          account: walletClient.account,
          ...gasOverrides,
        });
      } catch {
        // Keep the last preview as a validation floor if the RPC estimate is unavailable.
        if (requestKey === stores.requestKey)
          estimatedGas = stores.useLimit.getState().estimatedGas;
      }
      const matchesPreview = requestKey === stores.requestKey;
      const { customGasLimit } = stores.useLimit.getState();
      if (matchesPreview) stores.useLimit.getState().setEstimatedGas(estimatedGas);
      const gas = getMarginGasLimit(customGasLimit, estimatedGas, matchesPreview);
      const hash = await walletClient.writeContract({ ...request, ...gasOverrides, gas });
      // A limit edits one transaction. It must not carry into a later transfer, deposit or liquidation.
      if (
        stores.requestKey === requestKey &&
        stores.useLimit.getState().customGasLimit === customGasLimit
      ) {
        stores.useLimit.getState().setCustomGasLimit(undefined);
      }
      return hash;
    };
    return { ...walletClient, writeContract };
  }, [chainId, gasOverrides, publicClient, stores, walletClient]);

  return { ...result, data };
}
