import { formatNumberKilos } from "@/functions/formatFloat";

export function formatUsdOrEth(
  usd: number | string | null | undefined,
  eth?: number | string | null | undefined,
): string {
  const usdN = Number(usd) || 0;
  const ethN = Number(eth) || 0;
  if (usdN > 0) return `$${formatNumberKilos(usdN)}`;
  if (ethN > 0) return `${formatNumberKilos(ethN)} ETH`;
  return `$${formatNumberKilos(0)}`;
}

export function formatTokenTvl(
  usd: number | string | null | undefined,
  tokenAmount?: number | string | null,
  derivedEth?: number | string | null,
): string {
  const usdN = Number(usd) || 0;
  if (usdN > 0) return `$${formatNumberKilos(usdN)}`;
  const ethTvl = (Number(tokenAmount) || 0) * (Number(derivedEth) || 0);
  if (ethTvl > 0) return `${formatNumberKilos(ethTvl)} ETH`;
  if ((Number(tokenAmount) || 0) > 0) return "—";
  return `$${formatNumberKilos(0)}`;
}

export function sortPoolsByTvl<T extends { totalValueLockedUSD?: string; totalValueLockedETH?: string }>(
  pools: T[],
): T[] {
  const list = [...pools];
  const useUsd = list.some((p) => Number(p.totalValueLockedUSD) > 0);
  list.sort((a, b) => {
    const key = useUsd ? "totalValueLockedUSD" : "totalValueLockedETH";
    return (Number(b[key]) || 0) - (Number(a[key]) || 0);
  });
  return list;
}
