import Image from "next/image";
import { useTranslations } from "next-intl";
import React, { ReactNode, useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "viem";

import dateToDateString from "@/app/[locale]/margin-trading/helpers/dateToDateString";
import timestampToDateString from "@/app/[locale]/margin-trading/helpers/timestampToDateString";
import useEditOrder, {
  tradingWhitelistChanged,
  useEditOrderParams,
} from "@/app/[locale]/margin-trading/lending-order/[id]/edit/hooks/useEditOrder";
import {
  EditOrderStatus,
  useEditOrderStatusStore,
} from "@/app/[locale]/margin-trading/lending-order/[id]/edit/stores/useEditOrderStatusStore";
import { AssetsPreview } from "@/app/[locale]/margin-trading/lending-order/create/components/AssetsPreview";
import LendingOrderDetailsRow from "@/app/[locale]/margin-trading/lending-order/create/components/LendingOrderDetailsRow";
import { LendingOrder } from "@/app/[locale]/margin-trading/types";
import DialogHeader from "@/components/atoms/DialogHeader";
import DrawerDialog from "@/components/atoms/DrawerDialog";
import EmptyStateIcon from "@/components/atoms/EmptyStateIcon";
import Svg from "@/components/atoms/Svg";
import Button from "@/components/buttons/Button";
import OperationStepRow, {
  OperationRows,
  operationStatusToStepStatus,
  OperationStepStatus,
} from "@/components/common/OperationStepRow";
import { IconName } from "@/config/types/IconName";
import { Currency } from "@/sdk_bi/entities/currency";

type StepTextMap = {
  [key in OperationStepStatus]: string;
};

type OperationStepConfig = {
  iconName: IconName;
  textMap: StepTextMap;
  pending: EditOrderStatus;
  loading: EditOrderStatus;
  error: EditOrderStatus;
};

function createOrderSteps(): OperationStepConfig[] {
  return [
    {
      iconName: "edit",
      pending: EditOrderStatus.PENDING_MODIFY,
      loading: EditOrderStatus.LOADING_MODIFY,
      error: EditOrderStatus.ERROR_MODIFY,
      textMap: {
        [OperationStepStatus.IDLE]: "Edit lending order",
        [OperationStepStatus.AWAITING_SIGNATURE]: "Edit lending order",
        [OperationStepStatus.LOADING]: "Editing lending order",
        [OperationStepStatus.STEP_COMPLETED]: "Lending order edited successfully",
        [OperationStepStatus.STEP_FAILED]: "Failed to edit a lending order",
        [OperationStepStatus.OPERATION_COMPLETED]: "Lending order edited successfully",
      },
    },
  ];
}

function EditOrderActionButton({
  amountToApprove,
  order,
  disabled,
  recreateTokenList,
}: {
  amountToApprove: string;
  order: LendingOrder;
  disabled?: boolean;
  recreateTokenList: boolean;
}) {
  const { handleEditOrder } = useEditOrder();

  const { status, modifyOrderHash } = useEditOrderStatusStore();
  const { loanToken } = useEditOrderParams();

  if (status !== EditOrderStatus.INITIAL) {
    return (
      <OperationRows>
        {createOrderSteps().map((step, index) => (
          <OperationStepRow
            key={index}
            iconName={step.iconName}
            hash={[modifyOrderHash][index]}
            statusTextMap={step.textMap}
            status={operationStatusToStepStatus({
              currentStatus: status,
              orderedSteps: createOrderSteps().flatMap((s) => [s.pending, s.loading, s.error]),
              stepIndex: index,
              pendingStep: step.pending,
              loadingStep: step.loading,
              errorStep: step.error,
              successStep: EditOrderStatus.SUCCESS,
            })}
            isFirstStep={index === 0}
          />
        ))}
      </OperationRows>
    );
  }

  return (
    <Button disabled={disabled} onClick={() => handleEditOrder(order, recreateTokenList)} fullWidth>
      {disabled ? "No changes were made" : "Save changes"}
    </Button>
  );
}

const fieldTooltipKeys = {
  leverage: "leverage_order_tooltip",
  "currency-limit": "currency_limit_order_tooltip",
  "min-borrowing": "min_borrowing_tooltip",
  "interest-rate": "interest_rate_tooltip",
  deadline: "order_deadline_tooltip",
  "position-duration": "position_duration_tooltip",
  "allowed-collateral": "accepted_collateral_tooltip",
  "allowed-for-trading": "tokens_allowed_tooltip",
  "fee-for-liquidator": "fee_for_liquidator_tooltip",
} as const;

function tooltipKeyFor(id: string) {
  return id in fieldTooltipKeys ? fieldTooltipKeys[id as keyof typeof fieldTooltipKeys] : undefined;
}

type FieldDiff<T> = {
  id: string;
  label: string;
  oldValue: string | number | ReactNode;
  newValue: string | number | ReactNode;
};

type FieldConfig = {
  id: string;
  label: string;
  compare: () => boolean;
  getOldValue: () => string | number | ReactNode;
  getNewValue: () => string | number | ReactNode;
};

export default function ReviewEditOrderDialog({
  isOpen,
  setIsOpen,
  order,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  order: LendingOrder;
}) {
  const t = useTranslations("Margin");
  const [isEditApproveActive, setEditApproveActive] = React.useState(false);

  const { status, setStatus } = useEditOrderStatusStore();

  useEffect(() => {
    if (
      (status === EditOrderStatus.ERROR_MODIFY || status === EditOrderStatus.SUCCESS) &&
      !isOpen
    ) {
      setTimeout(() => {
        setStatus(EditOrderStatus.INITIAL);
      }, 400);
    }
  }, [isOpen, setStatus, status]);

  const isInitialStatus = useMemo(() => status === EditOrderStatus.INITIAL, [status]);
  const isFinalStatus = useMemo(
    () => status === EditOrderStatus.SUCCESS || status === EditOrderStatus.ERROR_MODIFY,
    [status],
  );
  const isLoadingStatus = useMemo(
    () => !isInitialStatus && !isFinalStatus,
    [isFinalStatus, isInitialStatus],
  );

  const {
    tradingTokens,
    collateralTokens,
    loanAmount,
    liquidationFeeToken,
    liquidationFeeForLiquidator,
    minimumBorrowingAmount,
    orderCurrencyLimit,
    period,
    interestRatePerMonth,
    leverage,
  } = useEditOrderParams();

  const fieldConfigs: FieldConfig[] = useMemo(() => {
    return [
      {
        id: "leverage",
        label: "Leverage",
        compare: () => leverage !== order.leverage,
        getOldValue: () => `${order.leverage}x`,
        getNewValue: () => `${leverage}x`,
      },
      {
        id: "currency-limit",
        label: "Order currency limit",
        compare: () => orderCurrencyLimit !== order.currencyLimit.toString(),
        getOldValue: () => order.currencyLimit,
        getNewValue: () => orderCurrencyLimit,
      },
      {
        id: "min-borrowing",
        label: "Min borrowing",
        compare: () =>
          parseUnits(minimumBorrowingAmount.toString(), order.baseAsset.decimals) !==
          BigInt(order.minLoan),
        getOldValue: () =>
          `${formatUnits(order.minLoan, order.baseAsset.decimals)} ${order.baseAsset.symbol}`,
        getNewValue: () => `${minimumBorrowingAmount} ${order.baseAsset.symbol}`,
      },
      {
        id: "interest-rate",
        label: "Interest rate per month",
        compare: () => +interestRatePerMonth * 100 !== +order.interestRate,
        getOldValue: () => order.interestRate / 100 + "%",
        getNewValue: () => interestRatePerMonth + "%",
      },
      {
        id: "deadline",
        label: "Lending order deadline",
        compare: () =>
          new Date(period.lendingOrderDeadline).getTime() !==
          new Date(order.deadline * 1000).getTime(),
        getOldValue: () => timestampToDateString(order.deadline),
        getNewValue: () =>
          timestampToDateString(new Date(period.lendingOrderDeadline).getTime() / 1000),
      },
      {
        id: "position-duration",
        label: "Position duration",
        compare: () => +period.positionDuration !== order.positionDuration / 60 / 24 / 60,
        getOldValue: () => `${order.positionDuration / 60 / 24 / 60} days`,
        getNewValue: () => `${period.positionDuration} days`,
      },
      {
        id: "allowed-collateral",
        label: "Accepted collateral tokens",
        compare: () => collateralTokens.length !== order.allowedCollateralAssets.length,
        getOldValue: () => <AssetsPreview assets={order.allowedCollateralAssets} />,
        getNewValue: () => <AssetsPreview assets={collateralTokens} />,
      },
      {
        id: "allowed-for-trading",
        label: "Tokens allowed for trading",
        // Compare the exact addresses the edit would send with the order's on-chain whitelist.
        // Counting tokens and comparing against isErc223TradingAllowed (which also reflects
        // collateral and the base asset) reported unchanged lists as changed.
        compare: () => tradingWhitelistChanged(order, tradingTokens),
        getOldValue: () => <AssetsPreview assets={order.allowedTradingAssets} />,
        getNewValue: () => <AssetsPreview assets={tradingTokens.allowedTokens} />,
      },
      {
        id: "fee-for-liquidator",
        label: "Liquidation fee (for liquidator)",
        compare: () =>
          !liquidationFeeToken?.equals(order.liquidationRewardAsset) ||
          parseUnits(liquidationFeeForLiquidator, liquidationFeeToken?.decimals ?? 18) !==
            order.liquidationRewardAmount.value,
        getOldValue: () =>
          `${order.liquidationRewardAmount.formatted} ${order.liquidationRewardAsset.symbol}`,
        getNewValue: () => `${liquidationFeeForLiquidator} ${liquidationFeeToken?.symbol}`,
      },
      // add more fields here...
    ];
  }, [
    collateralTokens,
    interestRatePerMonth,
    leverage,
    liquidationFeeForLiquidator,
    liquidationFeeToken,
    minimumBorrowingAmount,
    order,
    orderCurrencyLimit,
    period.lendingOrderDeadline,
    period.positionDuration,
    tradingTokens,
  ]);

  const modifiedOrderProperties = useMemo(() => {
    return fieldConfigs
      .filter((config) => config.compare())
      .map<FieldDiff<any>>((config) => ({
        id: config.id,
        label: config.label,
        oldValue: config.getOldValue(),
        newValue: config.getNewValue(),
      }));
  }, [fieldConfigs]);

  const [amountToApprove, setAmountToApprove] = useState(loanAmount);

  useEffect(() => {
    if (loanAmount) {
      setAmountToApprove(loanAmount);
    }
  }, [loanAmount]);

  return (
    <DrawerDialog isOpen={isOpen} setIsOpen={setIsOpen}>
      <DialogHeader onClose={() => setIsOpen(false)} title={"Review changes"} />

      <div className="card-spacing-x card-spacing-b w-full md:w-[600px]">
        {isFinalStatus && (
          <div className="pb-3 border-b border-secondary-border mb-4">
            <div className="mx-auto w-[80px] h-[80px] flex items-center justify-center relative mb-5">
              {status === EditOrderStatus.ERROR_MODIFY && <EmptyStateIcon iconName="warning" />}

              {status === EditOrderStatus.SUCCESS && (
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

            {status === EditOrderStatus.SUCCESS && (
              <div>
                <h2 className="text-center mb-1 font-bold text-20 ">
                  Lending order edited successfully
                </h2>
                <p className="text-center mb-1">
                  {order.baseAsset.symbol}{" "}
                  <span className="text-tertiary-text">(ID: {order.id})</span>
                </p>
              </div>
            )}
            {status === EditOrderStatus.ERROR_MODIFY && (
              <div>
                <h2 className="text-center mb-1 font-bold text-20 text-red-light">
                  Failed to edit lending order
                </h2>
                <p className="text-center mb-1">
                  {order.baseAsset.symbol}{" "}
                  <span className="text-tertiary-text">(ID: {order.id})</span>
                </p>
              </div>
            )}
          </div>
        )}
        {(isInitialStatus || isLoadingStatus) && (
          <>
            <div className="flex flex-col gap-2 mb-5">
              {modifiedOrderProperties.map((modifiedOrderProperty: any) => {
                return (
                  <LendingOrderDetailsRow
                    key={modifiedOrderProperty.label}
                    title={modifiedOrderProperty.label}
                    value={
                      <span className="flex items-center gap-1 flex-wrap justify-end">
                        {modifiedOrderProperty.oldValue}{" "}
                        <Svg className="text-tertiary-text" size={20} iconName="next" />{" "}
                        {modifiedOrderProperty.newValue}
                      </span>
                    }
                    tooltipText={(() => {
                      const tooltipKey = tooltipKeyFor(modifiedOrderProperty.id);
                      return tooltipKey ? t(tooltipKey) : "";
                    })()}
                  />
                );
              })}
            </div>
            <div className="my-4 border-b border-secondary-border w-full" />
          </>
        )}

        <EditOrderActionButton
          disabled={!modifiedOrderProperties.length}
          order={order}
          amountToApprove={amountToApprove}
          recreateTokenList={Boolean(
            modifiedOrderProperties.find((value) => value.id === "allowed-for-trading"),
          )}
        />
      </div>
    </DrawerDialog>
  );
}
