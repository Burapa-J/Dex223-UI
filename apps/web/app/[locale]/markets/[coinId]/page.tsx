"use client";

import clsx from "clsx";
import { useTranslations } from "next-intl";
import { use, useState } from "react";

import Container from "@/components/atoms/Container";
import Svg from "@/components/atoms/Svg";
import TokenLogo from "@/components/atoms/TokenLogo";
import Badge, { BadgeVariant } from "@/components/badges/Badge";
import { NotFoundError, useCoin } from "@/components/markets/api";
import CoinChart from "@/components/markets/CoinChart";
import {
  displayedChange24h,
  displayedCoinPrice,
  formatMarketDate,
  formatUsd,
  formatUsdCompact,
} from "@/components/markets/format";
import OrderBookCard from "@/components/markets/OrderBookCard";
import { compact, formatPercent } from "@/components/trading-chart/format";
import { Link } from "@/i18n/routing";

export default function CoinPage({ params }: { params: Promise<{ coinId: string }> }) {
  const { coinId } = use(params);
  const t = useTranslations("Markets");
  const { data: coin, error, isLoading } = useCoin(coinId);
  const [liveBar, setLiveBar] = useState<{ coinId: string; close: number } | null>(null);

  if (error instanceof NotFoundError || (!isLoading && !coin)) {
    return (
      <Container>
        <div className="py-16 text-center">
          <p className="text-20 text-primary-text mb-3">
            {error instanceof NotFoundError ? t("not_found") : t("unavailable")}
          </p>
          <Link href="/markets" className="text-green hocus:text-green-hover">
            {t("back")}
          </Link>
        </div>
      </Container>
    );
  }

  // The chart's live bar is fresher than the listing, which refreshes every few minutes.
  const price = displayedCoinPrice(coinId, liveBar, coin?.price);
  const change = displayedChange24h(coin?.price, coin?.change_24h, price);
  const fromAth = coin?.ath && price ? ((price - coin.ath) / coin.ath) * 100 : null;
  const source = coin?.binance_symbol ? `Binance ${coin.binance_symbol}` : "CoinGecko";

  return (
    <Container>
      <div className="py-4 md:py-6">
        <Link
          href="/markets"
          className="inline-flex items-center gap-1 text-14 text-secondary-text hocus:text-primary-text duration-200 mb-4"
        >
          <Svg iconName="back" size={20} />
          {t("back")}
        </Link>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
          <div className="flex flex-col gap-5 min-w-0">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-3 min-w-0">
                {coin ? (
                  <TokenLogo
                    src={coin.image}
                    alt={coin.symbol}
                    size={40}
                    className="rounded-full w-10 h-10 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-tertiary-bg animate-pulse shrink-0" />
                )}
                <div className="min-w-0">
                  <h1 className="text-20 md:text-24 font-medium text-primary-text leading-none">
                    {coin?.name ?? " "}{" "}
                    <span className="text-16 text-tertiary-text font-normal">{coin?.symbol}</span>
                  </h1>
                  {coin?.rank && (
                    <Badge
                      variant={BadgeVariant.DEFAULT}
                      text={t("rank", { rank: coin.rank })}
                      className="mt-1.5 text-12 py-0.5"
                    />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-32 font-medium leading-none text-primary-text tabular-nums">
                  {formatUsd(price)}
                </span>
                {change !== null && (
                  <span
                    className={clsx(
                      "px-2 py-0.5 rounded-2 text-14 font-medium tabular-nums",
                      change >= 0 ? "bg-green-bg text-green" : "bg-red-bg text-red-light",
                    )}
                  >
                    {formatPercent(change)}{" "}
                    <span className="text-12 opacity-70">{t("col_24h")}</span>
                  </span>
                )}
              </div>
            </div>

            {coin && (
              <CoinChart
                symbol={coin.chart_symbol}
                label={`${coin.symbol}/USD`}
                volumeUnit={coin.symbol}
                sourceLong={`${t("chart_source", { source })} · ${t("attribution")}`}
                onLastBar={(bar) => setLiveBar(bar ? { coinId, close: bar.close } : null)}
              />
            )}
          </div>

          {/* Stats */}
          <aside className="flex flex-col gap-3">
            <div className="bg-primary-bg rounded-5 p-5">
              <RangeBar
                label={t("range_24h")}
                low={coin?.low_24h ?? null}
                high={coin?.high_24h ?? null}
                value={price}
                logo={coin?.image}
                symbol={coin?.symbol}
              />
            </div>
            {coin?.binance_symbol && <OrderBookCard pair={coin.binance_symbol} />}
            <div className="bg-primary-bg rounded-5 p-5 flex flex-col gap-3 text-14">
              <StatRow label={t("market_cap")} value={formatUsdCompact(coin?.market_cap)} />
              <StatRow label={t("fdv")} value={formatUsdCompact(coin?.fdv)} />
              <StatRow label={t("volume_24h")} value={formatUsdCompact(coin?.volume_24h)} />
              <StatRow
                label={t("volume_market_cap")}
                value={
                  coin?.volume_24h && coin.market_cap
                    ? `${((coin.volume_24h / coin.market_cap) * 100).toFixed(2)}%`
                    : "–"
                }
              />
            </div>
            <div className="bg-primary-bg rounded-5 p-5 flex flex-col gap-3 text-14">
              <StatRow
                label={t("circulating")}
                value={
                  coin?.circulating_supply
                    ? `${compact(coin.circulating_supply)} ${coin.symbol}`
                    : "–"
                }
              />
              {coin?.circulating_supply && coin.max_supply ? (
                <MarkerTrack
                  position={Math.min(100, (coin.circulating_supply / coin.max_supply) * 100)}
                  label={t("circulating")}
                  logo={coin.image}
                  symbol={coin.symbol}
                />
              ) : null}
              <StatRow
                label={t("total_supply")}
                value={coin?.total_supply ? `${compact(coin.total_supply)} ${coin.symbol}` : "–"}
              />
              <StatRow
                label={t("max_supply")}
                value={
                  !coin ? "–" : coin.max_supply ? `${compact(coin.max_supply)} ${coin.symbol}` : "∞"
                }
              />
            </div>
            <div className="bg-primary-bg rounded-5 p-5 flex flex-col gap-3 text-14">
              <StatRow
                label={t("ath")}
                value={formatUsd(coin?.ath)}
                detail={
                  coin?.ath
                    ? `${formatMarketDate(coin.ath_date)}${fromAth !== null ? ` · ${t("from_ath", { percent: formatPercent(fromAth) })}` : ""}`
                    : undefined
                }
              />
              <StatRow
                label={t("atl")}
                value={formatUsd(coin?.atl)}
                detail={formatMarketDate(coin?.atl_date) || undefined}
              />
            </div>
          </aside>
        </div>
      </div>
    </Container>
  );
}

function StatRow({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-tertiary-text">{label}</span>
      <span className="text-right">
        <span className="block text-primary-text tabular-nums">{value}</span>
        {detail && <span className="block text-12 text-tertiary-text">{detail}</span>}
      </span>
    </div>
  );
}

function RangeBar({
  label,
  low,
  high,
  value,
  logo,
  symbol,
}: {
  label: string;
  low: number | null;
  high: number | null;
  value: number | null;
  logo?: string | null;
  symbol?: string;
}) {
  const position =
    low !== null && high !== null && value !== null && high > low
      ? Math.min(100, Math.max(0, ((value - low) / (high - low)) * 100))
      : null;
  return (
    <div>
      <div className="text-14 text-tertiary-text mb-2">{label}</div>
      <div className="grid grid-cols-3 mb-3 text-12 tabular-nums">
        <div className="text-secondary-text">{formatUsd(low)}</div>
        <div className="text-center text-primary-text">{formatUsd(value)}</div>
        <div className="text-right text-secondary-text">{formatUsd(high)}</div>
      </div>
      <MarkerTrack
        position={position}
        label={label}
        logo={logo}
        symbol={symbol}
        min={low ?? undefined}
        max={high ?? undefined}
        now={value ?? undefined}
      />
    </div>
  );
}

function MarkerTrack({
  position,
  label,
  logo,
  symbol,
  min = 0,
  max = 100,
  now,
}: {
  position: number | null;
  label: string;
  logo?: string | null;
  symbol?: string;
  min?: number;
  max?: number;
  now?: number;
}) {
  const zone = position === null ? null : position < 40 ? "low" : position < 60 ? "mid" : "high";
  return (
    <div
      className="relative h-6"
      role="meter"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={now ?? (position === null ? undefined : Math.round(position))}
    >
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 grid grid-cols-[2fr_1fr_2fr] h-[5px]">
        <div className="h-full bg-red-light" />
        <div className="h-full bg-orange" />
        <div className="h-full bg-green" />
      </div>
      {position !== null && (
        <div
          className={clsx(
            "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full border-2 bg-primary-bg overflow-hidden",
            zone === "low" && "border-red-light",
            zone === "mid" && "border-orange",
            zone === "high" && "border-green",
          )}
          style={{ left: `clamp(12px, ${position}%, calc(100% - 12px))` }}
        >
          <TokenLogo
            src={logo}
            alt={symbol ?? ""}
            size={20}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full w-5 h-5"
          />
        </div>
      )}
    </div>
  );
}
