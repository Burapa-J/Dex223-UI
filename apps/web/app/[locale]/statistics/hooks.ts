import { gql, useQuery } from "@apollo/client";
import { useMemo } from "react";

import { chainToApolloClient } from "@/graphql/thegraph/apollo";
import { ChartRange } from "@/hooks/usePoolPriceChart";
import { DexChainId } from "@/sdk_bi/chains";

export const FactoryStatsDocument = gql`
  query FactoryStatsQuery {
    factories(first: 1) {
      id
      poolCount
      txCount
      totalVolumeUSD
      totalVolumeETH
      totalFeesUSD
      totalValueLockedUSD
      totalValueLockedETH
    }
  }
`;

export function useFactoryStats(chainId: DexChainId) {
  const apolloClient = chainToApolloClient[chainId];

  return useQuery(FactoryStatsDocument, {
    client: apolloClient,
    skip: !apolloClient,
    fetchPolicy: "cache-and-network",
  });
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

  const { data, loading, error } = useQuery(Dex223DayDataDocument, {
    variables: { days },
    client: apolloClient,
    skip: !apolloClient,
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

  return { series, loading, error };
}

export const TokensDataDocument = gql`
  query TokensDataQuery($first: Int!) {
    tokens(first: $first, orderBy: totalValueLockedUSD, orderDirection: desc) {
      id
      symbol
      name
      addressERC223
      totalValueLocked
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

  return useQuery(TokensDataDocument, {
    variables: { first },
    client: apolloClient,
    skip: !apolloClient,
    fetchPolicy: "cache-and-network",
  });
}

export const TokenDetailDocument = gql`
  query TokenDetailQuery($id: ID!, $days: Int!) {
    token(id: $id) {
      id
      symbol
      name
      addressERC223
      decimals
      totalValueLocked
      totalValueLockedUSD
      volumeUSD
      feesUSD
      txCount
      poolCount
      derivedETH
      whitelistPools(first: 10, orderBy: totalValueLockedUSD, orderDirection: desc) {
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

  const { data, loading, error } = useQuery(TokenDetailDocument, {
    variables: { id, days },
    client: apolloClient,
    skip: !apolloClient || !id,
    fetchPolicy: "cache-and-network",
  });

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
    priceSeries,
    volumeSeries,
    loading,
    error,
  };
}
