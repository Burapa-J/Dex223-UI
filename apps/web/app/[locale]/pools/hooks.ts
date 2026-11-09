import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client";
import { useMemo } from "react";
import { Address, isAddress } from "viem";

import { getUSDAnchorTokens } from "@/config/constants/usdAnchors";
import { buildTokenPriceIndex, PoolDepthBalances, TokenPriceIndex } from "@/functions/poolTvl";
import { chainToApolloClient, isSubgraphConfigured } from "@/graphql/thegraph/apollo";
import { subgraphUnavailableError } from "@/graphql/thegraph/subgraphAvailability";
import { usePoolsOnChainBalances } from "@/hooks/usePoolOnChainBalances";
import { DexChainId } from "@/sdk_bi/chains";

export const PoolsDataDocument = gql`
  query PoolsDataQuery(
    $skip: Int!
    $first: Int!
    $orderDirection: OrderDirection
    $where: Pool_filter
  ) {
    pools(
      where: $where
      orderBy: totalValueLockedUSD
      orderDirection: $orderDirection
      first: $first
      skip: $skip
    ) {
      feeTier
      liquidity
      txCount
      id
      totalValueLockedUSD
      totalValueLockedETH
      totalValueLockedToken0
      totalValueLockedToken1
      token0Price
      token1Price
      volumeUSD
      token1 {
        id
        name
        symbol
        addressERC223
        totalValueLocked
      }
      token0 {
        id
        name
        symbol
        addressERC223
        totalValueLocked
      }
      poolDayData(first: 7, orderBy: date, orderDirection: desc) {
        volumeUSD
        feesUSD
        tvlUSD
        date
      }
    }
  }
`;
export const PoolDataDocument = gql`
  query PoolDataQuery($id: String) {
    pool(id: $id) {
      feeTier
      liquidity
      txCount
      id
      totalValueLockedUSD
      totalValueLockedETH
      totalValueLockedToken0
      totalValueLockedToken1
      token0Price
      token1Price
      volumeUSD
      feesUSD
      token1 {
        id
        name
        symbol
        addressERC223
        totalValueLocked
        decimals
      }
      token0 {
        id
        name
        symbol
        addressERC223
        totalValueLocked
        decimals
      }
      poolDayData(first: 1, orderBy: date, orderDirection: desc) {
        date
        feesUSD
        volumeUSD
      }
    }
  }
`;

export function usePoolsData({
  skip = 0,
  first = 1000,
  orderDirection,
  chainId,
  filter,
}: {
  skip?: number;
  first?: number;
  orderDirection?: "desc" | "asc";
  chainId: DexChainId;
  filter?: {
    token0Address?: Address;
    token1Address?: Address;
    searchString?: string;
  };
}) {
  const apolloClient = chainToApolloClient[chainId];
  const configured = isSubgraphConfigured(chainId);

  const result = useQuery<any, any>(PoolsDataDocument, {
    variables: {
      skip,
      first,
      orderDirection,
      where: filter?.searchString
        ? {
            or: [
              { token0_: { name_contains_nocase: filter.searchString } },
              { token1_: { name_contains_nocase: filter.searchString } },
              { token0_: { symbol_contains_nocase: filter.searchString } },
              { token1_: { symbol_contains_nocase: filter.searchString } },
              ...(isAddress(filter.searchString)
                ? [{ id: filter.searchString.toLowerCase() }]
                : []),
            ],
          }
        : {
            or: [
              {
                and: [
                  {
                    token0_: filter?.token0Address
                      ? { id: filter.token0Address.toLowerCase() }
                      : undefined,
                  },
                  {
                    token1_: filter?.token1Address
                      ? { id: filter.token1Address.toLowerCase() }
                      : undefined,
                  },
                ],
              },
              {
                and: [
                  {
                    token0_: filter?.token1Address
                      ? { id: filter.token1Address.toLowerCase() }
                      : undefined,
                  },
                  {
                    token1_: filter?.token0Address
                      ? { id: filter.token0Address.toLowerCase() }
                      : undefined,
                  },
                ],
              },
            ],
          },
    },
    skip: !apolloClient || !configured,
    pollInterval: 30000,
    client: apolloClient || chainToApolloClient[DexChainId.SEPOLIA],
  });

  if (!configured) {
    return { ...result, data: undefined, loading: false, error: subgraphUnavailableError() };
  }

  return result;
}

export const usePoolData = ({
  poolAddress,
  chainId,
}: {
  poolAddress: Address;
  chainId: DexChainId;
}) => {
  const apolloClient = chainToApolloClient[chainId];

  return useQuery<any, any>(PoolDataDocument, {
    variables: {
      id: poolAddress,
    },
    pollInterval: 30000,
    skip: !apolloClient,
    client: apolloClient || chainToApolloClient[DexChainId.SEPOLIA],
  });
};

// Deliberately unfiltered: the price index has to see every pool on the chain, including the
// ones a user's search or token filter would have hidden, or a pair would lose the route
// that connects it to a stablecoin.
export const PoolPricesDocument = gql`
  query PoolPricesQuery($first: Int!) {
    pools(orderBy: totalValueLockedUSD, orderDirection: desc, first: $first) {
      id
      token0Price
      token1Price
      totalValueLockedToken0
      totalValueLockedToken1
      token0 {
        id
      }
      token1 {
        id
      }
    }
  }
`;

const MAX_PRICE_INDEX_BALANCE_POOLS = 200;

/**
 * USD prices for every token reachable from one of the chain's stablecoins, used to value
 * pools against their own spot price instead of the subgraph's global per-token price.
 */
export const usePoolPriceIndex = (
  chainId: DexChainId | undefined,
): { priceIndex: TokenPriceIndex; loading: boolean } => {
  const anchors = getUSDAnchorTokens(chainId);
  const apolloClient = chainId ? chainToApolloClient[chainId] : undefined;

  const { data, loading } = useQuery<any, any>(PoolPricesDocument, {
    variables: { first: 1000 },
    // Nothing to anchor on means nothing to compute - skip the round trip entirely.
    skip: !apolloClient || !anchors.length,
    pollInterval: 30000,
    client: apolloClient || chainToApolloClient[DexChainId.SEPOLIA],
  });

  const poolAddresses = useMemo(
    () =>
      (data?.pools || [])
        .slice(0, MAX_PRICE_INDEX_BALANCE_POOLS)
        .map((pool: any) => pool.id as Address),
    [data?.pools],
  );

  const { balances, isLoading: balancesLoading } = usePoolsOnChainBalances({
    poolAddresses,
    chainId,
  });

  const depthBalances = useMemo(
    () =>
      Object.entries(balances).reduce((acc, [pool, poolBalances]) => {
        acc[pool] = {
          token0: poolBalances.token0.formatted,
          token1: poolBalances.token1.formatted,
        };
        return acc;
      }, {} as PoolDepthBalances),
    [balances],
  );

  const priceIndex = useMemo(
    () => buildTokenPriceIndex(data?.pools || [], anchors, depthBalances),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data?.pools, chainId, depthBalances],
  );

  return { priceIndex, loading: loading || balancesLoading };
};
