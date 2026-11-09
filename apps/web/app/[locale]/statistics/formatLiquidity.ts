import { formatNumberKilos } from "@/functions/formatFloat";
import { computePoolTVL, TokenPriceIndex } from "@/functions/poolTvl";

export function positiveUsd(value: number | string | null | undefined): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function formatUsd(amount: number): string {
  return `$${formatNumberKilos(amount)}`;
}

export function tokenPriceUsd(
  priceIndex: TokenPriceIndex,
  tokenId: string | undefined,
  subgraphPrice?: number | string | null,
): number | null {
  const indexed = tokenId ? priceIndex[tokenId.toLowerCase()]?.price : undefined;
  if (indexed && indexed > 0) return indexed;
  return positiveUsd(subgraphPrice);
}

export function tokenTvlUsd(
  priceIndex: TokenPriceIndex,
  token: {
    id?: string;
    totalValueLockedUSD?: string | number | null;
    totalValueLocked?: string | number | null;
  },
): number | null {
  const subgraph = positiveUsd(token.totalValueLockedUSD);
  if (subgraph) return subgraph;
  const price = token.id ? priceIndex[token.id.toLowerCase()]?.price : undefined;
  const amount = Number(token.totalValueLocked);
  if (price && price > 0 && amount > 0) return price * amount;
  return null;
}

export function poolTvlUsd(priceIndex: TokenPriceIndex, pool: any): number | null {
  const priced = computePoolTVL({
    pool,
    priceIndex,
    subgraphFallback: false,
  });
  if (priced && priced > 0) return priced;
  return positiveUsd(pool?.totalValueLockedUSD);
}

export function sortPoolsByTvl<T>(pools: T[], priceIndex: TokenPriceIndex = {}): T[] {
  return [...pools].sort(
    (a, b) => (poolTvlUsd(priceIndex, b) ?? 0) - (poolTvlUsd(priceIndex, a) ?? 0),
  );
}
