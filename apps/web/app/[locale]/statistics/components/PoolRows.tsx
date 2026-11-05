"use client";

import { formatUsdOrEth } from "@/app/[locale]/statistics/formatLiquidity";
import { useTokenMeta } from "@/app/[locale]/statistics/tokenMeta";
import TokenLogo from "@/components/atoms/TokenLogo";
import { FEE_AMOUNT_DETAIL } from "@/config/constants/liquidityFee";
import { Link } from "@/i18n/routing";
import { FeeAmount } from "@/sdk_bi/constants";

export default function PoolRows({
  pools,
  chainId,
  tvlLabel,
}: {
  pools: any[];
  chainId: number;
  tvlLabel: string;
}) {
  const tokenMeta = useTokenMeta();

  return (
    <div className="divide-y divide-secondary-border">
      {pools.map((pool: any, index: number) => {
        const token0 = tokenMeta(pool.token0);
        const token1 = tokenMeta(pool.token1);
        const feeLabel =
          FEE_AMOUNT_DETAIL[pool.feeTier as FeeAmount]?.label ??
          String(Number(pool.feeTier) / 10000);

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
                {formatUsdOrEth(pool.totalValueLockedUSD, pool.totalValueLockedETH)}
              </div>
              <div className="text-12 text-secondary-text">{tvlLabel}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
