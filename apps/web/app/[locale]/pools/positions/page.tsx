"use client";

import Preloader from "@repo/ui/preloader";
import { useTranslations } from "next-intl";
import React, { useMemo, useState } from "react";
import { useAccount } from "wagmi";

import { useAddLiquidityTokensStore } from "@/app/[locale]/add/stores/useAddLiquidityTokensStore";
import Container from "@/components/atoms/Container";
import Svg from "@/components/atoms/Svg";
import Badge, { BadgeVariant } from "@/components/badges/Badge";
import RangeBadge, { PositionRangeStatus } from "@/components/badges/RangeBadge";
import Button, { ButtonSize } from "@/components/buttons/Button";
import TabButton from "@/components/buttons/TabButton";
import TokensPair from "@/components/common/TokensPair";
import { FEE_AMOUNT_DETAIL } from "@/config/constants/liquidityFee";
import { formatNumber } from "@/functions/formatFloat";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import usePositionPriceOrientation from "@/hooks/usePositionPriceOrientation";
import usePositions, {
  usePositionFromPositionInfo,
  usePositionPrices,
  usePositionRangeStatus,
} from "@/hooks/usePositions";
import { useRouter } from "@/i18n/routing";
import { FeeAmount } from "@/sdk_bi/constants";
import { NativeCoin } from "@/sdk_bi/entities/ether";

type PositionInfo = {
  nonce: bigint;
  operator: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  tier: FeeAmount;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
  tokenId: bigint | undefined;
};

function PoolPosition({ onClick, positionInfo }: { onClick: any; positionInfo: PositionInfo }) {
  const t = useTranslations("Liquidity");
  const position = usePositionFromPositionInfo(positionInfo);

  const [tokenA, tokenB, fee] = useMemo(() => {
    return position?.pool.token0 && position?.pool.token1 && position?.pool.fee
      ? [position.pool.token0, position.pool.token1, position.pool.fee]
      : [undefined, undefined];
  }, [position?.pool.fee, position?.pool.token0, position?.pool.token1]);

  // Same orientation as the position page (remembered per position, stablecoin/ETH as the unit
  // by default). usePositionPrices keeps Min below Max in either orientation; inverting the lower
  // and upper prices directly swapped them (Min 991.9, Max 330.2).
  const [showFirst] = usePositionPriceOrientation({
    tokenId: positionInfo.tokenId,
    token0: tokenA,
    token1: tokenB,
  });
  const { minPriceString: minTokenAPerTokenB, maxPriceString: maxTokenAPerTokenB } =
    usePositionPrices({ position, showFirst });
  const [quoteSymbol, baseSymbol] = showFirst
    ? [tokenA?.symbol, tokenB?.symbol]
    : [tokenB?.symbol, tokenA?.symbol];

  const { inRange, removed } = usePositionRangeStatus({ position });

  return (
    <div
      role="button"
      className="px-4 lg:px-5 py-4 rounded-3 bg-tertiary-bg hocus:bg-quaternary-bg duration-200 cursor-pointer"
      onClick={onClick}
    >
      <div className="justify-between md:items-center flex mb-2 gap-2">
        <div className="flex gap-2 md:items-center">
          <div className="min-h-[26px] flex items-center">
            <TokensPair tokenA={tokenA} tokenB={tokenB} variant="medium-primary" />
          </div>
          <div className="h-[26px] flex items-center">
            {fee ? (
              <Badge
                variant={BadgeVariant.PERCENTAGE}
                percentage={`${FEE_AMOUNT_DETAIL[fee].label}%`}
              />
            ) : (
              <Badge variant={BadgeVariant.DEFAULT} text={t("loading")} />
            )}
          </div>
        </div>
        <div className="h-[26px] flex items-center">
          <RangeBadge
            status={
              removed
                ? PositionRangeStatus.CLOSED
                : inRange
                  ? PositionRangeStatus.IN_RANGE
                  : PositionRangeStatus.OUT_OF_RANGE
            }
          />
        </div>
      </div>
      <div className="hidden md:flex gap-2 items-center">
        <span className="text-secondary-text">Min:</span> {formatNumber(minTokenAPerTokenB)}{" "}
        {quoteSymbol} / {baseSymbol}
        <Svg iconName="double-arrow" className="text-tertiary-text" />
        <span className="text-secondary-text">Max:</span> {formatNumber(maxTokenAPerTokenB)}{" "}
        {quoteSymbol} / {baseSymbol}
      </div>
      <div className="flex md:hidden gap-2 items-center">
        <Svg iconName="double-arrow" className="rotate-90 text-tertiary-text" size={32} />
        <div className="flex flex-col text-14 gap-1">
          <div>
            {" "}
            <span className="text-secondary-text">Min:</span> {formatNumber(minTokenAPerTokenB)}{" "}
            {quoteSymbol} / {baseSymbol}
          </div>
          <div>
            <span className="text-secondary-text">Max:</span> {formatNumber(maxTokenAPerTokenB)}{" "}
            {quoteSymbol} / {baseSymbol}
          </div>
        </div>
      </div>
    </div>
  );
}

