"use client";

import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";

import Svg from "@/components/atoms/Svg";
import TokenLogo from "@/components/atoms/TokenLogo";
import { Link } from "@/i18n/routing";
import { useColorScheme } from "@/lib/color-scheme";
import { Currency } from "@/sdk_bi/entities/currency";

import { Bar, Resolution, RESOLUTIONS, Trade } from "./datafeed/types";
import { compact, formatPercent, formatPrice } from "./format";
import { useChartMarket } from "./hooks/useChartMarket";
import { useMarketTrades, usePairStats, useQuoteUsdPrice } from "./hooks/useMarketData";
import MarketTrades from "./MarketTrades";
import ProChart from "./ProChart";
import { useTradingChartStore } from "./store";
import { accentClasses } from "./theme";
import { ChartSkeleton, EmptyState } from "./ui";

interface Props {
  tokenA?: Currency;
  tokenB?: Currency;
  /** Fee tier the current quote routes through, so the chart follows the pool traded. */
  routedFee?: number;
  /** Tailwind height classes for the plotting area. */
  heightClassName?: string;
  /** Show the market and personal trades panel under the chart. */
  showTrades?: boolean;
  className?: string;
}

/** The chart for the pair being traded: pool header and 24h stats, the chart, trades. */
export default function TradingChart({
  tokenA,
  tokenB,
  routedFee,
  heightClassName = "h-[380px] md:h-[460px] xl:h-[540px]",
  showTrades = true,
  className,
}: Props) {
  const t = useTranslations("TradingChart");
  const accent = accentClasses(useColorScheme());
  const { address } = useAccount();
  const queryClient = useQueryClient();

  const market = useChartMarket({ tokenA, tokenB, routedFee });
  const { resolution, setResolution } = useTradingChartStore();

  const { data: stats } = usePairStats(market);
  // Dollars per quote token, so a pair quoted in WETH still headlines its USD price.
  const quoteUsd = useQuoteUsdPrice(market);
  const inUsd = (value: number | null | undefined) =>
    quoteUsd !== null && value !== null && value !== undefined && Number.isFinite(value)
      ? `$${formatPrice(value * quoteUsd)}`
      : formatPrice(value);
  const { data: myTrades } = useMarketTrades(market, { origin: address ?? "", limit: 200 });

  const [lastBar, setLastBar] = useState<Bar | null>(null);
  const [liveTrades, setLiveTrades] = useState<Trade[]>([]);

  const datafeed = market.datafeed;
  // The fallback feed has no minute data; show the nearest resolution it does have.
  const activeResolution: Resolution =
    datafeed && !datafeed.resolutions.includes(resolution) ? datafeed.resolutions[0] : resolution;

  useEffect(() => {
    setLiveTrades([]);
    setLastBar(null);
  }, [market.symbol]);

  const onTrades = useCallback(
    (trades: Trade[]) => {
      setLiveTrades((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        return [...trades.filter((x) => !seen.has(x.id)).reverse(), ...prev].slice(0, 100);
      });
      // A trade moves the 24h figures; mine also adds a marker.
      queryClient.invalidateQueries({ queryKey: ["chart-pool-stats"] });
      if (address && trades.some((x) => x.origin?.toLowerCase() === address.toLowerCase())) {
        queryClient.invalidateQueries({ queryKey: ["chart-trades"] });
      }
    },
    [address, queryClient],
  );

  const intervals = useMemo(
    () =>
      RESOLUTIONS.map((r) => {
        const available = !datafeed || datafeed.resolutions.includes(r.value);
        return {
          value: r.value,
          label: r.label,
          disabled: !available,
          title: available ? undefined : t("interval_unavailable"),
        };
      }),
    [datafeed, t],
  );

  // Header price: the live bar beats the stats poll, which trails it by up to 15s.
  const price = lastBar?.close ?? stats?.price ?? null;
  const change =
    price !== null && stats?.price_24h_ago
      ? ((price - stats.price_24h_ago) / stats.price_24h_ago) * 100
      : (stats?.change_24h ?? null);

  const flash = usePriceFlash(price);

  if (!tokenA || !tokenB) {
    return (
      <Panel className={className}>
        <EmptyState icon="chart" title={t("select_pair")} />
      </Panel>
    );
  }

  const base = market.base ?? tokenB;
  const quote = market.quote ?? tokenA;
  const isFallback = datafeed?.kind === "subgraph";

  return (
    <div className={clsx("flex flex-col bg-primary-bg rounded-3 overflow-hidden", className)}>
      {/* Header */}
      <div className="flex flex-col gap-3 px-4 md:px-5 pt-4 pb-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
          <div className="flex items-center shrink-0">
            <TokenLogo
              src={base.logoURI}
              alt={base.symbol ?? ""}
              size={32}
              className="rounded-full w-8 h-8 relative z-10 ring-2 ring-primary-bg"
            />
            <TokenLogo
              src={quote.logoURI}
              alt={quote.symbol ?? ""}
              size={32}
              className="rounded-full w-8 h-8 -ml-2.5"
            />
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <h2 className="text-18 font-medium text-primary-text truncate">
              {base.symbol}
              <span className="text-tertiary-text font-normal"> / {quote.symbol}</span>
            </h2>
            <button
              type="button"
              onClick={market.flip}
              disabled={market.status !== "ready"}
              aria-label={t("flip")}
              title={t("flip")}
              className="w-7 h-7 inline-flex items-center justify-center rounded-2 text-tertiary-text hocus:text-primary-text hocus:bg-tertiary-bg duration-200 disabled:opacity-40"
            >
              <Svg iconName="swap" size={18} />
            </button>
          </div>
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            <FeeTierSelect market={market} />
            {market.status === "ready" && (
              <span
                className={clsx(
                  "inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-12",
                  isFallback ? "bg-orange-bg text-orange" : accent.soft,
                )}
                title={isFallback ? t("interval_unavailable") : undefined}
              >
                <span className="relative flex w-1.5 h-1.5">
                  {!isFallback && (
                    <span
                      className={clsx(
                        "absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping",
                        accent.solid,
                      )}
                    />
                  )}
                  <span
                    className={clsx(
                      "relative inline-flex w-1.5 h-1.5 rounded-full",
                      isFallback ? "bg-orange" : accent.solid,
                    )}
                  />
                </span>
                {isFallback ? t("hourly_data") : t("live")}
              </span>
            )}
          </div>
        </div>

        {market.status !== "no-pool" && (
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div className="flex items-baseline gap-2.5">
              <span
                className={clsx(
                  "text-[28px] md:text-[32px] leading-none font-medium tabular-nums tracking-tight duration-500",
                  flash === "up"
                    ? "text-green"
                    : flash === "down"
                      ? "text-red-light"
                      : "text-primary-text",
                )}
              >
                {inUsd(price)}
              </span>
              {quoteUsd !== null && quoteUsd !== 1 && price !== null && (
                <span className="text-14 text-tertiary-text tabular-nums whitespace-nowrap">
                  {formatPrice(price)} {quote.symbol}
                </span>
              )}
              <ChangePill value={change} />
            </div>
            <dl className="flex flex-wrap gap-y-2 text-12 -mx-3 md:ml-auto">
              <Stat label={t("high_24h")} value={inUsd(stats?.high_24h)} />
              <Stat label={t("low_24h")} value={inUsd(stats?.low_24h)} />
              <Stat
                label={t("volume_24h")}
                value={
                  !stats
                    ? "–"
                    : quoteUsd !== null
                      ? `$${compact(stats.volume1_24h * quoteUsd)}`
                      : `${compact(stats.volume1_24h)} ${quote.symbol ?? ""}`
                }
              />
              <Stat label={t("trades_24h")} value={stats ? String(stats.trades_24h) : "–"} />
            </dl>
          </div>
        )}
      </div>

      {market.status === "ready" && datafeed && market.symbol ? (
        <ProChart
          className="border-t border-secondary-border"
          datafeed={datafeed}
          symbol={market.symbol}
          label={`${base.symbol ?? ""}/${quote.symbol ?? ""}`}
          sourceShort={isFallback ? t("source_subgraph") : "Dex223"}
          sourceLong={isFallback ? t("source_subgraph_long") : t("source_onchain")}
          volumeUnit={base.symbol ?? ""}
          intervals={intervals}
          interval={activeResolution}
          onInterval={(value) => setResolution(value as Resolution)}
          resolution={activeResolution}
          heightClassName={heightClassName}
          myTrades={myTrades}
          onLastBar={setLastBar}
          onTrades={onTrades}
        />
      ) : (
        <div className={clsx("relative border-t border-secondary-border", heightClassName)}>
          {market.status === "no-pool" ? (
            <EmptyState
              icon="pool"
              title={t("no_pool_title")}
              description={t("no_pool_description", {
                base: tokenB.symbol ?? "",
                quote: tokenA.symbol ?? "",
              })}
              action={
                <Link
                  href="/add"
                  className="mt-1 px-4 h-9 inline-flex items-center rounded-2 bg-green-bg text-primary-text text-14 hocus:bg-green-bg-hover duration-200"
                >
                  {t("create_pool")}
                </Link>
              }
            />
          ) : (
            <ChartSkeleton />
          )}
        </div>
      )}

      {showTrades && market.status === "ready" && datafeed?.supportsTrades && (
        <MarketTrades market={market} liveTrades={liveTrades} />
      )}
    </div>
  );
}

