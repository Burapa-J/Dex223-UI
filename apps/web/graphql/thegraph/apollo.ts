import {
  ApolloClient,
  ApolloLink,
  concat,
  HttpLink,
  InMemoryCache,
  NormalizedCacheObject,
} from "@apollo/client";

import { subgraphProxyPath } from "@/lib/subgraphTargets";
import { DexChainId } from "@/sdk_bi/chains";

export const CHAIN_SUBGRAPH_URL: Record<DexChainId, string> = {
  // [ChainId.MAINNET]: "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3?source=uniswap",
  // [ChainId.ARBITRUM_ONE]:
  //   "https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-arbitrum-one?source=uniswap",
  // [ChainId.OPTIMISM]:
  //   "https://api.thegraph.com/subgraphs/name/ianlapham/optimism-post-regenesis?source=uniswap",
  // [ChainId.POLYGON]:
  //   "https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-polygon?source=uniswap",
  // [ChainId.CELO]: "https://api.thegraph.com/subgraphs/name/jesse-sawa/uniswap-celo?source=uniswap",
  // [ChainId.BNB]: "https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-bsc?source=uniswap",
  // [ChainId.AVALANCHE]:
  //   "https://api.thegraph.com/subgraphs/name/lynnshaoyu/uniswap-v3-avax?source=uniswap",
  // [ChainId.BASE]:
  //   "https://api.studio.thegraph.com/query/48211/uniswap-v3-base/version/latest?source=uniswap",
  // The gateway needs an API key, so mainnet goes through our server (key never in the bundle).
  [DexChainId.MAINNET]: subgraphProxyPath("exchange-mainnet"),
  [DexChainId.SEPOLIA]:
    "https://api.studio.thegraph.com/query/1760635/dex-223-v-1-sepolia/version/latest",
  // [DexChainId.CALLISTO]: "",
  // Chapel Studio deploy 1.0.82 is gone ("Not found"). Leave empty until a live
  // BSC Testnet subgraph URL is published; callers must skip when unset.
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

const httpLink = new HttpLink({ uri: CHAIN_SUBGRAPH_URL[DexChainId.MAINNET] });
const httpLinkSep = new HttpLink({ uri: CHAIN_SUBGRAPH_URL[DexChainId.SEPOLIA] });

/** True when this chain has a non-empty core subgraph query URL. */
export function isSubgraphConfigured(chainId: DexChainId): boolean {
  return Boolean(CHAIN_SUBGRAPH_URL[chainId]);
}

export function getAuthMiddleware(chainId: DexChainId) {
  return new ApolloLink((operation, forward) => {
    operation.setContext(() => ({
      uri:
        chainId && CHAIN_SUBGRAPH_URL[chainId]
          ? CHAIN_SUBGRAPH_URL[chainId]
          : CHAIN_SUBGRAPH_URL[DexChainId.SEPOLIA],
    }));

    return forward(operation);
  });
}

export function apolloClient(chainId: DexChainId) {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: concat(getAuthMiddleware(chainId), httpLink),
  });
}

