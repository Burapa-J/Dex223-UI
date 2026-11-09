import "react-loading-skeleton/dist/skeleton.css";

import { ServerError, ServerParseError } from "@apollo/client";
import Tooltip from "@repo/ui/tooltip";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import React, { useCallback, useMemo, useState } from "react";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import { Address } from "viem";

import { useTokenMeta } from "@/app/[locale]/statistics/tokenMeta";
import Svg from "@/components/atoms/Svg";
import TokenLogo from "@/components/atoms/TokenLogo";
import Badge, { BadgeVariant } from "@/components/badges/Badge";
import Button, { ButtonColor, ButtonSize, ButtonVariant } from "@/components/buttons/Button";
import { SortingType } from "@/components/buttons/IconButton";
import Pagination from "@/components/common/Pagination";
import { FEE_AMOUNT_DETAIL } from "@/config/constants/liquidityFee";
import { getUSDAnchorTokens } from "@/config/constants/usdAnchors";
import { formatNumberKilos } from "@/functions/formatFloat";
import { computePoolTVL } from "@/functions/poolTvl";
import truncateMiddle from "@/functions/truncateMiddle";
import { isSubgraphUnavailable } from "@/graphql/thegraph/subgraphAvailability";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { usePoolsOnChainBalances } from "@/hooks/usePoolOnChainBalances";
import { Link, useRouter } from "@/i18n/routing";

import { usePoolPriceIndex, usePoolsData } from "./hooks";
import { feeApr, formatApr, tvlSeries7d, volume1d, volume7d } from "./poolMetrics";
import Sparkline from "./Sparkline";
import { PoolCategory, usePoolCategories } from "./usePoolCategories";

const PAGE_SIZE = 10;

// Reading balances costs a handful of contract calls per pool, so the fan-out is bounded.
// Anything past this keeps the subgraph's own figure; DEX223 is nowhere near the limit.
const MAX_ONCHAIN_BALANCE_POOLS = 200;

const MISSING_VALUE = "\u2013";

const renderUSD = (value: number | undefined) =>
  value === undefined ? MISSING_VALUE : `$${formatNumberKilos(value)}`;

const renderTVL = renderUSD;

function FeeApr({ pool }: { pool: any }) {
  const apr = formatApr(feeApr(pool.poolDayData, pool.tvlUSD));
  if (!apr) return <span className="text-tertiary-text">{MISSING_VALUE}</span>;
  return <span className="text-green">{apr}</span>;
}

const CATEGORY_LABEL = {
  all: "filter_all",
  stable: "filter_stable",
  eth: "filter_eth_pairs",
  erc223: "filter_erc223_native",
  mine: "filter_my_pools",
} as const satisfies Record<PoolCategory, string>;

function CategoryChips({
  available,
  category,
  setCategory,
}: {
  available: PoolCategory[];
  category: PoolCategory;
  setCategory: (category: PoolCategory) => void;
}) {
  const t = useTranslations("Liquidity");
  return (
    <div
      role="group"
      aria-label={t("filters_label")}
      className="flex gap-2 overflow-x-auto pb-1 -mb-1 w-full"
    >
      {available.map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={category === key}
          onClick={() => setCategory(key)}
          className={clsx(
            "h-8 px-3.5 rounded-20 border text-14 whitespace-nowrap duration-200",
            category === key
              ? "bg-green-bg border-green text-primary-text"
              : "bg-tertiary-bg border-transparent text-secondary-text hocus:text-primary-text hocus:bg-quaternary-bg",
          )}
        >
          {t(CATEGORY_LABEL[key])}
        </button>
      ))}
    </div>
  );
}

const DESKTOP_GRID =
  "grid-cols-[minmax(200px,2.2fr),minmax(80px,1fr),minmax(80px,1fr),minmax(80px,1fr),minmax(90px,1fr),minmax(150px,1.3fr)]";

