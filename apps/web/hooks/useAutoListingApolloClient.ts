import { ApolloClient, ApolloLink, concat, HttpLink, InMemoryCache } from "@apollo/client";
import { useMemo } from "react";

import useCurrentChainId from "@/hooks/useCurrentChainId";
import { subgraphProxyPath } from "@/lib/subgraphTargets";
import { DexChainId } from "@/sdk_bi/chains";

const autoListingUrlMap: Record<DexChainId, string> = {
  // Gateway subgraph: queried through our server, which holds the API key.
  [DexChainId.MAINNET]: subgraphProxyPath("autolisting-mainnet"),
  [DexChainId.SEPOLIA]:
    "https://api.studio.thegraph.com/query/1760635/dex-223-auto-listing-sepolia/version/latest",
  [DexChainId.BSC_TESTNET]:
    "https://api.studio.thegraph.com/query/56540/dex223-auto-listing-chapel/version/latest/",
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

export default function useAutoListingApolloClient() {
  const chainId = useCurrentChainId();

  const authMiddleware = useMemo(() => {
    return new ApolloLink((operation, forward) => {
      operation.setContext(() => ({
        uri: autoListingUrlMap[chainId],
      }));

      return forward(operation);
    });
  }, [chainId]);

  return useMemo(() => {
    return new ApolloClient({
      cache: new InMemoryCache(),
      link: concat(
        authMiddleware,
        new HttpLink({
          uri: autoListingUrlMap[chainId],
        }),
      ),
    });
  }, [authMiddleware, chainId]);
}
