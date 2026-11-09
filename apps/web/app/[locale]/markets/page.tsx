"use client";

import clsx from "clsx";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ReactNode, useEffect, useRef, useState } from "react";

import Container from "@/components/atoms/Container";
import { SearchInput } from "@/components/atoms/Input";
import Svg from "@/components/atoms/Svg";
import TokenLogo from "@/components/atoms/TokenLogo";
import { Coin, useMarkets } from "@/components/markets/api";
import { formatUsd, formatUsdCompact } from "@/components/markets/format";
import Sparkline from "@/components/markets/Sparkline";
import {
  marketColumnDirection,
  MarketColumnSort,
  marketListQuery,
  marketsListSearch,
  marketTablePhase,
  nextMarketSort,
  showStaleRefreshError,
} from "@/components/markets/tableState";
import { compact, formatPercent } from "@/components/trading-chart/format";
import { useDebounce } from "@/hooks/useDebounce";
import { Link, usePathname, useRouter } from "@/i18n/routing";

const PER_PAGE = 100;

function Change({ value, className }: { value: number | null; className?: string }) {
  if (value === null || !Number.isFinite(value)) return <span className={className}>–</span>;
  return (
    <span className={clsx(value >= 0 ? "text-green" : "text-red-light", className)}>
      {formatPercent(value)}
    </span>
  );
}

