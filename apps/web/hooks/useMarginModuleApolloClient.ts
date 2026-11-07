import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { useMemo } from "react";

import { isMarginDeployed } from "@/config/modules";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { subgraphProxyPath } from "@/lib/subgraphTargets";
import { DexChainId } from "@/sdk_bi/chains";

const marginModuleUrlMap: Record<DexChainId, string> = {
  // Gateway subgraph: queried through our server, which holds the API key.
  [DexChainId.MAINNET]: subgraphProxyPath("margin-mainnet"),
  [DexChainId.SEPOLIA]:
    "https://api.studio.thegraph.com/query/1760635/dex-223-margin-sepolia/version/latest",
  [DexChainId.BSC_TESTNET]: "",
  [DexChainId.EOS]: "",
  [DexChainId.BASE]: "",
  [DexChainId.BSC]: "",
  [DexChainId.ARBITRUM]: "",
  [DexChainId.POLYGON]: "",
  [DexChainId.AVALANCHE]: "",
  [DexChainId.OPTIMISM]: "",
  [DexChainId.MONAD]: "",
  [DexChainId.UNICHAIN]: "",
  [DexChainId.PLASMA]: "",
  [DexChainId.SONIC]: "",
  [DexChainId.LINEA]: "",
  [DexChainId.INK]: "",
  [DexChainId.MANTLE]: "",
};

const clients = new Map<DexChainId, ApolloClient<unknown>>();

function getMarginClient(chainId: DexChainId) {
  const uri = marginModuleUrlMap[chainId];
  if (!uri || !isMarginDeployed(chainId)) return undefined;
  let client = clients.get(chainId);
  if (!client) {
    client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new HttpLink({ uri }),
    });
    clients.set(chainId, client);
  }
  return client;
}

export default function useMarginModuleApolloClient() {
  const chainId = useCurrentChainId();
  return useMemo(() => getMarginClient(chainId), [chainId]);
}

// The subgraph indexes a margin transaction a few seconds after it is mined, and the margin pages
// only poll every 30 s (and serve cached results to pages opened later), so positions and lending
// orders looked unchanged after a margin swap until a reload. Refetch every margin query now and
// twice more while the subgraph catches up.
const REFRESH_DELAYS_MS = [0, 4000, 12000];

export function refreshMarginQueries(chainId: DexChainId) {
  const client = getMarginClient(chainId);
  if (!client) return;
  REFRESH_DELAYS_MS.forEach((delay) => {
    setTimeout(() => {
      client.refetchQueries({ include: "all" }).catch(() => {
        // A failed refetch only leaves the old data; the 30 s poll still runs.
      });
    }, delay);
  });
}
