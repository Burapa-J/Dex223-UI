"use client";

import { useTranslations } from "next-intl";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { usePoolsData } from "@/app/[locale]/pools/hooks";
import ChartRangeToggle from "@/app/[locale]/statistics/components/ChartRangeToggle";
import PoolRows from "@/app/[locale]/statistics/components/PoolRows";
import StatisticsShell from "@/app/[locale]/statistics/components/StatisticsShell";
import ValueChart, { ValuePoint } from "@/app/[locale]/statistics/components/ValueChart";
import { formatUsdOrEth, sortPoolsByTvl } from "@/app/[locale]/statistics/formatLiquidity";
import { useDex223DayData, useFactoryStats } from "@/app/[locale]/statistics/hooks";
import { formatNumberKilos } from "@/functions/formatFloat";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { ChartRange } from "@/hooks/usePoolPriceChart";
import { Link } from "@/i18n/routing";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-primary-bg rounded-5 px-5 py-4 flex flex-col gap-1">
      <span className="text-14 text-secondary-text">{label}</span>
      <span className="text-24 font-medium text-primary-text">{value}</span>
    </div>
  );
}

function OverviewCharts({ chainId }: { chainId: ReturnType<typeof useCurrentChainId> }) {
  const t = useTranslations("Statistics");
  const [days, setDays] = useState<ChartRange>(30);
  const { series, loading } = useDex223DayData(chainId, days);

  const tvlSeries = useMemo(() => series.map((d) => ({ date: d.date, value: d.tvlUSD })), [series]);
  const volumeSeries = useMemo(
    () => series.map((d) => ({ date: d.date, value: d.volumeUSD })),
    [series],
  );

  const [tvlWidth, setTvlWidth] = useState(400);
  const [volWidth, setVolWidth] = useState(400);
  const [tvlHover, setTvlHover] = useState<ValuePoint | null>(null);
  const [volHover, setVolHover] = useState<ValuePoint | null>(null);
  const tvlRef = useRef<HTMLDivElement>(null);
  const volRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bind = (el: HTMLDivElement | null, set: (n: number) => void) => {
      if (!el || typeof ResizeObserver === "undefined") return () => {};
      const apply = (n: number) => {
        const floored = Math.floor(n);
        if (floored > 0) set(floored);
      };
      apply(el.clientWidth);
      const observer = new ResizeObserver((entries) => {
        if (entries[0]) apply(entries[0].contentRect.width);
      });
      observer.observe(el);
      return () => observer.disconnect();
    };
    const a = bind(tvlRef.current, setTvlWidth);
    const b = bind(volRef.current, setVolWidth);
    return () => {
      a();
      b();
    };
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-5 mb-6">
      <div className="bg-primary-bg rounded-5 px-4 py-4 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-14 text-secondary-text">{t("chart_tvl")}</div>
            <div className="text-20 font-medium">
              ${formatNumberKilos(tvlHover?.value ?? tvlSeries[tvlSeries.length - 1]?.value ?? 0)}
            </div>
          </div>
          <ChartRangeToggle value={days} onChange={setDays} />
        </div>
        <div ref={tvlRef} className="w-full">
          <ValueChart
            series={tvlSeries}
            width={tvlWidth}
            height={160}
            isLoading={loading}
            emptyLabel={t("chart_empty")}
            onHover={setTvlHover}
          />
        </div>
      </div>
      <div className="bg-primary-bg rounded-5 px-4 py-4 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-14 text-secondary-text">{t("chart_volume")}</div>
            <div className="text-20 font-medium">
              $
              {formatNumberKilos(
                volHover?.value ?? volumeSeries[volumeSeries.length - 1]?.value ?? 0,
              )}
            </div>
          </div>
          <ChartRangeToggle value={days} onChange={setDays} />
        </div>
        <div ref={volRef} className="w-full">
          <ValueChart
            series={volumeSeries}
            width={volWidth}
            height={160}
            isLoading={loading}
            emptyLabel={t("chart_empty")}
            onHover={setVolHover}
          />
        </div>
      </div>
    </div>
  );
}

export default function StatisticsOverviewPage() {
  const t = useTranslations("Statistics");
  const chainId = useCurrentChainId();
  const {
    data: factoryData,
    loading: factoryLoading,
    error: factoryError,
  } = useFactoryStats(chainId);
  const {
    data: poolsData,
    loading: poolsLoading,
    error: poolsError,
  } = usePoolsData({
    first: 10,
    orderDirection: "desc",
    chainId,
  });

  const factory = factoryData?.factories?.[0];
  const pools = useMemo(() => sortPoolsByTvl(poolsData?.pools ?? []), [poolsData?.pools]);
  const loading = factoryLoading || poolsLoading;
  const hasError = Boolean(factoryError || poolsError);
  const hasFactory = Boolean(factory);

  return (
    <StatisticsShell>
      {hasError && !hasFactory ? (
        <div className="bg-primary-bg rounded-5 px-5 py-8 text-center text-secondary-text">
          {t("unavailable")}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-6">
            <StatCard
              label={t("tvl")}
              value={
                loading && !factory
                  ? "—"
                  : formatUsdOrEth(factory?.totalValueLockedUSD, factory?.totalValueLockedETH)
              }
            />
            <StatCard
              label={t("volume")}
              value={
                loading && !factory
                  ? "—"
                  : formatUsdOrEth(factory?.totalVolumeUSD, factory?.totalVolumeETH)
              }
            />
            <StatCard
              label={t("pools")}
              value={
                loading && !factory
                  ? "—"
                  : formatNumberKilos(Number(factory?.poolCount ?? 0), { trimZero: true })
              }
            />
            <StatCard
              label={t("transactions")}
              value={
                loading && !factory
                  ? "—"
                  : formatNumberKilos(Number(factory?.txCount ?? 0), { trimZero: true })
              }
            />
          </div>

          <OverviewCharts chainId={chainId} />

          <div className="bg-primary-bg rounded-5 overflow-hidden">
            <div className="px-5 py-4 border-b border-secondary-border flex items-center justify-between">
              <h2 className="text-18 md:text-20 font-medium">{t("top_pools")}</h2>
              <Link
                href="/statistics/pools"
                className="text-14 text-green hocus:text-green-hover duration-200"
              >
                {t("view_all_pools")}
              </Link>
            </div>

            {loading && pools.length === 0 ? (
              <div className="px-5 py-8 text-center text-secondary-text">{t("loading")}</div>
            ) : pools.length === 0 ? (
              <div className="px-5 py-8 text-center text-secondary-text">{t("no_pools")}</div>
            ) : (
              <PoolRows pools={pools} chainId={chainId} tvlLabel={t("tvl")} />
            )}
          </div>
        </>
      )}
    </StatisticsShell>
  );
}
