"use client";

import { useTranslations } from "next-intl";
import React, { use, useEffect, useRef, useState } from "react";

import { usePoolPriceIndex } from "@/app/[locale]/pools/hooks";
import ChartRangeToggle from "@/app/[locale]/statistics/components/ChartRangeToggle";
import PoolRows from "@/app/[locale]/statistics/components/PoolRows";
import StatisticsShell from "@/app/[locale]/statistics/components/StatisticsShell";
import ValueChart, { ValuePoint } from "@/app/[locale]/statistics/components/ValueChart";
import { formatUsd, tokenTvlUsd } from "@/app/[locale]/statistics/formatLiquidity";
import { useTokenDetail } from "@/app/[locale]/statistics/hooks";
import { useTokenMeta } from "@/app/[locale]/statistics/tokenMeta";
import TokenLogo from "@/components/atoms/TokenLogo";
import { formatNumberKilos } from "@/functions/formatFloat";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { ChartRange } from "@/hooks/usePoolPriceChart";
import { Link } from "@/i18n/routing";

export default function StatisticsTokenDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  const t = useTranslations("Statistics");
  const chainId = useCurrentChainId();
  const { priceIndex } = usePoolPriceIndex(chainId);
  const tokenMeta = useTokenMeta();
  const [days, setDays] = useState<ChartRange>(30);
  const { token, pools, priceSeries, volumeSeries, loading, error } = useTokenDetail(
    chainId,
    address,
    days,
  );

  const [priceWidth, setPriceWidth] = useState(400);
  const [volWidth, setVolWidth] = useState(400);
  const [priceHover, setPriceHover] = useState<ValuePoint | null>(null);
  const [volHover, setVolHover] = useState<ValuePoint | null>(null);
  const priceRef = useRef<HTMLDivElement>(null);
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
    const a = bind(priceRef.current, setPriceWidth);
    const b = bind(volRef.current, setVolWidth);
    return () => {
      a();
      b();
    };
  }, []);

  const meta = token ? tokenMeta(token) : null;

  return (
    <StatisticsShell>
      <div className="mb-4">
        <Link
          href="/statistics/tokens"
          className="text-14 text-green hocus:text-green-hover duration-200"
        >
          ← {t("tab_tokens")}
        </Link>
      </div>

      {error && !token ? (
        <div className="bg-primary-bg rounded-5 px-5 py-8 text-center text-secondary-text">
          {t("unavailable")}
        </div>
      ) : loading && !token ? (
        <div className="bg-primary-bg rounded-5 px-5 py-8 text-center text-secondary-text">
          {t("loading_tokens")}
        </div>
      ) : !token ? (
        <div className="bg-primary-bg rounded-5 px-5 py-8 text-center text-secondary-text">
          {t("token_not_found")}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-5">
            {meta ? (
              <span className="w-10 h-10 rounded-full overflow-hidden bg-secondary-bg">
                <TokenLogo src={meta.image} alt={meta.symbol} size={40} />
              </span>
            ) : null}
            <div>
              <h2 className="text-24 font-medium">{meta?.symbol}</h2>
              <p className="text-14 text-secondary-text">{token.name}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-6">
            <div className="bg-primary-bg rounded-5 px-5 py-4">
              <div className="text-14 text-secondary-text">{t("tvl")}</div>
              <div className="text-20 font-medium">
                {tokenTvlUsd(priceIndex, token)
                  ? formatUsd(tokenTvlUsd(priceIndex, token) as number)
                  : t("usd_unavailable")}
              </div>
            </div>
            <div className="bg-primary-bg rounded-5 px-5 py-4">
              <div className="text-14 text-secondary-text">{t("col_volume")}</div>
              <div className="text-20 font-medium">
                {Number(token.volumeUSD) > 0
                  ? `$${formatNumberKilos(Number(token.volumeUSD))}`
                  : "—"}
              </div>
            </div>
            <div className="bg-primary-bg rounded-5 px-5 py-4">
              <div className="text-14 text-secondary-text">{t("transactions")}</div>
              <div className="text-20 font-medium">
                {formatNumberKilos(Number(token.txCount), { trimZero: true })}
              </div>
            </div>
            <div className="bg-primary-bg rounded-5 px-5 py-4">
              <div className="text-14 text-secondary-text">{t("pools")}</div>
              <div className="text-20 font-medium">
                {formatNumberKilos(pools.length, { trimZero: true })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-5 mb-6">
            <div className="bg-primary-bg rounded-5 px-4 py-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-14 text-secondary-text">{t("chart_price")}</div>
                  <div className="text-20 font-medium">
                    {priceHover?.value || priceSeries[priceSeries.length - 1]?.value
                      ? formatUsd(
                          priceHover?.value ?? priceSeries[priceSeries.length - 1]?.value ?? 0,
                        )
                      : t("usd_unavailable")}
                  </div>
                </div>
                <ChartRangeToggle value={days} onChange={setDays} />
              </div>
              <div ref={priceRef} className="w-full">
                <ValueChart
                  series={priceSeries}
                  width={priceWidth}
                  height={160}
                  isLoading={loading}
                  emptyLabel={t("chart_empty")}
                  onHover={setPriceHover}
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

          <div className="bg-primary-bg rounded-5 overflow-hidden">
            <div className="px-5 py-4 border-b border-secondary-border">
              <h3 className="text-18 font-medium">{t("token_pools")}</h3>
            </div>
            {pools.length === 0 ? (
              <div className="px-5 py-8 text-center text-secondary-text">{t("no_pools")}</div>
            ) : (
              <PoolRows
                pools={pools}
                chainId={chainId}
                priceIndex={priceIndex}
                tvlLabel={t("tvl")}
              />
            )}
          </div>
        </>
      )}
    </StatisticsShell>
  );
}
