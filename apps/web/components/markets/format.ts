import { compact, formatPrice } from "@/components/trading-chart/format";

const EMPTY = "–";

export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY;
  return `$${formatPrice(value)}`;
}

export function formatUsdCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY;
  return `$${compact(value)}`;
}

export function displayedCoinPrice(
  coinId: string,
  live: { coinId: string; close: number } | null,
  listing: number | null | undefined,
): number | null {
  if (live?.coinId === coinId && Number.isFinite(live.close)) return live.close;
  if (listing === null || listing === undefined || !Number.isFinite(listing)) return null;
  return listing;
}

export function displayedChange24h(
  listingPrice: number | null | undefined,
  listingChange: number | null | undefined,
  displayedPrice: number | null,
): number | null {
  if (listingChange === null || listingChange === undefined || !Number.isFinite(listingChange)) {
    return null;
  }
  if (
    displayedPrice === null ||
    listingPrice === null ||
    listingPrice === undefined ||
    !Number.isFinite(displayedPrice) ||
    !Number.isFinite(listingPrice) ||
    listingPrice <= 0
  ) {
    return listingChange;
  }
  const denominator = 1 + listingChange / 100;
  if (!Number.isFinite(denominator) || denominator === 0) return listingChange;
  const ago = listingPrice / denominator;
  if (!Number.isFinite(ago) || ago === 0) return listingChange;
  const change = ((displayedPrice - ago) / ago) * 100;
  return Number.isFinite(change) ? change : listingChange;
}

export function formatMarketDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
