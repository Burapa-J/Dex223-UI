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