function usePriceFlash(price: number | null): "up" | "down" | null {
  const previous = useRef<number | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = price;
    if (before === null || price === null || before === price) return;
    setFlash(price > before ? "up" : "down");
    const timer = setTimeout(() => setFlash(null), 700);
    return () => clearTimeout(timer);
  }, [price]);
  return flash;
}

function FeeTierSelect({ market }: { market: ReturnType<typeof useChartMarket> }) {
  const t = useTranslations("TradingChart");
  if (!market.pool) return null;
  const label = (fee: number) => t("fee_tier", { fee: fee / 10_000 });
  const chip =
    "inline-flex items-center h-6 px-2 rounded-full bg-tertiary-bg text-12 text-secondary-text";
  if (market.pools.length < 2) {
    return <span className={chip}>{label(market.pool.fee)}</span>;
  }
  return (
    <label className={clsx(chip, "relative pr-6 hocus:text-primary-text")}>
      <span className="sr-only">{t("pool")}</span>
      <select
        value={market.pool.fee}
        onChange={(e) => market.selectFee(Number(e.target.value))}
        className="appearance-none bg-transparent cursor-pointer focus:outline-none"
      >
        {market.pools.map((p) => (
          <option key={p.address} value={p.fee} className="bg-primary-bg">
            {label(p.fee)}
          </option>
        ))}
      </select>
      <Svg
        iconName="small-expand-arrow"
        size={14}
        className="absolute right-1.5 pointer-events-none"
      />
    </label>
  );
}

function ChangePill({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) return null;
  const up = value >= 0;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-0.5 px-2 h-6 rounded-2 text-12 font-medium tabular-nums self-center",
        up ? "bg-green-bg text-green" : "bg-red-bg text-red-light",
      )}
    >
      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden className={up ? "" : "rotate-180"}>
        <path d="M4 1l3.5 5h-7z" fill="currentColor" />
      </svg>
      {formatPercent(Math.abs(value)).replace("+", "")}
      <span className="opacity-60 font-normal ml-0.5">24h</span>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 border-l border-secondary-border first:border-l-0">
      <dt className="text-tertiary-text whitespace-nowrap">{label}</dt>
      <dd className="text-14 text-primary-text tabular-nums whitespace-nowrap">{value}</dd>
    </div>
  );
}

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={clsx("relative bg-primary-bg rounded-3 h-[240px]", className)}>{children}</div>
  );
}