const Positions = () => {
  const { isConnected } = useAccount();
  const router = useRouter();
  const t = useTranslations("Liquidity");

  const { loading, positions } = usePositions();

  const [hideClosed, setHideClosed] = useState(false);

  const hasClosedPositions: boolean = useMemo(() => {
    for (let position of positions || []) {
      if (position.liquidity === BigInt("0")) {
        return true;
      }
    }
    return false;
  }, [positions]);

  const filteredPositions: PositionInfo[] = useMemo(() => {
    if (hideClosed) {
      return positions.filter((position) => position.liquidity !== BigInt("0"));
    }
    return positions;
  }, [hideClosed, positions]);

  return (
    <div className="w-full">
      {loading ? (
        <div className="w-full">
          <div className="min-h-[340px] bg-primary-bg flex items-center justify-center w-full flex-col gap-2 rounded-5">
            <Preloader size={50} type="awaiting" />
          </div>
        </div>
      ) : (
        <>
          {!isConnected ? (
            <div className="min-h-[340px] bg-primary-bg flex items-center justify-center w-full flex-col gap-2 rounded-5 bg-empty-wallet bg-no-repeat bg-right-top max-md:bg-size-180">
              <p className="text-secondary-text">{t("connect_wallet_your_liquidity")}</p>
            </div>
          ) : (
            <>
              {positions?.length ? (
                <div className="rounded-5 w-full overflow-hidden bg-primary-bg md:px-10 px-5">
                  <div className="flex justify-between py-3">
                    <span className="text-tertiary-text md:text-16 text-12">
                      {t("your_positions")}
                    </span>
                    {hasClosedPositions && (
                      <span
                        className="text-secondary-text md:text-16 text-12 hocus:text-green-hover cursor-pointer"
                        onClick={() => setHideClosed(!hideClosed)}
                      >
                        {!hideClosed ? t("hide_closed_positions") : t("show_closed_positions")}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-3 pb-4 md:pb-10">
                    {filteredPositions?.length ? (
                      filteredPositions.map((position, index) => {
                        return (
                          <PoolPosition
                            positionInfo={position}
                            key={(position as any).nonce || index}
                            onClick={() =>
                              router.push(`/pool/${(position as any).tokenId.toString()}`)
                            }
                          />
                        );
                      })
                    ) : (
                      <div>{t("no_positions_yet")}</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="min-h-[340px] bg-primary-bg flex items-center justify-center w-full rounded-5 relative bg-empty-pool bg-no-repeat bg-right-top max-md:bg-size-180">
                  <p className="text-secondary-text">{t("your_positions_here")}</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default function PoolsPage() {
  const router = useRouter();
  const { tokenA, tokenB, setTokenA } = useAddLiquidityTokensStore();
  const chainId = useCurrentChainId();
  const t = useTranslations("Liquidity");

  return (
    <Container>
      <div className="py-4 lg:py-10 flex flex-col items-center">
        <div className="flex flex-col lg:flex-row w-full justify-between items-center mb-6 gap-2">
          <div
            role="tablist"
            className="w-full lg:w-[384px] grid grid-cols-2 bg-primary-bg p-1 gap-1 rounded-3"
          >
            <TabButton
              inactiveBackground="bg-secondary-bg"
              size={48}
              active={false}
              onClick={() => router.push("/pools")}
            >
              {t("pools")}
            </TabButton>
            <TabButton inactiveBackground="bg-secondary-bg" size={48} active>
              {t("liquidity_title")}
            </TabButton>
          </div>
          <Button
            size={ButtonSize.LARGE}
            mobileSize={ButtonSize.MEDIUM}
            onClick={() => {
              if (!tokenA && !tokenB) {
                const native = NativeCoin.onChain(chainId);
                setTokenA(native);
              }
              router.push("/add");
            }}
            fullWidth
            className="lg:w-auto"
          >
            <span className="flex items-center gap-2">
              {t("new_position")}
              <Svg iconName="add" />
            </span>
          </Button>
        </div>
        <Positions />
      </div>
    </Container>
  );
}
