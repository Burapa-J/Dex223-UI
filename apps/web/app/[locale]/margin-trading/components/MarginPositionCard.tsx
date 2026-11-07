import ExternalTextLink from "@repo/ui/external-text-link";
import GradientCard, { CardGradient } from "@repo/ui/gradient-card";
import Tooltip from "@repo/ui/tooltip";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import React, { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount, usePublicClient } from "wagmi";

import { useOpenMarginSwapForPosition } from "@/app/[locale]/margin-swap/hooks/useOpenMarginSwapForPosition";
import FrozenBadge from "@/app/[locale]/margin-trading/components/FrozenBadge";
import FrozenPositionActions from "@/app/[locale]/margin-trading/components/FrozenPositionActions";
import PositionProgressBar from "@/app/[locale]/margin-trading/components/PositionProgressBar";
import {
  InfoBlockWithBorder,
  SimpleInfoBlock,
} from "@/app/[locale]/margin-trading/components/widgets/OrderInfoBlock";
import PositionHealthStatus from "@/app/[locale]/margin-trading/components/widgets/PositionHealthStatus";
import timestampToDateString from "@/app/[locale]/margin-trading/helpers/timestampToDateString";
import usePositionLiquidationCost from "@/app/[locale]/margin-trading/hooks/usePositionLiquidationCost";
import usePositionLiquidationState from "@/app/[locale]/margin-trading/hooks/usePositionLiquidationState";
import ClosedPositionWithdrawDialog from "@/app/[locale]/margin-trading/position/[id]/components/ClosedPositionWithdrawDialog";
import PositionCloseDialog from "@/app/[locale]/margin-trading/position/[id]/components/PositionCloseDialog";
import usePositionStatus from "@/app/[locale]/margin-trading/position/[id]/hooks/usePositionStatus";
import { MarginPosition } from "@/app/[locale]/margin-trading/types";
import Svg from "@/components/atoms/Svg";
import Button, { ButtonColor, ButtonSize } from "@/components/buttons/Button";
import { formatFloat, formatLeverage } from "@/functions/formatFloat";
import getExplorerLink, { ExplorerLinkType } from "@/functions/getExplorerLink";
import truncateMiddle from "@/functions/truncateMiddle";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { useNativeCurrency } from "@/hooks/useNativeCurrency";
import { Link } from "@/i18n/routing";

import PositionAsset from "./widgets/PositionAsset";

enum DangerStatus {
  STABLE,
  RISKY,
  DANGEROUS,
}

const balanceCardBackgroundMap: Record<DangerStatus, CardGradient> = {
  [DangerStatus.STABLE]: CardGradient.GREEN_LIGHT,
  [DangerStatus.RISKY]: CardGradient.YELLOW_LIGHT,
  [DangerStatus.DANGEROUS]: CardGradient.RED_LIGHT,
};

const balanceCardTextColorMap: Record<DangerStatus, string> = {
  [DangerStatus.STABLE]: "text-green",
  [DangerStatus.RISKY]: "text-yellow-light",
  [DangerStatus.DANGEROUS]: "text-red-light",
};

function MarginPositionBalanceCard({
  totalBalance,
  expectedBalance,
  balanceStatus,
  symbol,
}: {
  totalBalance: string;
  expectedBalance: string;
  balanceStatus: DangerStatus;
  symbol?: string;
}) {
  const t = useTranslations("Margin");

  return (
    <GradientCard className="pt-1.5 pb-0.5 px-5" gradient={balanceCardBackgroundMap[balanceStatus]}>
      <div className="flex items-center gap-1 relative">
        <span className="text-16">{t("balance")}</span>{" "}
        <span className="text-14 flex items-center gap-1 text-secondary-text">
          {t("total_expected")}
          <Tooltip text={t("total_expected_balance_tooltip")} />
        </span>
      </div>
      <div className="relative -top-1 text-20 flex gap-1 font-medium">
        <span className={balanceCardTextColorMap[balanceStatus]}>{totalBalance}</span>
        {"/"}
        <span className={balanceCardTextColorMap[balanceStatus]}>{expectedBalance}</span>
        {symbol || t("unknown")}
      </div>
    </GradientCard>
  );
}

