import GradientCard, { CardGradient } from "@repo/ui/gradient-card";
import Tooltip from "@repo/ui/tooltip";
import Image from "next/image";
import { useTranslations } from "next-intl";
import React, { useEffect, useMemo } from "react";
import { formatEther, formatGwei, formatUnits } from "viem";

import timestampToDateString from "@/app/[locale]/margin-trading/helpers/timestampToDateString";
import calculateTotalOrderBalance from "@/app/[locale]/margin-trading/lending-order/[id]/helpers/calculateTotalOrderBalance";
import useOrderClose from "@/app/[locale]/margin-trading/lending-order/[id]/hooks/useOrderClose";
import {
  OrderCloseStatus,
  useCloseOrderStatusStore,
} from "@/app/[locale]/margin-trading/lending-order/[id]/stores/useCloseOrderStatusStore";
import { LendingOrder } from "@/app/[locale]/margin-trading/types";
import SwapDetailsRow from "@/app/[locale]/swap/components/SwapDetailsRow";
import DialogHeader from "@/components/atoms/DialogHeader";
import DrawerDialog from "@/components/atoms/DrawerDialog";
import EmptyStateIcon from "@/components/atoms/EmptyStateIcon";
import Svg from "@/components/atoms/Svg";
import Button, { ButtonColor, ButtonSize } from "@/components/buttons/Button";
import GasSettingsBlock from "@/components/common/GasSettingsBlock";
import OperationStepRow, {
  OperationRows,
  operationStatusToStepStatus,
  OperationStepStatus,
} from "@/components/common/OperationStepRow";
import { MARGIN_MODULE_ABI } from "@/config/abis/marginModule";
import { IconName } from "@/config/types/IconName";
import { formatFloat } from "@/functions/formatFloat";
import { MARGIN_TRADING_ADDRESS } from "@/sdk_bi/addresses";
import { DexChainId } from "@/sdk_bi/chains";

type StepTextMap = {
  [key in OperationStepStatus]: string;
};

type OperationStepConfig = {
  iconName: IconName;
  textMap: StepTextMap;
  pending: OrderCloseStatus;
  loading: OrderCloseStatus;
  error: OrderCloseStatus;
};

function composeDepositOrderSteps(): OperationStepConfig[] {
  return [
    {
      iconName: "closed",
      pending: OrderCloseStatus.PENDING_CLOSE_ORDER,
      loading: OrderCloseStatus.LOADING_CLOSE_ORDER,
      error: OrderCloseStatus.ERROR_CLOSE_ORDER,
      textMap: {
        [OperationStepStatus.IDLE]: "Close lending order",
        [OperationStepStatus.AWAITING_SIGNATURE]: "Close lending order",
        [OperationStepStatus.LOADING]: "Closing lending order",
        [OperationStepStatus.STEP_COMPLETED]: "Lending order closed successfully",
        [OperationStepStatus.STEP_FAILED]: "Failed to close lending order",
        [OperationStepStatus.OPERATION_COMPLETED]: "Lending order closed successfully",
      },
    },
  ];
}

function OrderCloseActionButton({ order }: { order: LendingOrder }) {
  const { status, closeOrderHash } = useCloseOrderStatusStore();
  const { handleOrderClose } = useOrderClose({ order });

  if (status !== OrderCloseStatus.INITIAL) {
    return (
      <OperationRows>
        {composeDepositOrderSteps().map((step, index) => (
          <OperationStepRow
            key={index}
            iconName={step.iconName}
            hash={[closeOrderHash][index]}
            statusTextMap={step.textMap}
            status={operationStatusToStepStatus({
              currentStatus: status,
              orderedSteps: composeDepositOrderSteps().flatMap((s) => [
                s.pending,
                s.loading,
                s.error,
              ]),
              stepIndex: index,
              pendingStep: step.pending,
              loadingStep: step.loading,
              errorStep: step.error,
              successStep: OrderCloseStatus.SUCCESS,
            })}
            isFirstStep={index === 0}
          />
        ))}
      </OperationRows>
    );
  }

  return (
    <Button onClick={() => handleOrderClose(order.id)} fullWidth>
      Close order
    </Button>
  );
}

