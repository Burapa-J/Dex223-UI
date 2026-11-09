import { gql, useQuery } from "@apollo/client";
import { useMemo } from "react";

import { chainToApolloClient, isSubgraphConfigured } from "@/graphql/thegraph/apollo";
import { subgraphUnavailableError } from "@/graphql/thegraph/subgraphAvailability";
import { ChartRange } from "@/hooks/usePoolPriceChart";
import { DexChainId } from "@/sdk_bi/chains";

export const FactoryStatsDocument = gql`
  query FactoryStatsQuery {
    factories(first: 1) {
      id
      poolCount
      txCount
      totalVolumeUSD
      totalFeesUSD
      totalValueLockedUSD
    }
  }
`;

export function useFactoryStats(chainId: DexChainId) {
  const apolloClient = chainToApolloClient[chainId];
  const configured = isSubgraphConfigured(chainId);

  const result = useQuery(FactoryStatsDocument, {
    client: apolloClient,
    skip: !apolloClient || !configured,
    fetchPolicy: "cache-and-network",
  });

  if (!configured) {
    return { ...result, data: undefined, loading: false, error: subgraphUnavailableError() };
  }

  return result;
}

export const Dex223DayDataDocument = gql`
  query Dex223DayDataQuery($days: Int!) {
    dex223DayDatas(first: $days, orderBy: date, orderDirection: desc) {
      id
      date
      tvlUSD
      volumeUSD
      feesUSD
      txCount
    }
  }
`;

export function useDex223DayData(chainId: DexChainId, days: ChartRange = 30) {
  const apolloClient = chainToApolloClient[chainId];
  const configured = isSubgraphConfigured(chainId);

  const { data, loading, error } = useQuery(Dex223DayDataDocument, {
    variables: { days },
    client: apolloClient,
    skip: !apolloClient || !configured,
    fetchPolicy: "cache-and-network",
  });

  const series = useMemo(() => {
    const rows = data?.dex223DayDatas ?? [];
    return [...rows]
      .map((row: { date: number; tvlUSD: string; volumeUSD: string }) => ({
        date: row.date,
        tvlUSD: Number(row.tvlUSD) || 0,
        volumeUSD: Number(row.volumeUSD) || 0,
      }))
      .sort((a, b) => a.date - b.date);
  }, [data]);

  return {
    series,
    loading: configured ? loading : false,
    error: configured ? error : subgraphUnavailableError(),
  };
}

export const TokensDataDocument = gql`
  query TokensDataQuery($first: Int!) {
    tokens(first: $first, orderBy: totalValueLockedUSD, orderDirection: desc) {
      id
      symbol
      name
      addressERC223
      totalValueLockedUSD
      volumeUSD
      txCount
      derivedETH
      tokenDayData(first: 1, orderBy: date, orderDirection: desc) {
        priceUSD
      }
    }
  }
`;

export function useTokensData(chainId: DexChainId, first = 50) {
  const apolloClient = chainToApolloClient[chainId];
  const configured = isSubgraphConfigured(chainId);

  const result = useQuery(TokensDataDocument, {
    variables: { first },
    client: apolloClient,
    skip: !apolloClient || !configured,
    fetchPolicy: "cache-and-network",
  });

  if (!configured) {
    return { ...result, data: undefined, loading: false, error: subgraphUnavailableError() };
  }

  return result;
}

export const TokenDetailDocument = gql`
  query TokenDetailQuery($id: ID!, $days: Int!) {
    token(id: $id) {
      id
      symbol
      name
      addressERC223
      decimals
      totalValueLockedUSD
      volumeUSD
      feesUSD
      txCount
      derivedETH
    }
    # All pools for this token (not whitelistPools — that list is for price derivation only
    # and under-counts real trading pairs; subgraph poolCount is also often stale).
    pools(
      first: 50
      orderBy: totalValueLockedETH
      orderDirection: desc
      where: { or: [{ token0: $id }, { token1: $id }] }
    ) {
      id
      feeTier
      totalValueLockedUSD
      totalValueLockedETH
      volumeUSD
      token0 {
        id
        symbol
        addressERC223
      }
      token1 {
        id
        symbol
        addressERC223
      }
    }
    tokenDayDatas(first: $days, orderBy: date, orderDirection: desc, where: { token: $id }) {
      date
      priceUSD
      volumeUSD
      totalValueLockedUSD
      open
      high
      low
      close
    }
  }
`;

export function useTokenDetail(
  chainId: DexChainId,
  address: string | undefined,
  days: ChartRange = 30,
) {
  const apolloClient = chainToApolloClient[chainId];
  const id = address?.toLowerCase();
  const configured = isSubgraphConfigured(chainId);

  const { data, loading, error } = useQuery(TokenDetailDocument, {
    variables: { id, days },
    client: apolloClient,
    skip: !apolloClient || !id || !configured,
    fetchPolicy: "cache-and-network",
  });

  const pools = useMemo(() => data?.pools ?? [], [data?.pools]);

  const priceSeries = useMemo(() => {
    const rows = data?.tokenDayDatas ?? [];
    return [...rows]
      .map((row: { date: number; priceUSD: string; close: string }) => {
        const value = Number(row.priceUSD) || Number(row.close) || 0;
        if (!Number.isFinite(value) || value <= 0) return null;
        return { date: row.date, value };
      })
      .filter((p): p is { date: number; value: number } => p !== null)
      .sort((a, b) => a.date - b.date);
  }, [data]);

  const volumeSeries = useMemo(() => {
    const rows = data?.tokenDayDatas ?? [];
    return [...rows]
      .map((row: { date: number; volumeUSD: string }) => ({
        date: row.date,
        value: Number(row.volumeUSD) || 0,
      }))
      .sort((a, b) => a.date - b.date);
  }, [data]);

  return {
    token: data?.token ?? null,
    pools,
    priceSeries,
    volumeSeries,
    loading: configured ? loading : false,
    error: configured ? error : subgraphUnavailableError(),
  };
}