const PoolsTableDesktop = ({
  tableData,
  sorting,
  handleSort,
  isLoading = false,
}: {
  tableData: any[];
  sorting: SortingType;
  handleSort: () => any;
  isLoading?: boolean;
}) => {
  const t = useTranslations("Liquidity");
  const chainId = useCurrentChainId();
  const tokenMeta = useTokenMeta();
  const router = useRouter();

  return (
    <div
      className={clsx(
        "hidden lg:grid px-3 rounded-3 overflow-hidden bg-table-gradient pb-2",
        DESKTOP_GRID,
      )}
    >
      <div className="h-[60px] flex items-center text-tertiary-text pl-3">{t("pool")}</div>
      <button
        type="button"
        onClick={handleSort}
        className="h-[60px] flex items-center gap-1 text-tertiary-text hocus:text-secondary-text"
        aria-label={t("sort_by_tvl")}
      >
        TVL
        <Svg
          size={20}
          iconName={sorting === SortingType.ASCENDING ? "sort-up" : "sort-down"}
          className={sorting === SortingType.NONE ? "text-tertiary-text" : "text-green"}
        />
      </button>
      <div className="h-[60px] flex items-center text-tertiary-text">{t("day_volume")}</div>
      <div className="h-[60px] flex items-center text-tertiary-text">{t("volume_7d_short")}</div>
      <div className="h-[60px] flex items-center gap-1 text-tertiary-text">
        {t("fee_apr")}
        <Tooltip iconSize={16} text={t("fee_apr_tooltip")} />
      </div>
      <div className="h-[60px] flex items-center text-tertiary-text">{t("last_7_days")}</div>

      {isLoading
        ? [...Array(10)].map((row, index) => (
            <React.Fragment key={index}>
              <SkeletonTheme
                baseColor="#2E2F2F"
                highlightColor="#272727"
                borderRadius="0.5rem"
                duration={5}
              >
                <div className="flex-nowrap flex flex-row h-[64px] gap-2 items-center pl-3">
                  <div className="flex relative flex-row h-[64px] w-[48px]">
                    <SkeletonTheme baseColor="#272727" highlightColor="#2E2F2F" duration={5}>
                      <div className="absolute left-0 top-4">
                        <Skeleton enableAnimation={true} circle={true} width={32} height={32} />
                      </div>
                      <div className="absolute left-[20px] top-4">
                        <Skeleton enableAnimation={true} circle={true} width={32} height={32} />
                      </div>
                    </SkeletonTheme>
                  </div>
                  <Skeleton enableAnimation={true} width={140} height={16} />
                </div>
                {[56, 48, 56, 44].map((width, i) => (
                  <div key={i} className="h-[64px] flex items-center">
                    <Skeleton enableAnimation={true} width={width} height={16} />
                  </div>
                ))}
                <div className="h-[64px] flex items-center">
                  <Skeleton enableAnimation={true} width={120} height={20} />
                </div>
              </SkeletonTheme>
            </React.Fragment>
          ))
        : tableData.map((o: any, index: number) => {
            const { symbol: token0Symbol, image: token0Image } = tokenMeta(o.token0);
            const { symbol: token1Symbol, image: token1Image } = tokenMeta(o.token1);
            const pairLabel = `${truncateMiddle(token0Symbol, {
              charsFromStart: 4,
              charsFromEnd: 3,
            })} / ${truncateMiddle(token1Symbol, {
              charsFromStart: 4,
              charsFromEnd: 3,
            })}`;
            const cell = "h-[64px] cursor-pointer flex items-center group-hocus:bg-tertiary-bg";

            return (
              <Link
                href={`/pools/${chainId}/${o.id}`}
                className="contents group"
                key={o.id || index}
              >
                <div className={clsx(cell, "pl-3 rounded-l-3")}>
                  <div className="flex items-center flex-shrink-0">
                    <span className="w-[32px] h-[32px] rounded-full bg-primary-bg flex items-center justify-center overflow-hidden">
                      <TokenLogo
                        src={token0Image}
                        alt={token0Symbol}
                        size={30}
                        className="h-[30px] w-[30px] rounded-full"
                      />
                    </span>
                    <span className="w-[32px] h-[32px] rounded-full bg-primary-bg flex items-center justify-center -ml-2 overflow-hidden">
                      <TokenLogo
                        src={token1Image}
                        alt={token1Symbol}
                        size={30}
                        className="h-[30px] w-[30px] rounded-full"
                      />
                    </span>
                  </div>
                  <span className="ml-3 mr-2 text-primary-text font-medium whitespace-nowrap">
                    {pairLabel}
                  </span>
                  <Badge
                    variant={BadgeVariant.PERCENTAGE}
                    percentage={`${(FEE_AMOUNT_DETAIL as any)[o.feeTier as any].label}%`}
                  />
                </div>
                <div className={clsx(cell, "text-primary-text")}>{renderTVL(o.tvlUSD)}</div>
                <div className={clsx(cell, "text-secondary-text")}>
                  {renderUSD(volume1d(o.poolDayData))}
                </div>
                <div className={clsx(cell, "text-secondary-text")}>
                  {renderUSD(volume7d(o.poolDayData))}
                </div>
                <div className={cell}>
                  <FeeApr pool={o} />
                </div>
                <div className={clsx(cell, "pr-3 rounded-r-3 relative")}>
                  <span className="group-hocus:invisible">
                    <Sparkline
                      values={tvlSeries7d(o.poolDayData)}
                      label={t("tvl_trend_label", { pair: pairLabel })}
                    />
                  </span>
                  {/* Buttons, not links: an <a> inside the row's <a> is invalid HTML. */}
                  <span className="absolute inset-y-0 left-0 right-3 hidden group-hocus:flex items-center gap-2">
                    <Button
                      type="button"
                      size={ButtonSize.SMALL}
                      colorScheme={ButtonColor.LIGHT_GREEN}
                      className="lg:px-3 whitespace-nowrap"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        router.push(`/swap?tokenA=${o.token0?.id}&tokenB=${o.token1?.id}`);
                      }}
                    >
                      {t("swap_action")}
                    </Button>
                    <Button
                      type="button"
                      size={ButtonSize.SMALL}
                      colorScheme={ButtonColor.LIGHT_GREEN}
                      className="lg:px-3 whitespace-nowrap"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        router.push(
                          `/add?tier=${o.feeTier}&tokenA=${o.token0?.id}&tokenB=${o.token1?.id}&chainId=${chainId}`,
                        );
                      }}
                    >
                      {t("add_action")}
                    </Button>
                  </span>
                </div>
              </Link>
            );
          })}
    </div>
  );
};

