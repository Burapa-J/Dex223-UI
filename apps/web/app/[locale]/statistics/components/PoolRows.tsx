"use client";

import { useTranslations } from "next-intl";

import { formatUsd, poolTvlUsd } from "@/app/[locale]/statistics/formatLiquidity";
import { useTokenMeta } from "@/app/[locale]/statistics/tokenMeta";
import TokenLogo from "@/components/atoms/TokenLogo";
import { FEE_AMOUNT_DETAIL } from "@/config/constants/liquidityFee";
import { TokenPriceIndex } from "@/functions/poolTvl";
import { Link } from "@/i18n/routing";
import { FeeAmount } from "@/sdk_bi/constants";

export default function PoolRows({
  pools,
  chainId,
  priceIndex,
  tvlLabel,
}: {
  pools: any[];
  chainId: number;
  priceIndex: TokenPriceIndex;
  tvlLabel: string;
}) {
  const t = useTranslations("Statistics");
  const tokenMeta = useTokenMeta();

  return (
    <div className="divide-y divide-secondary-border">
      {pools.map((pool: any, index: number) => {
        const token0 = tokenMeta(pool.token0);
        const token1 = tokenMeta(pool.token1);
        const feeLabel =
          FEE_AMOUNT_DETAIL[pool.feeTier as FeeAmount]?.label ??
          String(Number(pool.feeTier) / 10000);
        const tvl = poolTvlUsd(priceIndex, pool);

        return (
          <Link
            key={pool.id}
            href={`/pools/${chainId}/${pool.id}`}
            className="flex items-center gap-3 px-5 py-3 hocus:bg-tertiary-bg duration-200"
          >
            <span className="text-secondary-text w-6 shrink-0 text-14">{index + 1}</span>
            <div className="relative w-10 h-6 shrink-0">
              <span className="absolute left-0 top-0 w-6 h-6 rounded-full overflow-hidden bg-secondary-bg">
                <TokenLogo src={token0.image} alt={token0.symbol} size={24} />
              </span>
              <span className="absolute left-3 top-0 w-6 h-6 rounded-full overflow-hidden bg-secondary-bg">
                <TokenLogo src={token1.image} alt={token1.symbol} size={24} />
              </span>
            </div>
            <div className="flex-grow min-w-0">
              <div className="text-14 md:text-16 font-medium truncate">
                {token0.symbol} / {token1.symbol}
              </div>
              <div className="text-12 text-secondary-text">{feeLabel}%</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-14 md:text-16 font-medium">
                {tvl ? formatUsd(tvl) : t("usd_unavailable")}
              </div>
              <div className="text-12 text-secondary-text">{tvlLabel}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
