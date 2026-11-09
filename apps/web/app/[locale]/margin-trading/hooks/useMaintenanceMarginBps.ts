import { useReadContract } from "wagmi";

import { MARGIN_MODULE_ABI } from "@/config/abis/marginModule";
import { isMarginDeployed } from "@/config/modules";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { MARGIN_TRADING_ADDRESS } from "@/sdk_bi/addresses";

export default function useMaintenanceMarginBps() {
  const chainId = useCurrentChainId();

  const { data } = useReadContract({
    abi: MARGIN_MODULE_ABI,
    address: MARGIN_TRADING_ADDRESS[chainId],
    functionName: "MAINTENANCE_MARGIN_BPS",
    query: {
      enabled: isMarginDeployed(chainId),
    },
  });

  return data;
}