const liquidationInfoTextColorMap: Record<DangerStatus, string> = {
  [DangerStatus.STABLE]: "text-green",
  [DangerStatus.RISKY]: "text-yellow-light",
  [DangerStatus.DANGEROUS]: "text-red-light",
};

function LiquidationInfo({
  label,
  tooltipText,
  value,
  liquidationFeeStatus,
  symbol,
}: {
  label: string;
  tooltipText: string;
  value: string;
  liquidationFeeStatus: DangerStatus;
  symbol: string;
}) {
  return (
    <div className="border-l-4 border-tertiary-bg rounded-1 pl-4 min-w-[185px]">
      <div className="flex items-center gap-2">
        {label} <Tooltip text={tooltipText} />
      </div>
      <p className="relative -top-1 flex gap-1 items-center text-20 font-medium">
        <span className={liquidationInfoTextColorMap[liquidationFeeStatus]}>{value}</span>
        <span className="">{symbol}</span>
      </p>
    </div>
  );
}

interface Props {
  position: MarginPosition;
}

const dangerIconsMap: Record<Exclude<DangerStatus, DangerStatus.STABLE>, ReactNode> = {
  [DangerStatus.RISKY]: (
    <div className="w-10 h-10 flex justify-center items-center text-yellow-light rounded-2.5 border-yellow-light border relative before:absolute before:w-4 before:h-4 before:rounded-full before:blur-[9px] before:bg-yellow-light">
      <Svg iconName="warning" />
    </div>
  ),
  [DangerStatus.DANGEROUS]: (
    <div className="w-10 h-10 flex justify-center items-center text-red-light rounded-2.5 border-red-light border relative before:absolute before:w-4 before:h-4 before:rounded-full before:blur-[9px] before:bg-red-light">
      <Svg iconName="warning" />
    </div>
  ),
};

const marginPositionCardBorderMap: Record<DangerStatus, string> = {
  [DangerStatus.STABLE]: "border border-transparent",
  [DangerStatus.RISKY]: "border border-yellow-light shadow shadow-yellow-light/60",
  [DangerStatus.DANGEROUS]: "border border-red-light shadow shadow-red-light/60",
};