export default function MarketsPage() {
  const t = useTranslations("Markets");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const list = marketListQuery({
    page: searchParams.get("page"),
    sort: searchParams.get("sort"),
    q: searchParams.get("q"),
  });
  const { page, sort } = list;
  const [search, setSearch] = useState(list.q);
  const query = useDebounce(search, 300).trim();
  const urlQuery = useRef(list.q);

  function openList(next: { page?: number; sort?: MarketColumnSort; q?: string }) {
    const qs = marketsListSearch(searchParams.toString(), next);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  useEffect(() => {
    const urlChanged = urlQuery.current !== list.q;
    urlQuery.current = list.q;
    if (urlChanged) {
      setSearch(list.q);
      return;
    }
    if (query === list.q || search.trim() !== query) return;
    const qs = marketsListSearch(searchParams.toString(), { q: query, page: 1 });
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [query, list.q, search, searchParams, pathname, router]);

  const markets = useMarkets({ page, perPage: PER_PAGE, sort, query });
  const gainers = useMarkets({ page: 1, perPage: 3, sort: "change_24h", query: "" });
  const losers = useMarkets({ page: 1, perPage: 3, sort: "change_24h_asc", query: "" });
  const traded = useMarkets({ page: 1, perPage: 3, sort: "volume", query: "" });

  const phase = marketTablePhase({
    isError: markets.isError,
    isPlaceholderData: markets.isPlaceholderData,
    hasData: Boolean(markets.data),
    count: markets.data?.coins.length ?? 0,
    hasQuery: Boolean(query),
  });
  const rows = phase === "ready" ? markets.data : undefined;
  const pages = rows ? Math.max(1, Math.ceil(rows.total / PER_PAGE)) : 1;
  const staleRefresh =
    phase === "ready" &&
    showStaleRefreshError(markets.isError, markets.isPlaceholderData, Boolean(markets.data));

  const sortHeader = (key: MarketColumnSort, label: string) => {
    const direction = marketColumnDirection(sort, key);
    const active = direction !== "none";
    return (
      <button
        type="button"
        onClick={() => openList({ sort: nextMarketSort(sort, key), page: 1 })}
        aria-pressed={active}
        className={clsx(
          "inline-flex items-center gap-1 duration-200 hocus:text-primary-text",
          active && "text-primary-text",
        )}
      >
        {label}
        {active && key !== "rank" && (
          <Svg
            iconName={direction === "ascending" ? "sort-up" : "sort-down"}
            size={20}
            className="text-green"
          />
        )}
      </button>
    );
  };

  return (
    <Container>
      <div className="py-4 md:py-6">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
          <div>
            <h1 className="text-24 lg:text-40 mb-1">{t("title")}</h1>
            <p className="text-secondary-text text-14 md:text-16">{t("description")}</p>
          </div>
          <div className="w-full sm:w-[320px]">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search")}
              aria-label={t("search")}
              maxLength={80}
              className="h-11 rounded-3 bg-primary-bg border border-secondary-border text-14"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <MoversCard
            title={t("top_gainers")}
            coins={gainers.data?.coins}
            isError={gainers.isError}
            errorText={t("unavailable")}
            kind="change"
          />
          <MoversCard
            title={t("top_losers")}
            coins={losers.data?.coins}
            isError={losers.isError}
            errorText={t("unavailable")}
            kind="change"
          />
          <MoversCard
            title={t("most_traded")}
            coins={traded.data?.coins}
            isError={traded.isError}
            errorText={t("unavailable")}
            kind="volume"
          />
        </div>

        <div className="bg-primary-bg rounded-5 overflow-hidden">
          {staleRefresh && (
            <p className="px-5 py-3 text-14 text-secondary-text border-b border-secondary-border">
              {t("unavailable")}
            </p>
          )}
          <div className="overflow-x-auto">
            <table
              className="w-full md:min-w-[720px] text-14 tabular-nums"
              aria-busy={phase === "loading"}
            >
              <thead className="text-12 text-tertiary-text border-b border-secondary-border">
                <tr className="[&>th]:px-2 [&>th]:py-3 [&>th]:font-normal md:[&>th]:px-3">
                  <th
                    className="text-left w-8 pl-3 md:w-12 md:pl-5"
                    aria-sort={marketColumnDirection(sort, "rank")}
                  >
                    {sortHeader("rank", "#")}
                  </th>
                  <th className="text-left">{t("col_coin")}</th>
                  <th className="text-right" aria-sort={marketColumnDirection(sort, "price")}>
                    {sortHeader("price", t("col_price"))}
                  </th>
                  <th className="text-right hidden lg:table-cell">{t("col_1h")}</th>
                  <th className="text-right" aria-sort={marketColumnDirection(sort, "change_24h")}>
                    {sortHeader("change_24h", t("col_24h"))}
                  </th>
                  <th className="text-right hidden md:table-cell">{t("col_7d")}</th>
                  <th
                    className="text-right hidden sm:table-cell"
                    aria-sort={marketColumnDirection(sort, "market_cap")}
                  >
                    {sortHeader("market_cap", t("col_market_cap"))}
                  </th>
                  <th
                    className="text-right hidden md:table-cell"
                    aria-sort={marketColumnDirection(sort, "volume")}
                  >
                    {sortHeader("volume", t("col_volume"))}
                  </th>
                  <th className="text-right hidden xl:table-cell">{t("col_supply")}</th>
                  <th className="text-right hidden lg:table-cell pr-5">{t("col_chart")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-border">
                {phase === "error" ? (
                  <EmptyRow>{t("unavailable")}</EmptyRow>
                ) : phase === "loading" ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={10} className="px-5 py-4">
                        <div className="h-6 rounded-2 bg-tertiary-bg animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : phase === "no-results" ? (
                  <EmptyRow>{t("no_results")}</EmptyRow>
                ) : (
                  rows?.coins.map((coin) => (
                    <tr
                      key={coin.id}
                      className="relative hover:bg-tertiary-bg duration-200 [&>td]:px-2 [&>td]:py-3 md:[&>td]:px-3"
                    >
                      <td className="pl-3 md:pl-5 text-tertiary-text">{coin.rank}</td>
                      <td>
                        <Link
                          href={`/markets/${coin.id}`}
                          className="flex items-center gap-3 min-w-0 after:absolute after:inset-0"
                        >
                          <TokenLogo
                            src={coin.image}
                            alt={coin.symbol}
                            size={28}
                            className="rounded-full w-7 h-7 shrink-0"
                          />
                          <span className="min-w-0">
                            <span className="block font-medium text-primary-text truncate max-w-[88px] sm:max-w-[180px]">
                              {coin.name}
                            </span>
                            <span className="block text-12 text-tertiary-text">{coin.symbol}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="text-right text-primary-text">{formatUsd(coin.price)}</td>
                      <td className="text-right hidden lg:table-cell">
                        <Change value={coin.change_1h} />
                      </td>
                      <td className="text-right">
                        <Change value={coin.change_24h} />
                      </td>
                      <td className="text-right hidden md:table-cell">
                        <Change value={coin.change_7d} />
                      </td>
                      <td className="text-right text-secondary-text hidden sm:table-cell">
                        {formatUsdCompact(coin.market_cap)}
                      </td>
                      <td className="text-right text-secondary-text hidden md:table-cell">
                        {formatUsdCompact(coin.volume_24h)}
                      </td>
                      <td className="text-right text-secondary-text hidden xl:table-cell">
                        {coin.circulating_supply
                          ? `${compact(coin.circulating_supply)} ${coin.symbol}`
                          : "–"}
                      </td>
                      <td className="hidden lg:table-cell pr-5">
                        <div className="flex justify-end">
                          <Sparkline points={coin.sparkline_7d} />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-secondary-border text-12 text-tertiary-text">
            <span>{t("attribution")}</span>
            {pages > 1 && rows && (
              <div className="flex items-center gap-2">
                <PageButton disabled={page <= 1} onClick={() => openList({ page: page - 1 })}>
                  {t("previous")}
                </PageButton>
                <span>{t("page", { page, pages })}</span>
                <PageButton disabled={page >= pages} onClick={() => openList({ page: page + 1 })}>
                  {t("next")}
                </PageButton>
              </div>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
}

function MoversCard({
  title,
  coins,
  isError = false,
  errorText,
  kind,
}: {
  title: string;
  coins: Coin[] | undefined;
  isError?: boolean;
  errorText: string;
  kind: "change" | "volume";
}) {
  // A failed query has no coins and never will; show the message instead of pulsing rows.
  if (isError && !coins) {
    return (
      <div className="bg-primary-bg rounded-5 p-4">
        <h2 className="text-14 text-secondary-text mb-2">{title}</h2>
        <p className="text-14 text-secondary-text py-2">{errorText}</p>
      </div>
    );
  }

  return (
    <div className="bg-primary-bg rounded-5 p-4">
      <h2 className="text-14 text-secondary-text mb-2">{title}</h2>
      <ul className="flex flex-col">
        {(coins ?? Array.from({ length: 3 }, () => null)).map((coin, i) => (
          <li key={coin?.id ?? i}>
            {coin ? (
              <Link
                href={`/markets/${coin.id}`}
                className="flex items-center gap-2 h-9 px-2 -mx-2 rounded-2 hocus:bg-tertiary-bg duration-200 text-14 tabular-nums"
              >
                <TokenLogo
                  src={coin.image}
                  alt={coin.symbol}
                  size={20}
                  className="rounded-full w-5 h-5"
                />
                <span className="text-primary-text">{coin.symbol}</span>
                <span className="ml-auto text-secondary-text">{formatUsd(coin.price)}</span>
                {kind === "change" ? (
                  <Change value={coin.change_24h} className="w-16 text-right" />
                ) : (
                  <span className="w-16 text-right text-secondary-text">
                    {formatUsdCompact(coin.volume_24h)}
                  </span>
                )}
              </Link>
            ) : (
              <div className="h-9 my-0.5 rounded-2 bg-tertiary-bg animate-pulse" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyRow({ children }: { children: ReactNode }) {
  return (
    <tr>
      <td colSpan={10} className="px-5 py-10 text-center text-secondary-text">
        {children}
      </td>
    </tr>
  );
}

function PageButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="px-3 h-8 rounded-2 bg-tertiary-bg text-primary-text disabled:opacity-40 hocus:bg-quaternary-bg duration-200"
    >
      {children}
    </button>
  );
}
