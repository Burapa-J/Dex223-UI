import ExternalTextLink from "@repo/ui/external-text-link";
import Tooltip from "@repo/ui/tooltip";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import React, { PropsWithChildren, useEffect, useMemo, useState } from "react";
import SimpleBar from "simplebar-react";
import { formatUnits, parseUnits } from "viem";

import timestampToDateString from "@/app/[locale]/margin-trading/helpers/timestampToDateString";
import LiquidationRiskBlock from "@/app/[locale]/margin-trading/lending-order/[id]/borrow/components/LiquidationRiskBlock";
import useCreateMarginPosition, {
  useCreatePositionApproveSteps,
} from "@/app/[locale]/margin-trading/lending-order/[id]/borrow/hooks/useCreateMarginPosition";
import { useCreateMarginPositionConfigStore } from "@/app/[locale]/margin-trading/lending-order/[id]/borrow/stores/useCreateMarginPositionConfigStore";
import {
  CreateMarginPositionStatus,
  useCreateMarginPositionStatusStore,
} from "@/app/[locale]/margin-trading/lending-order/[id]/borrow/stores/useCreateMarginPositionStatusStore";
import { useNewlyCreatedPositionId } from "@/app/[locale]/margin-trading/lending-order/[id]/borrow/stores/useNewlyCreatedPositionId";
import { calculatePeriodInterestRate } from "@/app/[locale]/margin-trading/lending-order/[id]/helpers/calculatePeriodInterestRate";
import LendingOrderDetailsRow from "@/app/[locale]/margin-trading/lending-order/create/components/LendingOrderDetailsRow";
import { useConfirmBorrowPositionDialogStore } from "@/app/[locale]/margin-trading/stores/dialogStates";
import { LendingOrder } from "@/app/[locale]/margin-trading/types";
import DialogHeader from "@/components/atoms/DialogHeader";
import DrawerDialog from "@/components/atoms/DrawerDialog";
import EmptyStateIcon from "@/components/atoms/EmptyStateIcon";
import { InputSize, SearchInput } from "@/components/atoms/Input";
import Svg from "@/components/atoms/Svg";
import { InputLabel } from "@/components/atoms/TextField";
import Badge, { BadgeVariant } from "@/components/badges/Badge";
import Button from "@/components/buttons/Button";
import ApproveAmountConfig from "@/components/common/ApproveAmountConfig";
import OperationStepRow, {
  operationStatusToStepStatus,
} from "@/components/common/OperationStepRow";
import { formatFloat } from "@/functions/formatFloat";
import getExplorerLink, { ExplorerLinkType } from "@/functions/getExplorerLink";
import { filterTokens } from "@/functions/searchTokens";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { ORACLE_ADDRESS } from "@/sdk_bi/addresses";
import { Standard } from "@/sdk_bi/standard";

function Rows({ children }: PropsWithChildren<{}>) {
  return <div className="flex flex-col gap-5">{children}</div>;
}

function CreateMarginPositionActionButton({
  orderId,
  order,
  amountToApprove,
  feeAmountToApprove,
  confirmDisabled,
}: {
  orderId: string;
  order: LendingOrder;
  amountToApprove: string;
  feeAmountToApprove: string;
  confirmDisabled: boolean;
}) {
  const t = useTranslations("Margin");
  const { handleCreateMarginPosition } = useCreateMarginPosition(order);
  const {
    status,
    setStatus,
    approveBorrowHash,
    approveLiquidationFeeHash,
    borrowHash,
    transferHash,
  } = useCreateMarginPositionStatusStore();
  const { values } = useCreateMarginPositionConfigStore();

  const hashesByStep: Partial<Record<CreateMarginPositionStatus, `0x${string}` | undefined>> = {
    [CreateMarginPositionStatus.PENDING_APPROVE_BORROW]: approveBorrowHash,
    [CreateMarginPositionStatus.PENDING_TRANSFER]: transferHash,
    [CreateMarginPositionStatus.PENDING_APPROVE_LIQUIDATION_FEE]: approveLiquidationFeeHash,
    [CreateMarginPositionStatus.PENDING_BORROW]: borrowHash,
  };

  const { allSteps: marginSteps } = useCreatePositionApproveSteps(order);

  if (status !== CreateMarginPositionStatus.INITIAL) {
    return (
      <Rows>
        {marginSteps.map((step, index) => (
          <OperationStepRow
            key={index}
            iconName={step.iconName}
            hash={hashesByStep[step.pending]}
            statusTextMap={step.textMap}
            status={operationStatusToStepStatus({
              currentStatus: status,
              orderedSteps: marginSteps.flatMap((s) => [s.pending, s.loading, s.error]),
              stepIndex: index,
              pendingStep: step.pending,
              loadingStep: step.loading,
              errorStep: step.error,
              successStep: CreateMarginPositionStatus.SUCCESS,
            })}
            isFirstStep={index === 0}
          />
        ))}
      </Rows>
    );
  }
  return (
    <Button
      fullWidth
      disabled={confirmDisabled}
      onClick={() => handleCreateMarginPosition(orderId, amountToApprove, feeAmountToApprove)}
    >
      {t("confirm_borrow")}
    </Button>
  );
}

