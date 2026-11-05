"use client";

import { useTranslations } from "next-intl";
import React, { useMemo } from "react";

import { usePoolsData } from "@/app/[locale]/pools/hooks";
import PoolRows from "@/app/[locale]/statistics/components/PoolRows";
import StatisticsShell from "@/app/[locale]/statistics/components/StatisticsShell";
import { sortPoolsByTvl } from "@/app/[locale]/statistics/formatLiquidity";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { Link } from "@/i18n/routing";

export default function StatisticsPoolsPage() {
  const t = useTranslations("Statistics");
  const chainId = useCurrentChainId();
  const { data, loading, error } = usePoolsData({
    first: 50,
    orderDirection: "desc",
    chainId,
  });
  const pools = useMemo(() => sortPoolsByTvl(data?.pools ?? []), [data?.pools]);

  return (
    <StatisticsShell>
      {error && pools.length === 0 ? (
        <div className="bg-primary-bg rounded-5 px-5 py-8 text-center text-secondary-text">
          {t("unavailable")}
        </div>
      ) : (
        <div className="bg-primary-bg rounded-5 overflow-hidden">
          <div className="px-5 py-4 border-b border-secondary-border flex items-center justify-between">
            <h2 className="text-18 md:text-20 font-medium">{t("top_pools")}</h2>
            <Link href="/pools" className="text-14 text-green hocus:text-green-hover duration-200">
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
      )}
    </StatisticsShell>
  );
}
