export type MarketTablePhase = "error" | "loading" | "no-results" | "ready";

export function marketTablePhase(input: {
  isError: boolean;
  isPlaceholderData: boolean;
  hasData: boolean;
  count: number;
  hasQuery: boolean;
}): MarketTablePhase {
  const visible = input.hasData && !input.isPlaceholderData;
  if (input.isError && !visible) return "error";
  if (!visible) return "loading";
  if (input.count === 0) return input.hasQuery ? "no-results" : "error";
  return "ready";
}

const MARKET_SORTS = [
  "rank",
  "market_cap",
  "volume",
  "change_24h",
  "change_24h_asc",
  "price",
] as const;

export type MarketColumnSort = (typeof MARKET_SORTS)[number];

export function nextMarketSort(
  current: MarketColumnSort,
  column: MarketColumnSort,
): MarketColumnSort {
  if (column === "change_24h" || column === "change_24h_asc") {
    if (current === "change_24h") return "change_24h_asc";
    if (current === "change_24h_asc") return "rank";
    return "change_24h";
  }
  if (current === column && column !== "rank") return "rank";
  return column;
}

export function marketColumnDirection(
  sort: MarketColumnSort,
  column: MarketColumnSort,
): "ascending" | "descending" | "none" {
  if (column === "change_24h") {
    if (sort === "change_24h") return "descending";
    if (sort === "change_24h_asc") return "ascending";
    return "none";
  }
  if (sort !== column) return "none";
  return column === "rank" ? "ascending" : "descending";
}

export function marketListQuery(input: {
  page?: string | null;
  sort?: string | null;
  q?: string | null;
}): { page: number; sort: MarketColumnSort; q: string } {
  const page = Number(input.page);
  const sort = (MARKET_SORTS as readonly string[]).includes(input.sort ?? "")
    ? (input.sort as MarketColumnSort)
    : "rank";
  return {
    page: Number.isInteger(page) && page > 0 ? Math.min(page, 1000) : 1,
    sort,
    q: (input.q ?? "").trim().slice(0, 80),
  };
}

export function marketsListSearch(
  current: string,
  next: { page?: number; sort?: MarketColumnSort; q?: string },
): string {
  const params = new URLSearchParams(current);
  const q = next.q !== undefined ? next.q : (params.get("q") ?? "");
  const pageRaw = Number(params.get("page"));
  const page = next.page ?? (Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1);
  const sort = next.sort ?? marketListQuery({ sort: params.get("sort") }).sort;
  if (q) params.set("q", q);
  else params.delete("q");
  if (page > 1) params.set("page", String(page));
  else params.delete("page");
  if (sort !== "rank") params.set("sort", sort);
  else params.delete("sort");
  return params.toString();
}

export function showStaleRefreshError(
  isError: boolean,
  isPlaceholderData: boolean,
  hasData: boolean,
): boolean {
  return isError && hasData && !isPlaceholderData;
}