export default function ReviewBorrowDialog({
  orderId,
  order,
}: {
  orderId: string;
  order: LendingOrder;
}) {
  const locale = useLocale();
  const t = useTranslations("Margin");

  const { isOpen, setIsOpen } = useConfirmBorrowPositionDialogStore();
  const { values, setValues } = useCreateMarginPositionConfigStore();
  const { status, setStatus } = useCreateMarginPositionStatusStore();
  const [isEditApproveActive, setEditApproveActive] = React.useState(false);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const [isEditApproveFeeActive, setEditApproveFeeActive] = React.useState(false);

  const { positionId, setPositionId } = useNewlyCreatedPositionId();

  const isFeeAndCollateralSame = useMemo(() => {
    return (
      !values.collateralToken?.isNative &&
      values.collateralTokenStandard === Standard.ERC20 &&
      order.liquidationRewardAssetStandard === Standard.ERC20 &&
      values.collateralToken?.equals(order.liquidationRewardAsset)
    );
  }, [
    order.liquidationRewardAsset,
    order.liquidationRewardAssetStandard,
    values.collateralToken,
    values.collateralTokenStandard,
  ]);

  const [amountToApprove, setAmountToApprove] = useState(values.collateralAmount);
  const [feeAmountToApprove, setFeeAmountToApprove] = useState(
    order.liquidationRewardAmount.formatted,
  );

  useEffect(() => {
    if (values.collateralAmount && !isFeeAndCollateralSame) {
      setAmountToApprove(values.collateralAmount);
    }

    if (isFeeAndCollateralSame) {
      setAmountToApprove(
        formatUnits(
          parseUnits(values.collateralAmount, values.collateralToken?.decimals ?? 18) +
            order.liquidationRewardAmount.value,
          values.collateralToken?.decimals ?? 18,
        ),
      );
    }
  }, [
    isFeeAndCollateralSame,
    order.liquidationRewardAmount.value,
    values.collateralAmount,
    values.collateralToken?.decimals,
  ]);

  const chainId = useCurrentChainId();

  const isInitialStatus = useMemo(() => status === CreateMarginPositionStatus.INITIAL, [status]);
  const isFinalStatus = useMemo(
    () =>
      status === CreateMarginPositionStatus.SUCCESS ||
      status === CreateMarginPositionStatus.ERROR_TRANSFER ||
      status === CreateMarginPositionStatus.ERROR_BORROW ||
      status === CreateMarginPositionStatus.ERROR_APPROVE_BORROW ||
      status === CreateMarginPositionStatus.ERROR_APPROVE_LIQUIDATION_FEE,
    [status],
  );
  const isLoadingStatus = useMemo(
    () => !isInitialStatus && !isFinalStatus,
    [isFinalStatus, isInitialStatus],
  );

  useEffect(() => {
    setRiskAcknowledged(false);
  }, [isOpen]);

  useEffect(() => {
    if (isFinalStatus && !isOpen) {
      setTimeout(() => {
        setStatus(CreateMarginPositionStatus.INITIAL);
        setPositionId(undefined);
      }, 400);
    }
  }, [isFinalStatus, isOpen, setPositionId, setStatus]);

  const [formattedEndTime, setFormattedEndTime] = useState<string>("");

  const [searchTradableTokenValue, setSearchTradableTokenValue] = useState("");

  const [filteredTokens, isTokenFilterActive] = useMemo(() => {
    return searchTradableTokenValue
      ? [filterTokens(searchTradableTokenValue, order?.allowedTradingAssets || []), true]
      : [order?.allowedTradingAssets || [], false];
  }, [searchTradableTokenValue, order?.allowedTradingAssets]);

  useEffect(() => {
    if (!order) {
      return;
    }
    // initial calculation
    const calc = () => {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const endTimestamp = nowInSeconds + Number(order?.positionDuration);
      const formatted = timestampToDateString(endTimestamp, { withSeconds: true });
      setFormattedEndTime(formatted);
    };

    calc(); // call immediately after mount

    const interval = setInterval(() => {
      calc(); // recalculate every minute
    }, 60_000); // 60 seconds

    return () => clearInterval(interval); // cleanup on unmount
  }, [order, order?.positionDuration]);

  return (
    <DrawerDialog isOpen={isOpen} setIsOpen={setIsOpen}>
      <DialogHeader onClose={() => setIsOpen(false)} title={t("review_borrow")} />

      <div className="card-spacing-x card-spacing-b w-full md:w-[600px]">
        {!isFinalStatus && (
          <>
            <InputLabel inputSize={InputSize.LARGE} label={t("you_send")} />
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 mb-4">
              <div className="bg-tertiary-bg rounded-3 py-4 px-3 sm:px-5 text-14 min-w-0">
                <p className="text-secondary-text ">{t("collateral")}</p>
                <div className="flex flex-wrap items-center gap-1 my-1 break-all">
                  <Image
                    className="mr-1"
                    src={"/images/tokens/placeholder.svg"}
                    alt={values.collateralToken?.symbol || t("unknown")}
                    width={20}
                    height={20}
                  />
                  <span className="">{formatFloat(values.collateralAmount)}</span>
                  <span className="text-secondary-text">
                    {values.collateralToken?.symbol || t("unknown")}
                  </span>
                  <Badge
                    size="small"
                    variant={BadgeVariant.STANDARD}
                    standard={values.collateralTokenStandard}
                  />
                </div>
              </div>
              <div className="bg-tertiary-bg rounded-3 py-4 px-3 sm:px-5 text-14 min-w-0">
                <p className="text-secondary-text ">{t("liquidation_fee")}</p>
                <div className="flex flex-wrap items-center gap-1 my-1 break-all">
                  <Image
                    className="mr-1"
                    src={"/images/tokens/placeholder.svg"}
                    alt={order.liquidationRewardAsset.symbol || t("unknown")}
                    width={20}
                    height={20}
                  />
                  <span className="">{formatFloat(order.liquidationRewardAmount.formatted)}</span>
                  <span className="text-secondary-text">
                    {order.liquidationRewardAsset.symbol || t("unknown")}
                  </span>
                  <Badge
                    size="small"
                    variant={BadgeVariant.STANDARD}
                    standard={order.liquidationRewardAssetStandard}
                  />
                </div>
              </div>
            </div>
            <InputLabel inputSize={InputSize.LARGE} label={t("you_receive")} />
            <div className="bg-tertiary-bg rounded-3 py-[14px] px-3 sm:px-5 mb-4 text-14 flex flex-wrap items-center justify-between gap-2 min-w-0">
              <p className="text-secondary-text ">{t("borrow")}</p>
              <div className="flex flex-wrap items-center gap-1 min-w-0 break-all">
                <Image
                  className="mr-1"
                  src={"/images/tokens/placeholder.svg"}
                  alt={order.baseAsset?.symbol || t("unknown")}
                  width={20}
                  height={20}
                />
                <span className="">{formatFloat(values.borrowAmount)}</span>
                <span className="text-secondary-text">
                  {order.baseAsset?.symbol || t("unknown")}
                </span>
                {/*<Badge*/}
                {/*  size="small"*/}
                {/*  variant={BadgeVariant.STANDARD}*/}
                {/*  standard={values.collateralTokenStandard}*/}
                {/*/>*/}
              </div>
            </div>
          </>
        )}

        {isInitialStatus && (
          <>
            <div className="flex flex-col gap-2 mb-5">
              <LendingOrderDetailsRow
                title={t("interest_per_month")}
                value={`${order.interestRate / 100}%`}
                tooltipText={t("interest_rate_tooltip")}
              />
              <LendingOrderDetailsRow
                title={t("interest_entire_period")}
                value={calculatePeriodInterestRate(order.interestRate, order.positionDuration)}
                tooltipText={t("interest_entire_tooltip")}
              />
              <LendingOrderDetailsRow
                title={t("max_leverage")}
                value={`${order.leverage}x`}
                tooltipText={t("leverage_page_tooltip")}
              />
              <LendingOrderDetailsRow
                title={t("leverage")}
                value={`${values.leverage}x`}
                tooltipText={t("leverage_borrow_tooltip")}
              />
              <LendingOrderDetailsRow
                title={t("deadline")}
                value={formattedEndTime}
                tooltipText={t("deadline_borrow_tooltip")}
              />
              <LendingOrderDetailsRow
                title={t("order_currency_limit")}
                value={order.currencyLimit}
                tooltipText={t("currency_limit_page_tooltip")}
              />
              <LendingOrderDetailsRow
                title={t("liquidation_price_source")}
                value={
                  <ExternalTextLink
                    text={t("dex223_market")}
                    href={getExplorerLink(
                      ExplorerLinkType.ADDRESS,
                      ORACLE_ADDRESS[chainId],
                      chainId,
                    )}
                  />
                }
                tooltipText={t("liquidation_price_tooltip")}
              />
            </div>
            <div className="bg-tertiary-bg rounded-3 px-5 pb-5 pt-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-tertiary-text flex items-center gap-1 text-14">
                    <Tooltip text={t("tokens_allowed_tooltip")} iconSize={20} />
                    {t("tokens_allowed_trading")}
                  </h3>
                </div>
                <div className="w-full sm:w-[180px] shrink-0">
                  <SearchInput
                    value={searchTradableTokenValue}
                    onChange={(e) => setSearchTradableTokenValue(e.target.value)}
                    placeholder={t("token_name")}
                    className="h-8 text-14 w-full rounded-2"
                  />
                </div>
              </div>

              {!!filteredTokens.length && (
                <SimpleBar style={{ maxHeight: 216 }}>
                  <div className="flex gap-1 flex-wrap">
                    {filteredTokens.map((tradingToken) => {
                      return tradingToken.isToken ? (
                        <span
                          key={tradingToken.address0}
                          className="bg-quaternary-bg text-secondary-text px-2 py-1 rounded-2 hocus:bg-green-bg duration-200"
                        >
                          {tradingToken.symbol}
                        </span>
                      ) : (
                        <div className="rounded-2 text-secondary-text border border-secondary-border px-2 flex items-center py-1">
                          {tradingToken.symbol}
                        </div>
                      );
                    })}
                  </div>
                </SimpleBar>
              )}
              {!filteredTokens.length && isTokenFilterActive && (
                <div className="rounded-5 h-[76px] -mt-5 flex items-center justify-center text-secondary-text bg-empty-not-found-token bg-no-repeat bg-right-top bg-[length:64px_64px] -mr-5">
                  {t("token_not_found")}
                </div>
              )}
            </div>
            {isFeeAndCollateralSame ? (
              <>
                {values.collateralToken &&
                  !order.liquidationRewardAsset.isNative &&
                  order.liquidationRewardAssetStandard === Standard.ERC20 && (
                    <ApproveAmountConfig
                      amountToApprove={amountToApprove}
                      setAmountToApprove={setAmountToApprove}
                      minAmount={
                        parseUnits(
                          values.collateralAmount,
                          values.collateralToken?.decimals ?? 18,
                        ) + order.liquidationRewardAmount.value
                      }
                      isEditApproveActive={isEditApproveActive}
                      setEditApproveActive={setEditApproveActive}
                      asset={values.collateralToken}
                    />
                  )}
              </>
            ) : (
              <>
                <>
                  {values.collateralToken &&
                    !values.collateralToken.isNative &&
                    values.collateralTokenStandard === Standard.ERC20 && (
                      <ApproveAmountConfig
                        amountToApprove={amountToApprove}
                        setAmountToApprove={setAmountToApprove}
                        minAmount={parseUnits(
                          values.collateralAmount,
                          values.collateralToken?.decimals ?? 18,
                        )}
                        isEditApproveActive={isEditApproveActive}
                        setEditApproveActive={setEditApproveActive}
                        asset={values.collateralToken}
                      />
                    )}
                </>
                <>
                  {values.collateralToken &&
                    !order.liquidationRewardAsset.isNative &&
                    order.liquidationRewardAssetStandard === Standard.ERC20 && (
                      <ApproveAmountConfig
                        amountToApprove={feeAmountToApprove}
                        setAmountToApprove={setFeeAmountToApprove}
                        minAmount={order.liquidationRewardAmount.value}
                        isEditApproveActive={isEditApproveFeeActive}
                        setEditApproveActive={setEditApproveFeeActive}
                        asset={order.liquidationRewardAsset}
                      />
                    )}
                </>
              </>
            )}
          </>
        )}
        {isFinalStatus && (
          <div className="pb-3 border-b border-secondary-border mb-4">
            <div className="mx-auto w-[80px] h-[80px] flex items-center justify-center relative mb-5">
              {status === CreateMarginPositionStatus.ERROR_BORROW && (
                <EmptyStateIcon iconName="warning" />
              )}
              {status === CreateMarginPositionStatus.ERROR_APPROVE_BORROW && (
                <EmptyStateIcon iconName="warning" />
              )}
              {status === CreateMarginPositionStatus.ERROR_APPROVE_LIQUIDATION_FEE && (
                <EmptyStateIcon iconName="warning" />
              )}

              {status === CreateMarginPositionStatus.SUCCESS && (
                <>
                  <div className="w-[54px] h-[54px] rounded-full border-[7px] blur-[8px] opacity-80 border-green" />
                  <Svg
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-green"
                    iconName={"success"}
                    size={65}
                  />
                </>
              )}
            </div>

            {status === CreateMarginPositionStatus.SUCCESS && (
              <div>
                <h2 className="text-center mb-1 font-bold text-20 ">
                  {t("successfully_borrowed")}
                </h2>
                <p className="text-center mb-1">
                  {order.baseAsset.symbol} {values.borrowAmount}
                </p>
                <div className="flex justify-center">
                  <ExternalTextLink
                    text={t("view_my_position")}
                    href={`/${locale}/margin-trading/position/${positionId}`}
                  />
                </div>
              </div>
            )}

            {status === CreateMarginPositionStatus.ERROR_BORROW && (
              <div>
                <h2 className="text-center mb-1 font-bold text-20 text-red-light">
                  {t("borrow_failed")}
                </h2>
                <p className="text-center mb-1">
                  {order.baseAsset.symbol} {values.borrowAmount}
                </p>
              </div>
            )}

            {status === CreateMarginPositionStatus.ERROR_APPROVE_BORROW && (
              <div>
                <h2 className="text-center mb-1 font-bold text-20 text-red-light">
                  {t("approve_failed")}
                </h2>
                <p className="text-center mb-1">
                  {order.baseAsset.symbol} {values.borrowAmount}
                </p>
              </div>
            )}

            {status === CreateMarginPositionStatus.ERROR_TRANSFER && (
              <div>
                <h2 className="text-center mb-1 font-bold text-20 text-red-light">
                  {t("transfer_failed")}
                </h2>
                <p className="text-center mb-1">
                  {order.baseAsset.symbol} {values.borrowAmount}
                </p>
              </div>
            )}
          </div>
        )}
        {!isFinalStatus && (
          <LiquidationRiskBlock
            order={order}
            isOpen={isOpen}
            acknowledged={riskAcknowledged}
            onAcknowledgedChange={setRiskAcknowledged}
          />
        )}
        <CreateMarginPositionActionButton
          orderId={orderId}
          order={order}
          amountToApprove={amountToApprove}
          feeAmountToApprove={feeAmountToApprove}
          confirmDisabled={!riskAcknowledged}
        />
      </div>
    </DrawerDialog>
  );
}