const PoolsTableItemMobile = ({
  // key,
  pool,
  index,
}: {
  // key: any;
  pool: any;
  index: number;
}) => {
  const t = useTranslations("Liquidity");
  const chainId = useCurrentChainId();
  const tokenMeta = useTokenMeta();
  const token0 = tokenMeta(pool.token0);
  const token1 = tokenMeta(pool.token1);

  return (
    <React.Fragment key={index}>
      <div className="flex flex-col bg-primary-bg pt-3 px-4 pb-4 rounded-3 gap-3">
        <div className="flex justify-between gap-2">
          <div className="flex flex-row items-start gap-x-2 text-16">
            <TokenLogo src={token0.image} alt={token0.symbol} size={24} className="rounded-full" />
            <TokenLogo
              src={token1.image}
              alt={token1.symbol}
              size={24}
              className="ml-[-20px] bg-primary-bg rounded-full"
            />
            <span>{`${token0.symbol}/${token1.symbol}`}</span>
          </div>
          <div className="flex gap-2 items-baseline mt-0.5 justify-start mr-auto">
            <Badge
              // size="small"
              variant={BadgeVariant.PERCENTAGE}
              percentage={`${(FEE_AMOUNT_DETAIL as any)[pool.feeTier].label}%`}
            />
          </div>
          <span className="text-secondary-text items-baseline whitespace-nowrap font-normal">{`# ${index}`}</span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between gap-x-2">
            <div className="flex w-full flex-col items-start bg-tertiary-bg rounded-2 px-4 py-[10px]">
              <span className="text-14 text-tertiary-text">{t("fee_apr")}</span>
              <span className="text-14">
                <FeeApr pool={pool} />
              </span>
            </div>
            <div className="flex w-full flex-col items-start bg-tertiary-bg rounded-2 px-4 py-[10px]">
              <span className="text-14 text-tertiary-text">TVL</span>
              <span className="text-14 text-secondary-text">{renderTVL(pool.tvlUSD)}</span>
            </div>
            {/*<div className="flex w-full flex-col items-start gap-1 bg-tertiary-bg rounded-2 px-4 py-[10px]">*/}
            {/*  <span className="text-12 text-secondary-text">Turnover</span>*/}
            {/*  <span className="text-12">{`— %`}</span>*/}
            {/*</div>*/}
          </div>
          <div className="flex justify-between gap-x-2 pb-1">
            <div className="flex w-full flex-col items-start bg-tertiary-bg rounded-2 px-4 py-[10px]">
              <span className="text-14 text-tertiary-text">{t("volume_1d")}</span>
              <span className="text-14 text-secondary-text">
                {renderUSD(volume1d(pool.poolDayData))}
              </span>
            </div>
            <div className="flex w-full flex-col items-start bg-tertiary-bg rounded-2 px-4 py-[10px]">
              <span className="text-14 text-tertiary-text">{t("volume_7d")}</span>
              <span className="text-14 text-secondary-text">
                {renderUSD(volume7d(pool.poolDayData))}
              </span>
            </div>
          </div>
        </div>

        <Link href={`/pools/${chainId}/${pool.id}`}>
          <Button
            variant={ButtonVariant.CONTAINED}
            colorScheme={ButtonColor.LIGHT_GREEN}
            size={ButtonSize.MEDIUM}
          >
            {t("view_pool")}
          </Button>
        </Link>
      </div>
    </React.Fragment>
  );
};