export const chainToApolloClient: Record<DexChainId, ApolloClient<NormalizedCacheObject>> = {
  [DexChainId.MAINNET]: new ApolloClient({
    cache: new InMemoryCache(),
    link: concat(getAuthMiddleware(DexChainId.MAINNET), httpLink),
  }),
  // [ChainId.ARBITRUM_ONE]: new ApolloClient({
  //   cache: new InMemoryCache(),
  //   uri: CHAIN_SUBGRAPH_URL[ChainId.ARBITRUM_ONE],
  // }),
  // [ChainId.OPTIMISM]: new ApolloClient({
  //   cache: new InMemoryCache(),
  //   uri: CHAIN_SUBGRAPH_URL[ChainId.OPTIMISM],
  // }),
  // [ChainId.POLYGON]: new ApolloClient({
  //   cache: new InMemoryCache(),
  //   uri: CHAIN_SUBGRAPH_URL[ChainId.POLYGON],
  // }),
  // [ChainId.CELO]: new ApolloClient({
  //   cache: new InMemoryCache(),
  //   uri: CHAIN_SUBGRAPH_URL[ChainId.CELO],
  // }),
  // [ChainId.BNB]: new ApolloClient({
  //   cache: new InMemoryCache(),
  //   uri: CHAIN_SUBGRAPH_URL[ChainId.BNB],
  // }),
  // [ChainId.AVALANCHE]: new ApolloClient({
  //   cache: new InMemoryCache(),
  //   uri: CHAIN_SUBGRAPH_URL[ChainId.AVALANCHE],
  // }),
  [DexChainId.SEPOLIA]: new ApolloClient({
    cache: new InMemoryCache(),
    link: concat(getAuthMiddleware(DexChainId.SEPOLIA), httpLinkSep),
  }),
  // Do not fall back to Sepolia. When a Chapel URL is restored, wire it like SEPOLIA.
  [DexChainId.BSC_TESTNET]: CHAIN_SUBGRAPH_URL[DexChainId.BSC_TESTNET]
    ? new ApolloClient({
        cache: new InMemoryCache(),
        link: authLink.concat(
          concat(
            getAuthMiddleware(DexChainId.BSC_TESTNET),
            new HttpLink({ uri: CHAIN_SUBGRAPH_URL[DexChainId.BSC_TESTNET] }),
          ),
        ),
      })
    : new ApolloClient({
        cache: new InMemoryCache(),
        uri: "",
      }),
  [DexChainId.EOS]: new ApolloClient({
    cache: new InMemoryCache(),
    uri: CHAIN_SUBGRAPH_URL[DexChainId.EOS],
  }),
  [DexChainId.BASE]: new ApolloClient({
    cache: new InMemoryCache(),
    uri: CHAIN_SUBGRAPH_URL[DexChainId.BASE],
  }),
  [DexChainId.BSC]: new ApolloClient({
    cache: new InMemoryCache(),
    uri: CHAIN_SUBGRAPH_URL[DexChainId.BSC],
  }),
  [DexChainId.ARBITRUM]: new ApolloClient({
    cache: new InMemoryCache(),
    uri: CHAIN_SUBGRAPH_URL[DexChainId.ARBITRUM],
  }),
  [DexChainId.POLYGON]: new ApolloClient({
    cache: new InMemoryCache(),
    uri: CHAIN_SUBGRAPH_URL[DexChainId.POLYGON],
  }),
  [DexChainId.AVALANCHE]: new ApolloClient({
    cache: new InMemoryCache(),
    uri: CHAIN_SUBGRAPH_URL[DexChainId.AVALANCHE],
  }),
  [DexChainId.OPTIMISM]: new ApolloClient({
    cache: new InMemoryCache(),
    uri: CHAIN_SUBGRAPH_URL[DexChainId.OPTIMISM],
  }),
  [DexChainId.MONAD]: new ApolloClient({
    cache: new InMemoryCache(),
    uri: CHAIN_SUBGRAPH_URL[DexChainId.MONAD],
  }),
  [DexChainId.UNICHAIN]: new ApolloClient({
    cache: new InMemoryCache(),
    uri: CHAIN_SUBGRAPH_URL[DexChainId.UNICHAIN],
  }),
  [DexChainId.PLASMA]: new ApolloClient({
    cache: new InMemoryCache(),
    uri: CHAIN_SUBGRAPH_URL[DexChainId.PLASMA],
  }),
  [DexChainId.SONIC]: new ApolloClient({
    cache: new InMemoryCache(),
    uri: CHAIN_SUBGRAPH_URL[DexChainId.SONIC],
  }),
  [DexChainId.LINEA]: new ApolloClient({
    cache: new InMemoryCache(),
    uri: CHAIN_SUBGRAPH_URL[DexChainId.LINEA],
  }),
  [DexChainId.INK]: new ApolloClient({
    cache: new InMemoryCache(),
    uri: CHAIN_SUBGRAPH_URL[DexChainId.INK],
  }),
  [DexChainId.MANTLE]: new ApolloClient({
    cache: new InMemoryCache(),
    uri: CHAIN_SUBGRAPH_URL[DexChainId.MANTLE],
  }),
  // [DexChainId.CALLISTO]: new ApolloClient({
  //   cache: new InMemoryCache(),
  //   uri: CHAIN_SUBGRAPH_URL[DexChainId.CALLISTO],
  // }),
};
