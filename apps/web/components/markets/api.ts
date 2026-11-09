import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { MARKET_API_URL } from "@/components/trading-chart/datafeed/marketApi";

export interface Coin {
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  rank: number | null;
  price: number | null;
  market_cap: number | null;
  fdv: number | null;
  volume_24h: number | null;
  high_24h: number | null;
  low_24h: number | null;
  change_1h: number | null;
  change_24h: number | null;
  change_7d: number | null;
  circulating_supply: number | null;
  total_supply: number | null;
  max_supply: number | null;
  ath: number | null;
  ath_date: string | null;
  atl: number | null;
  atl_date: string | null;
  sparkline_7d: number[] | null;
  binance_symbol: string | null;
  /** BINANCE:<pair> when Binance lists the coin, otherwise COINGECKO:<id>. */
  chart_symbol: string;
  updated_at: number;
}

export type MarketSort =
  | "rank"
  | "market_cap"
  | "volume"
  | "change_24h"
  | "change_24h_asc"
  | "price";

interface MarketsPage {
  page: number;
  per_page: number;
  total: number;
  coins: Coin[];
}

const REQUEST_TIMEOUT_MS = 15_000;

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  if (signal?.aborted) controller.abort();
  try {
    const response = await fetch(`${MARKET_API_URL}${path}`, { signal: controller.signal });
    if (response.status === 404) throw new NotFoundError(path);
    if (!response.ok) throw new Error(`Market API ${path} responded ${response.status}`);
    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}

export class NotFoundError extends Error {}

export function useMarkets({
  page,
  perPage,
  sort,
  query,
}: {
  page: number;
  perPage: number;
  sort: MarketSort;
  query: string;
}) {
  return useQuery({
    queryKey: ["markets", page, perPage, sort, query],
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
        sort,
      });
      if (query) params.set("q", query);
      return get<MarketsPage>(`/v1/markets?${params}`, signal);
    },
  });
}

export function useCoin(id: string) {
  return useQuery({
    queryKey: ["coin", id],
    refetchInterval: 60_000,
    retry: (count, error) => !(error instanceof NotFoundError) && count < 2,
    queryFn: ({ signal }) => get<Coin>(`/v1/coins/${encodeURIComponent(id)}`, signal),
  });
}