const PoolsTableMobile = ({
  tableData,
  currentPage,
  handleSort,
  sorting,
  isLoading = false,
}: {
  tableData: any[];
  currentPage: number;
  handleSort: () => any;
  sorting: SortingType;
  isLoading?: boolean;
}) => {
  return (
    <>
      <div
        className="flex mb-4 gap-2 text-secondary-text flex-row cursor-pointer lg:hidden"
        onClick={handleSort}
      >
        <span className={sorting === SortingType.NONE ? "text-secondary-text" : "text-green"}>
          TVL
        </span>
        <Svg
          iconName={sorting === SortingType.ASCENDING ? "sort-up" : "sort-down"}
          className={sorting === SortingType.NONE ? "text-secondary-text" : "text-green"}
        />
      </div>
      <div className="flex lg:hidden flex-col gap-4">
        {/* Without this the cards render their TVL before the price index lands, which is
            the one number they exist to show and the one that changes once it does. */}
        {isLoading
          ? [...Array(5)].map((_, index) => (
              <div
                key={index}
                className="h-[148px] bg-primary-bg rounded-3 motion-safe:animate-pulse"
              />
            ))
          : tableData.map((pool: any, index: number) => {
              return (
                <PoolsTableItemMobile
                  key={pool.id || index}
                  index={(currentPage - 1) * PAGE_SIZE + index + 1}
                  pool={pool}
                />
              );
            })}
      </div>
    </>
  );
};

function localSorting(data: any[], sorting: SortingType): any[] {
  const arrayForSort = [...data];

  if (sorting === SortingType.NONE) {
    return arrayForSort;
  }

  const direction = sorting === SortingType.DESCENDING ? -1 : 1;

  arrayForSort.sort((a, b) => {
    if (a.tvlUSD === undefined || b.tvlUSD === undefined) {
      return (a.tvlUSD === undefined ? 1 : 0) - (b.tvlUSD === undefined ? 1 : 0);
    }

    return direction * (a.tvlUSD - b.tvlUSD);
  });

  return arrayForSort;
}