export default function OrderCloseDialog({
  isOpen,
  setIsOpen,
  order,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  order: LendingOrder | undefined;
}) {
  const { status, setStatus } = useCloseOrderStatusStore();
  const t = useTranslations("Margin");
  const isInitialStatus = useMemo(() => status === OrderCloseStatus.INITIAL, [status]);
  const isFinalStatus = useMemo(
    () => status === OrderCloseStatus.SUCCESS || status === OrderCloseStatus.ERROR_CLOSE_ORDER,
    [status],
  );
  const isLoadingStatus = useMemo(
    () => !isInitialStatus && !isFinalStatus,
    [isFinalStatus, isInitialStatus],
  );

  useEffect(() => {
    if (
      (status === OrderCloseStatus.ERROR_CLOSE_ORDER || status === OrderCloseStatus.SUCCESS) &&
      !isOpen
    ) {
      setTimeout(() => {
        setStatus(OrderCloseStatus.INITIAL);
      }, 400);
    }
  }, [isOpen, setStatus, status]);

  return (
    <DrawerDialog isOpen={isOpen} setIsOpen={setIsOpen}>
      <DialogHeader onClose={() => setIsOpen(false)} title={t("close_lending_order")} />
      {order ? (
        <div className="card-spacing-x card-spacing-b w-full md:w-auto md:min-w-[600px]">
          {isInitialStatus && (
            <>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <Image
                    width={32}
                    height={32}
                    src={order.baseAsset.logoURI || "/images/tokens/placeholder.svg"}
                    alt=""
                  />
                  <span className="text-secondary-text text-18 font-bold">
                    {order.baseAsset.name}
                  </span>
                  <div className="flex items-center gap-3 text-green">
                    {t("status_active")}
                    <div className="w-2 h-2 rounded-full bg-green"></div>
                  </div>
                </div>
                <div className="text-secondary-text text-12 py-2 px-4 rounded-2 bg-tertiary-bg">
                  <span className="text-tertiary-text">{t("order_id")}: </span>
                  {order.id}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <GradientCard
                  gradient={CardGradient.BLUE_LIGHT}
                  className="flex px-5 py-3 justify-between "
                >
                  <div className="">
                    <div className="items-center flex gap-1 text-tertiary-text">
                      {t("available_balance")}
                      <Tooltip text={t("available_balance_tooltip")} />
                    </div>

                    <p className="font-medium text-20">
                      {formatUnits(order.balance, order.baseAsset.decimals ?? 18)}{" "}
                      <span className="text-secondary-text">{order.baseAsset.symbol}</span>
                    </p>
                  </div>
                </GradientCard>

                <GradientCard className=" px-5 py-3 ">
                  <div className="">
                    <div className="items-center flex gap-1 text-tertiary-text">
                      {t("total_balance")}
                      <Tooltip text={t("total_balance_tooltip")} />
                    </div>

                    <p className="font-medium text-20">
                      {formatFloat(
                        formatUnits(calculateTotalOrderBalance(order), order.baseAsset.decimals),
                      )}{" "}
                      <span className="text-secondary-text">{order.baseAsset.symbol}</span>
                    </p>
                  </div>
                </GradientCard>
              </div>

              <div className="flex flex-col gap-2 my-4">
                <SwapDetailsRow
                  tooltipText={t("close_row_tooltip")}
                  title={t("max_leverage")}
                  value={`${order.leverage}x`}
                />
                <SwapDetailsRow
                  tooltipText={t("close_row_tooltip")}
                  title={t("interest_per_month")}
                  value={`${order.interestRate / 100}%`}
                />
                <SwapDetailsRow
                  tooltipText={t("close_row_tooltip")}
                  title={t("deadline")}
                  value={`${timestampToDateString(order.deadline)}`}
                />
              </div>
              <GasSettingsBlock />
            </>
          )}
          {isLoadingStatus && (
            <>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <Image
                    width={32}
                    height={32}
                    src={order.baseAsset.logoURI || "/images/tokens/placeholder.svg"}
                    alt=""
                  />
                  <span className="text-secondary-text text-18 font-bold">
                    {order.baseAsset.name}
                  </span>
                  <div className="flex items-center gap-3 text-green">
                    {t("status_active")}
                    <div className="w-2 h-2 rounded-full bg-green"></div>
                  </div>
                </div>
                <div className="text-secondary-text text-12 py-2 px-4 rounded-2 bg-tertiary-bg">
                  <span className="text-tertiary-text">{t("order_id")}: </span>
                  {order.id}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-1">
                <GradientCard
                  gradient={CardGradient.BLUE_LIGHT}
                  className="flex px-5 py-3 justify-between "
                >
                  <div className="">
                    <div className="items-center flex gap-1 text-tertiary-text">
                      {t("available_balance")}
                      <Tooltip text={t("available_balance_tooltip")} />
                    </div>

                    <p className="font-medium text-20">
                      {formatUnits(order.balance, order.baseAsset.decimals ?? 18)}{" "}
                      <span className="text-secondary-text">{order.baseAsset.symbol}</span>
                    </p>
                  </div>
                </GradientCard>

                <GradientCard className=" px-5 py-3 ">
                  <div className="">
                    <div className="items-center flex gap-1 text-tertiary-text">
                      {t("total_balance")}
                      <Tooltip text={t("total_balance_tooltip")} />
                    </div>

                    <p className="font-medium text-20">
                      {formatFloat(
                        formatUnits(calculateTotalOrderBalance(order), order.baseAsset.decimals),
                      )}{" "}
                      <span className="text-secondary-text">{order.baseAsset.symbol}</span>
                    </p>
                  </div>
                </GradientCard>
              </div>
              <div className="my-4 border-b border-secondary-border w-full" />
            </>
          )}
          {isFinalStatus && (
            <div className="pb-1">
              <div className="mx-auto w-[80px] h-[80px] flex items-center justify-center relative mb-5">
                {status === OrderCloseStatus.ERROR_CLOSE_ORDER && (
                  <EmptyStateIcon iconName="warning" />
                )}

                {status === OrderCloseStatus.SUCCESS && (
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

              {status === OrderCloseStatus.SUCCESS && (
                <div>
                  <h2 className="text-center mb-1 font-bold text-20 ">{t("order_closed")}</h2>
                  <p className="text-center mb-1">
                    {order.baseAsset.symbol}{" "}
                    <span className="text-tertiary-text">(ID: {order.id})</span>
                  </p>
                </div>
              )}
              {status === OrderCloseStatus.ERROR_CLOSE_ORDER && (
                <div>
                  <h2 className="text-center mb-1 font-bold text-20 text-red-light">
                    {t("order_close_failed")}
                  </h2>
                  <p className="text-center mb-1">
                    {order.baseAsset.symbol}{" "}
                    <span className="text-tertiary-text">(ID: {order.id})</span>
                  </p>
                </div>
              )}
              <div className="my-4 border-b border-secondary-border w-full" />
            </div>
          )}

          <OrderCloseActionButton order={order} />
        </div>
      ) : (
        <div>{t("no_order_provided")}</div>
      )}
    </DrawerDialog>
  );
}
