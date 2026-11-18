import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAccount, usePublicClient } from "wagmi";

import {
  MarginGasOperation,
  useOperationStores,
} from "@/app/[locale]/margin-trading/components/MarginGasSettings";
import {
  getMarginGasRequest,
  getMarginGasRequestKey,
  MarginGasRequest,
} from "@/app/[locale]/margin-trading/helpers/marginGas";
import { isMarginDeployed } from "@/config/modules";
import useCurrentChainId from "@/hooks/useCurrentChainId";

// The builder can be unavailable while an amount, token or order is still being entered.
export default function useMarginGasEstimate<TRequest extends MarginGasRequest>(
  operation: MarginGasOperation,
  buildRequest: () => TRequest | undefined,
) {
  const chainId = useCurrentChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId });
  const stores = useOperationStores(operation);
  let request: TRequest | undefined;
  let requestKey: string | undefined;
  try {
    request = isMarginDeployed(chainId) ? buildRequest() : undefined;
    requestKey = request && address ? getMarginGasRequestKey(request, chainId, address) : undefined;
  } catch {
    // Invalid or incomplete form input has no estimate yet.
    request = undefined;
  }

  const { data: estimatedGas } = useQuery({
    queryKey: ["marginGas", operation, requestKey],
    queryFn: () =>
      publicClient!.estimateGas({ ...getMarginGasRequest(request!), account: address! }),
    enabled: Boolean(requestKey && publicClient && request),
    retry: false,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (stores.requestKey !== requestKey) {
      stores.useLimit.getState().setCustomGasLimit(undefined);
      stores.requestKey = requestKey;
    }
    stores.useLimit.getState().setEstimatedGas(estimatedGas ?? 0n);
  }, [estimatedGas, requestKey, stores]);

  return request;
}