export function InactiveMarginPositionCard({ position }: Props) {
  const t = useTranslations("Margin");
  const [isWithdrawDialogOpened, setIsWithdrawDialogOpened] = useState(false);

  const chainId = useCurrentChainId();

  const isTokensToWithdraw = useMemo(() => {
    return position.assetsWithBalances.some((assetWithBalance) => {
      return !!assetWithBalance.balance && assetWithBalance.balance > BigInt(0);
    });
  }, [position.assetsWithBalances]);

  return (
    <div className="bg-primary-bg rounded-3 px-5 pt-3 pb-5">
      <div className="grid grid-cols-3 gap-3 mb-3 h-10">
        <Link
          className={"flex items-center gap-2 hocus:text-green duration-200 text-secondary-text"}
          href={`/margin-trading/position/${position.id}`}
        >
          {t("view_summary")} <Svg iconName="next" />
        </Link>
        <div className="flex items-center">
          {position.isLiquidated && (
            <span className="flex gap-1 items-center text-tertiary-text">
              {t("liquidated_by")}{" "}
              <ExternalTextLink
                text={truncateMiddle(position.liquidator)}
                href={getExplorerLink(ExplorerLinkType.ADDRESS, position.liquidator, chainId)}
              />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-tertiary-text justify-end">
          {position.isClosed ? (
            <>
              {t("executed")}
              <Svg iconName="done" />
            </>
          ) : (
            <>
              {t("liquidated")}
              <Svg iconName="liquidated" />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        {position.isClosed ? (
          <>
            <SimpleInfoBlock
              title={t("borrowed_profit")}
              tooltipText={t("borrowed_profit_tooltip")}
              value={`${formatFloat(formatUnits(position.loanAmount, position.loanAsset.decimals))} ${position.loanAsset.symbol} / -`}
            />
            <SimpleInfoBlock
              title={t("initial_collateral_earning")}
              tooltipText={t("initial_collateral_earning_tooltip")}
              value={`${formatFloat(formatUnits(position.collateralAmount, position.collateralAsset.decimals))} ${position.collateralAsset.symbol} / -`}
            />
          </>
        ) : (
          <>
            <SimpleInfoBlock
              title={t("borrowed")}
              tooltipText={t("borrowed_tooltip")}
              value={`${formatFloat(formatUnits(position.loanAmount, position.loanAsset.decimals))} ${position.loanAsset.symbol}`}
            />
            <SimpleInfoBlock
              title={t("initial_collateral")}
              tooltipText={t("initial_collateral_tooltip")}
              value={`${formatFloat(formatUnits(position.collateralAmount, position.collateralAsset.decimals))} ${position.collateralAsset.symbol}`}
            />
          </>
        )}
        <SimpleInfoBlock
          title={t("initial_leverage")}
          tooltipText={t("initial_leverage_tooltip")}
          value={formatLeverage(position.initialLeverage)}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {position.isClosed ? (
          <>
            <InfoBlockWithBorder
              title={t("closing_date")}
              value={timestampToDateString(position.closedAt)}
              tooltipText={t("closing_date_tooltip")}
            />
            <InfoBlockWithBorder
              title={t("closing")}
              value={
                <ExternalTextLink
                  text={t("closing_transaction")}
                  href={getExplorerLink(ExplorerLinkType.TRANSACTION, position.txClosed, chainId)}
                />
              }
              tooltipText={t("closing_tx_tooltip")}
            />

            {isTokensToWithdraw && (
              <>
                <Button
                  colorScheme={ButtonColor.LIGHT_GREEN}
                  onClick={() => setIsWithdrawDialogOpened(true)}
                >
                  {t("withdraw")}
                </Button>

                <ClosedPositionWithdrawDialog
                  isOpen={isWithdrawDialogOpened}
                  setIsOpen={setIsWithdrawDialogOpened}
                  position={position}
                />
              </>
            )}
          </>
        ) : (
          <>
            <InfoBlockWithBorder
              title={t("liquidation_date")}
              value={timestampToDateString(position.liquidatedAt)}
              tooltipText={t("liquidation_date_tooltip")}
            />
            <InfoBlockWithBorder
              title={t("freezing")}
              value={
                <ExternalTextLink
                  text={t("freezing_transaction")}
                  href={getExplorerLink(ExplorerLinkType.TRANSACTION, position.txFrozen, chainId)}
                />
              }
              tooltipText={t("freezing_tx_tooltip")}
            />
            <InfoBlockWithBorder
              title={t("liquidation")}
              value={
                <ExternalTextLink
                  text={t("liquidation_transaction")}
                  href={getExplorerLink(
                    ExplorerLinkType.TRANSACTION,
                    position.txLiquidated,
                    chainId,
                  )}
                />
              }
              tooltipText={t("liquidation_tx_tooltip")}
            />
          </>
        )}
      </div>
    </div>
  );
}

function getPrice(inputAmount: bigint, outputAmount: bigint, scale: bigint = 10n ** 18n): number {
  return Number((outputAmount * scale) / inputAmount) / Number(scale);
}

const ONE = 10n ** 18n;

/**
 * Calculate leverage given borrow & collateral amounts in smallest units (bigint).
 *
 * L = 1 + BorrowValue / CollateralValue
 *
 * @param borrowWei         bigint, borrow amount in smallest units (e.g. USDT wei)
 * @param borrowDecimals    number of decimals for borrow token (e.g. 6 for USDT)
 * @param collateralWei     bigint, collateral amount in smallest units (e.g. ETH wei)
 * @param collateralDecimals number of decimals for collateral token (e.g. 18 for ETH)
 * @param price             number price, e.g. 2500 (borrow tokens per 1 collateral token)
 * @param leverageDecimals  how many decimals to format leverage with (default 6)
 * @returns                 human string leverage, e.g. "2", "2.5"
 */
export function calcLeverageFormattedFromBigints({
  borrowWei,
  borrowDecimals,
  collateralWei,
  collateralDecimals,
  price,
  leverageDecimals = 18,
}: {
  borrowWei: bigint;
  borrowDecimals: number;
  collateralWei: bigint;
  collateralDecimals: number;
  price: number; // borrow tokens per 1 collateral token
  leverageDecimals?: number;
}): string {
  if (collateralWei <= 0n || price <= 0) {
    return formatUnits(ONE, leverageDecimals);
  }

  // scale factors for decimals
  const scaleBorrow = 10n ** BigInt(borrowDecimals);
  const scaleColl = 10n ** BigInt(collateralDecimals);

  // convert price (number) → bigint Q18
  const priceQ18 = parseUnits(String(price), 18);

  // L18 = 1e18 + (B * 10^collDec * 1e36) / (C * priceQ18 * 10^borrowDec)
  const numerator = borrowWei * scaleColl * ONE * ONE;
  const denominator = collateralWei * priceQ18 * scaleBorrow;

  const L18 = ONE + numerator / denominator;

  return formatUnits(L18, leverageDecimals);
}

export function LendingPositionCard({ position }: Props) {
  const t = useTranslations("Margin");
  const openMarginSwap = useOpenMarginSwapForPosition();
  const { expectedBalance, actualBalance } = usePositionStatus(position);
  const { isFrozen, isLiquidatable, isLiquidatableKnown, refetch } =
    usePositionLiquidationState(position);
  const [positionToClose, setPositionToClose] = useState<MarginPosition | undefined>();

  const subjectToLiquidation = useMemo(() => {
    return actualBalance != null && expectedBalance != null && actualBalance <= expectedBalance;
  }, [actualBalance, expectedBalance]);

  const atRisk = isLiquidatableKnown ? isLiquidatable : subjectToLiquidation;

  const isCompleted = useMemo(() => {
    return +position.deadline * 1000 < Date.now();
  }, [position.deadline]);

  const nativeCurrency = useNativeCurrency();

  const { address } = useAccount();

  const balanceStatus: DangerStatus = useMemo(() => {
    if (actualBalance != null && expectedBalance != null && actualBalance <= expectedBalance) {
      return DangerStatus.DANGEROUS;
    }

    if (
      actualBalance != null &&
      expectedBalance != null &&
      actualBalance * BigInt(10) < expectedBalance * BigInt(11)
    ) {
      return DangerStatus.RISKY;
    }

    return DangerStatus.STABLE;
  }, [actualBalance, expectedBalance]);

  const { formatted } = usePositionLiquidationCost(position);

  const liquidationFeeStatus: DangerStatus = useMemo(() => {
    // if (+liquidationCost > +liquidationFee) {
    //   return DangerStatus.DANGEROUS;
    // }
    //
    // if (+liquidationCost * 1.1 > +liquidationFee) {
    //   return DangerStatus.RISKY;
    // }

    return DangerStatus.STABLE;
  }, []);

  const cardStatus: DangerStatus = useMemo(() => {
    if (
      // liquidationFeeStatus === DangerStatus.DANGEROUS ||
      balanceStatus === DangerStatus.DANGEROUS
    ) {
      return DangerStatus.DANGEROUS;
    }

    if (balanceStatus === DangerStatus.RISKY) {
      return DangerStatus.RISKY;
    }

    return DangerStatus.STABLE;
  }, [balanceStatus, liquidationFeeStatus]);

  const buttonsColor: ButtonColor = useMemo(() => {
    if (cardStatus === DangerStatus.DANGEROUS) {
      return ButtonColor.LIGHT_RED;
    }

    if (cardStatus === DangerStatus.RISKY) {
      return ButtonColor.LIGHT_YELLOW;
    }

    return ButtonColor.LIGHT_GREEN;
  }, [cardStatus]);

  const health = useMemo(() => {
    if (!expectedBalance || !actualBalance) {
      return 1;
    }

    return Number(actualBalance) / Number(expectedBalance);
  }, [actualBalance, expectedBalance]);

  const renderLiquidationInfoBlocks = useCallback(() => {
    return (
      <>
        <LiquidationInfo
          liquidationFeeStatus={liquidationFeeStatus}
          label={t("liquidation_fee")}
          tooltipText={t("liquidation_fee_position_tooltip")}
          value={formatFloat(position.order.liquidationRewardAmount.formatted)}
          symbol={position.order.liquidationRewardAsset.symbol || t("unknown")}
        />
        <LiquidationInfo
          liquidationFeeStatus={liquidationFeeStatus}
          label={t("liquidation_cost")}
          tooltipText={t("liquidation_cost_tooltip")}
          value={formatted}
          symbol={nativeCurrency.symbol || t("unknown")}
        />
      </>
    );
  }, [
    formatted,
    liquidationFeeStatus,
    nativeCurrency.symbol,
    position.order.liquidationRewardAmount.formatted,
    position.order.liquidationRewardAsset.symbol,
    t,
  ]);

  return (
    <div
      className={clsx(
        "rounded-3 bg-primary-bg pb-5 pt-3 px-5",
        marginPositionCardBorderMap[cardStatus],
      )}
    >
      <div className="grid grid-cols-5 gap-3 mb-3">
        <Link
          className="col-start-1 col-end-3 flex items-center gap-2 text-secondary-text hocus:ui-text-green duration-200"
          href={`/margin-trading/position/${position.id}`}
        >
          {t("view_margin_position_details")}
          <Svg iconName="next" />
        </Link>
        <span />
        <PositionHealthStatus health={health} />
        <div className="flex items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            {balanceStatus !== DangerStatus.STABLE && dangerIconsMap[balanceStatus]}
            {liquidationFeeStatus !== DangerStatus.STABLE && dangerIconsMap[liquidationFeeStatus]}
            {isCompleted && address?.toLowerCase() === position.order.owner.toLowerCase() && (
              <div className="w-10 h-10 flex justify-center items-center text-green rounded-2.5 border-greeb border relative before:absolute before:w-4 before:h-4 before:rounded-full before:blur-[9px] before:bg-green">
                <Svg iconName="time" />
              </div>
            )}
          </div>

          <div className="min-w-[115px] flex items-center gap-2 justify-end">
            {isFrozen && <FrozenBadge />}
            <div className="text-green flex items-center gap-2">
              {isCompleted && address?.toLowerCase() === position.order.owner.toLowerCase()
                ? t("status_completed")
                : t("status_active")}
              <span className="block w-2 h-2 rounded-2 bg-green" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3 mb-3">
        <div className="col-start-1 col-end-3">
          <MarginPositionBalanceCard
            balanceStatus={balanceStatus}
            totalBalance={
              actualBalance != null
                ? formatFloat(formatUnits(actualBalance, position.loanAsset.decimals))
                : t("loading")
            }
            expectedBalance={
              expectedBalance != null
                ? formatFloat(formatUnits(expectedBalance, position.loanAsset.decimals))
                : t("loading")
            }
            symbol={position.loanAsset.symbol}
          />
        </div>
        <SimpleInfoBlock
          title={t("borrowed")}
          tooltipText={t("borrowed_tooltip")}
          value={`${formatFloat(formatUnits(position.loanAmount, position.loanAsset.decimals))} ${position.loanAsset.symbol}`}
        />
        <SimpleInfoBlock
          title={t("initial_collateral")}
          tooltipText={t("initial_collateral_tooltip")}
          value={`${formatFloat(formatUnits(position.collateralAmount, position.collateralAsset.decimals))} ${position.collateralAsset.symbol}`}
        />
        <SimpleInfoBlock
          title={t("initial_leverage")}
          tooltipText={t("initial_leverage_tooltip")}
          value={formatLeverage(position.initialLeverage)}
        />
      </div>

      <div className="px-5 pb-5 bg-tertiary-bg rounded-3 mb-5">
        <div className="flex justify-between">
          <span className="text-tertiary-text flex items-center gap-2">
            {t("assets_count", {
              current: position.assets.length,
              limit: position.order.currencyLimit,
            })}
            <Tooltip text={t("assets_limit_tooltip")} />
          </span>
          <span className="flex items-center gap-2 py-2 text-secondary-text">
            {t("transactions_history")}
            <Svg iconName="history" />
          </span>
        </div>

        <div className="flex gap-2">
          {position.assetsWithBalances?.map(({ asset, balance }) => (
            <PositionAsset
              key={asset.wrapped.address0}
              amount={formatFloat(formatUnits(balance || BigInt(0), asset.decimals))}
              symbol={asset.symbol || t("unknown")}
            />
          ))}
        </div>
      </div>

      {position.owner !== address?.toLowerCase() && (
        <div className="grid grid-cols-3">
          {renderLiquidationInfoBlocks()}
          <div className="grid grid-cols-2 items-center gap-3">
            <div>
              {position.order.owner === address?.toLowerCase() &&
                +position.deadline < Date.now() / 100 &&
                (isFrozen && isLiquidatableKnown && isLiquidatable ? (
                  <Tooltip
                    text={t("frozen_close_tooltip")}
                    renderTrigger={(ref, refProps) => (
                      <span
                        className="inline-flex w-full"
                        tabIndex={0}
                        ref={ref.setReference}
                        {...refProps}
                      >
                        <Button disabled fullWidth size={ButtonSize.LARGE}>
                          {t("close")}
                        </Button>
                      </span>
                    )}
                  />
                ) : (
                  <Button
                    disabled={isFrozen && !isLiquidatableKnown}
                    fullWidth
                    size={ButtonSize.LARGE}
                  >
                    {t("close")}
                  </Button>
                ))}
            </div>

            <Link href={`/margin-trading/position/${position.id}/liquidate`}>
              <Button
                disabled={
                  isLiquidatableKnown
                    ? !isLiquidatable
                    : actualBalance != null &&
                      expectedBalance != null &&
                      actualBalance > expectedBalance
                }
                fullWidth
                colorScheme={ButtonColor.RED}
              >
                {t("liquidate")}
              </Button>
            </Link>
          </div>
        </div>
      )}
      {position.owner === address?.toLowerCase() && (
        <div className="grid grid-cols-2 gap-3 items-center mb-5 w-full">
          <div className="grid grid-cols-3">{renderLiquidationInfoBlocks()}</div>
          <div className={isFrozen ? "flex flex-wrap justify-end gap-2" : "grid grid-cols-4 gap-3"}>
            {isFrozen ? (
              <FrozenPositionActions
                position={position}
                isLiquidatable={isLiquidatable}
                isKnown={isLiquidatableKnown}
                tradeDisabled={false}
                onTrade={() => {
                  openMarginSwap(position);
                }}
                onClose={() => setPositionToClose(position)}
                onUnfrozen={refetch}
              />
            ) : (
              <>
                <Button
                  disabled={atRisk}
                  fullWidth
                  colorScheme={buttonsColor}
                  onClick={() => {
                    openMarginSwap(position);
                  }}
                >
                  {t("trade")}
                </Button>
                <Link href={`/margin-trading/position/${position.id}/deposit`}>
                  <Button fullWidth colorScheme={buttonsColor}>
                    {t("deposit")}
                  </Button>
                </Link>
                {atRisk ? (
                  <div className="col-start-3 col-end-5">
                    <Link href={`/margin-trading/position/${position.id}/liquidate`}>
                      <Button fullWidth colorScheme={ButtonColor.RED}>
                        {t("liquidate")}
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <>
                    <Button disabled fullWidth colorScheme={buttonsColor}>
                      {t("withdraw")}
                    </Button>
                    <Button
                      onClick={() => setPositionToClose(position)}
                      fullWidth
                      colorScheme={buttonsColor}
                    >
                      {t("close")}
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
      <PositionProgressBar dangerStatus={cardStatus} position={position} />

      {positionToClose && (
        <PositionCloseDialog
          isOpen={!!positionToClose}
          position={positionToClose}
          setIsOpen={() => setPositionToClose(undefined)}
        />
      )}
    </div>
  );
}
