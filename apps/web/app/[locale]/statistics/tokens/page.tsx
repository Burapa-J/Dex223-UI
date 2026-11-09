"use client";

import { useTranslations } from "next-intl";
import React, { useMemo } from "react";

import { usePoolPriceIndex } from "@/app/[locale]/pools/hooks";
import StatisticsShell from "@/app/[locale]/statistics/components/StatisticsShell";
import { formatUsd, tokenPriceUsd, tokenTvlUsd } from "@/app/[locale]/statistics/formatLiquidity";
import { useTokensData } from "@/app/[locale]/statistics/hooks";
import { useTokenMeta } from "@/app/[locale]/statistics/tokenMeta";
import TokenLogo from "@/components/atoms/TokenLogo";
import { formatNumberKilos } from "@/functions/formatFloat";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { Link } from "@/i18n/routing";

export default function StatisticsTokensPage() {
  const t = useTranslations("Statistics");
  const chainId = useCurrentChainId();
  const { priceIndex } = usePoolPriceIndex(chainId);
  const tokenMeta = useTokenMeta();
  const { data, loading, error } = useTokensData(chainId, 50);
  const tokens = useMemo(() => data?.tokens ?? [], [data?.tokens]);

  return (
    <StatisticsShell>
      {error && tokens.length === 0 ? (
        <div className="bg-primary-bg rounded-5 px-5 py-8 text-center text-secondary-text">
          {t("unavailable")}
        </div>
      ) : (
        <div className="bg-primary-bg rounded-5 overflow-hidden">
          <div className="hidden md:grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr] gap-3 px-5 py-3 text-12 text-tertiary-text border-b border-secondary-border">
            <span>{t("col_token")}</span>
            <span className="text-right">{t("tvl")}</span>
            <span className="text-right">{t("col_volume")}</span>
            <span className="text-right">{t("col_price")}</span>
          </div>

          {loading && tokens.length === 0 ? (
            <div className="px-5 py-8 text-center text-secondary-text">{t("loading_tokens")}</div>
          ) : tokens.length === 0 ? (
            <div className="px-5 py-8 text-center text-secondary-text">{t("no_tokens")}</div>
          ) : (
            <div className="divide-y divide-secondary-border">
              {tokens.map((token: any, index: number) => {
                const meta = tokenMeta(token);
                const price = tokenPriceUsd(
                  priceIndex,
                  token.id,
                  token.tokenDayData?.[0]?.priceUSD,
                );
                const tvl = tokenTvlUsd(priceIndex, token);

                return (
                  <Link
                    key={token.id}
                    href={`/statistics/tokens/${token.id}`}
                    className="grid grid-cols-[minmax(0,2fr)_1fr] md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr] gap-3 items-center px-5 py-3 hocus:bg-tertiary-bg duration-200"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-secondary-text text-14 w-6 shrink-0">{index + 1}</span>
                      <span className="w-7 h-7 rounded-full overflow-hidden bg-secondary-bg shrink-0">
                        <TokenLogo src={meta.image} alt={meta.symbol} size={28} />
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{meta.symbol}</div>
                        <div className="text-12 text-secondary-text truncate">{token.name}</div>
                      </div>
                    </div>
                    <div className="text-right text-14">
                      {tvl ? formatUsd(tvl) : t("usd_unavailable")}
                    </div>
                    <div className="hidden md:block text-right text-14">
                      {Number(token.volumeUSD) > 0
                        ? `$${formatNumberKilos(Number(token.volumeUSD))}`
                        : "—"}
                    </div>
                    <div className="hidden md:block text-right text-14">
                      {price ? formatUsd(price) : t("usd_unavailable")}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </StatisticsShell>
  );
}