export default function PoolsTable({
  filter,
}: {
  filter?: {
    token0Address?: Address;
    token1Address?: Address;
    searchString?: string;
  };
}) {
  const [sorting, setSorting] = useState<SortingType>(SortingType.NONE);
  const t = useTranslations("Liquidity");

  const handleSort = useCallback(() => {
    switch (sorting) {
      case SortingType.NONE:
        setSorting(SortingType.DESCENDING);
        return;
      case SortingType.DESCENDING:
        setSorting(SortingType.ASCENDING);
        return;
      case SortingType.ASCENDING:
        setSorting(SortingType.NONE);
        return;
    }
  }, [sorting]);

  const [currentPage, setCurrentPage] = useState(1);

  const chainId = useCurrentChainId();
  const { data, loading, error, refetch } = usePoolsData({
    chainId,
    orderDirection: undefined, //sorting],
    filter,
  });
  const { priceIndex, loading: pricesLoading } = usePoolPriceIndex(chainId);
  // The Graph's WAF answers some search text (e.g. "or 1=1") with a 403 before the
  // query runs. Treat that as no matching pools instead of a load failure.
  const searchBlocked =
    Boolean(filter?.searchString) &&
    (error?.networkError as ServerError | ServerParseError | undefined)?.statusCode === 403;
  const subgraphUnavailable = isSubgraphUnavailable(error);

  const poolAddresses = useMemo(
    () =>
      (data?.pools || [])
        .slice(0, MAX_ONCHAIN_BALANCE_POOLS)
        .map((pool: any) => pool.id as Address),
    [data?.pools],
  );

  // Same reason the pool page reads balances on-chain: the subgraph's per-token totals
  // drift from what a pool holds, and valuing the drift is what makes a $423 pool read
  // $827. The list has to read them too, or its rows contradict the page they open.
  const { balances: onChainBalances, isLoading: balancesLoading } = usePoolsOnChainBalances({
    poolAddresses,
    chainId,
  });

  const [category, setCategoryState] = useState<PoolCategory>("all");
  const setCategory = useCallback((next: PoolCategory) => {
    setCategoryState(next);
    setCurrentPage(1);
  }, []);
  const {
    available: availableCategories,
    matches: matchesCategory,
    loading: categoryLoading,
  } = usePoolCategories({ pools: data?.pools || [], chainId, category });
  // A chip that stops applying (wallet disconnected, chain switched) falls back to "All".
  const activeCategory = availableCategories.includes(category) ? category : "all";

  const subgraphFallback = getUSDAnchorTokens(chainId).length === 0;
  const pools: any[] = useMemo(() => {
    // The subgraph also prices every pool with one global price per token, which overstates
    // any pool trading away from that price - see computePoolTVL. Chains with no stablecoin
    // to anchor on have nothing better to offer, so they keep the subgraph's figure.
    const pools = (data?.pools || []).map((pool: any) => {
      const balances = onChainBalances[pool.id?.toLowerCase()];

      return {
        ...pool,
        tvlUSD: computePoolTVL({
          pool,
          balance0: balances?.token0.formatted,
          balance1: balances?.token1.formatted,
          priceIndex,
          subgraphFallback,
        }),
      };
    });

    return localSorting(activeCategory === "all" ? pools : pools.filter(matchesCategory), sorting);
  }, [
    data?.pools,
    onChainBalances,
    priceIndex,
    subgraphFallback,
    sorting,
    activeCategory,
    matchesCategory,
  ]);

  const isLoading = loading || pricesLoading || balancesLoading || categoryLoading;

  const currentTableData = useMemo(() => {
    const firstPageIndex = (currentPage - 1) * PAGE_SIZE;
    const lastPageIndex = firstPageIndex + PAGE_SIZE;
    return pools.slice(firstPageIndex, lastPageIndex);
  }, [pools, currentPage]);

  return (
    <>
      <div className="min-h-[640px] mb-5 w-full">
        {availableCategories.length > 1 && (
          <div className="mb-4">
            <CategoryChips
              available={availableCategories}
              category={activeCategory}
              setCategory={setCategory}
            />
          </div>
        )}
        <>
          {error && !searchBlocked && pools.length === 0 ? (
            <div className="min-h-[340px] bg-primary-bg flex flex-col gap-4 items-center justify-center w-full rounded-5 px-4 text-center">
              <p className="text-secondary-text">
                {subgraphUnavailable ? t("pools_unavailable") : t("pools_load_error")}
              </p>
              {subgraphUnavailable ? null : (
                <Button
                  size={ButtonSize.MEDIUM}
                  colorScheme={ButtonColor.LIGHT_GREEN}
                  onClick={() => refetch()}
                >
                  {t("try_again")}
                </Button>
              )}
            </div>
          ) : isLoading || pools.length > 0 ? (
            <>
              <PoolsTableDesktop
                isLoading={isLoading}
                tableData={currentTableData}
                sorting={sorting}
                handleSort={handleSort}
              />
              <PoolsTableMobile
                isLoading={isLoading}
                tableData={currentTableData}
                sorting={sorting}
                currentPage={currentPage}
                handleSort={handleSort}
              />
            </>
          ) : (
            <div className="min-h-[340px] bg-primary-bg flex items-center justify-center w-full rounded-5 bg-empty-not-found-pools bg-right-top bg-no-repeat max-md:bg-size-180">
              <p className="text-secondary-text">{t("pools_not_found")}</p>
            </div>
          )}
        </>
        {/*)}*/}
      </div>

      <Pagination
        isLoading={isLoading}
        className="pagination-bar"
        currentPage={currentPage}
        totalCount={pools.length}
        pageSize={PAGE_SIZE}
        onPageChange={(page) => setCurrentPage(page as number)}
      />
    </>
  );
}
