import Tooltip from "@repo/ui/tooltip";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import React, { useEffect, useMemo, useState } from "react";
import { formatEther, formatGwei } from "viem";

import MarginGasSettings from "@/app/[locale]/margin-trading/components/MarginGasSettings";
import {
  getApproveTextMap,
  getTransferTextMap,
} from "@/app/[locale]/margin-trading/lending-order/[id]/helpers/getStepTexts";
import useOrderDeposit, {
  safeParseDepositUnits,
} from "@/app/[locale]/margin-trading/lending-order/[id]/hooks/useOrderDeposit";
import {
  OrderDepositStatus,
  useDepositOrderStatusStore,
} from "@/app/[locale]/margin-trading/lending-order/[id]/stores/useDepositOrderStatusStore";
import { LendingOrder } from "@/app/[locale]/margin-trading/types";
import { ReadonlyTokenAmountCard } from "@/app/[locale]/swap/components/ConfirmConvertDialog";
import DialogHeader from "@/components/atoms/DialogHeader";
import DrawerDialog from "@/components/atoms/DrawerDialog";
import EmptyStateIcon from "@/components/atoms/EmptyStateIcon";
import Input from "@/components/atoms/Input";
import Svg from "@/components/atoms/Svg";
import TextField from "@/components/atoms/TextField";
import Button, { ButtonColor, ButtonSize } from "@/components/buttons/Button";
import OperationStepRow, {
  OperationRows,
  operationStatusToStepStatus,
  OperationStepStatus,
} from "@/components/common/OperationStepRow";
import { IconName } from "@/config/types/IconName";
import { formatFloat } from "@/functions/formatFloat";
import useTokenBalances from "@/hooks/useTokenBalances";
import { Standard } from "@/sdk_bi/standard";

type StepTextMap = {
  [key in OperationStepStatus]: string;
};

type OperationStepConfig = {
  iconName: IconName;
  textMap: StepTextMap;
  pending: OrderDepositStatus;
  loading: OrderDepositStatus;
  error: OrderDepositStatus;
};

function composeDepositOrderSteps(
  t: ReturnType<typeof useTranslations>,
  symbol: string = "Unknown",
  isNative: boolean,
  standard = Standard.ERC20,
): OperationStepConfig[] {
  if (isNative) {
    return [
      {
        iconName: "deposit",
        pending: OrderDepositStatus.PENDING_DEPOSIT,
        loading: OrderDepositStatus.LOADING_DEPOSIT,
        error: OrderDepositStatus.ERROR_DEPOSIT,
        textMap: {
          [OperationStepStatus.IDLE]: t("deposit_funds"),
          [OperationStepStatus.AWAITING_SIGNATURE]: t("deposit_funds"),
          [OperationStepStatus.LOADING]: t("executing_deposit"),
          [OperationStepStatus.STEP_COMPLETED]: t("deposited_funds"),
          [OperationStepStatus.STEP_FAILED]: t("deposit_funds_failed"),
          [OperationStepStatus.OPERATION_COMPLETED]: t("deposited_funds"),
        },
      },
    ];
  }

  const firstStep =
    standard === Standard.ERC20
      ? ({
          iconName: "done",
          pending: OrderDepositStatus.PENDING_APPROVE,
          loading: OrderDepositStatus.LOADING_APPROVE,
          error: OrderDepositStatus.ERROR_APPROVE,
          textMap: getApproveTextMap(symbol),
        } as const)
      : ({
          iconName: "transfer-to-contract",
          pending: OrderDepositStatus.PENDING_TRANSFER,
          loading: OrderDepositStatus.LOADING_TRANSFER,
          error: OrderDepositStatus.ERROR_TRANSFER,
          textMap: getTransferTextMap(symbol),
        } as const);

  return [
    firstStep,
    {
      iconName: "deposit",
      pending: OrderDepositStatus.PENDING_DEPOSIT,
      loading: OrderDepositStatus.LOADING_DEPOSIT,
      error: OrderDepositStatus.ERROR_DEPOSIT,
      textMap: {
        [OperationStepStatus.IDLE]: t("deposit_funds"),
        [OperationStepStatus.AWAITING_SIGNATURE]: t("deposit_funds"),
        [OperationStepStatus.LOADING]: t("executing_deposit"),
        [OperationStepStatus.STEP_COMPLETED]: t("deposited_funds"),
        [OperationStepStatus.STEP_FAILED]: t("deposit_funds_failed"),
        [OperationStepStatus.OPERATION_COMPLETED]: t("deposited_funds"),
      },
    },
  ];
}

function OrderDepositActionButton({
  order,
  amountToApprove,
  amountToDeposit,
  disabled,
}: {
  order: LendingOrder;
  amountToApprove: string;
  amountToDeposit: string;
  disabled: boolean;
}) {
  const t = useTranslations("Margin");
  const { handleOrderDeposit } = useOrderDeposit({
    orderId: order.id,
    currency: order.baseAsset,
    amount: amountToDeposit,
    standard: order.baseAssetStandard,
  });

  const { status, approveHash, depositHash, transferHash } = useDepositOrderStatusStore();

  const hashes = useMemo(() => {
    if (order.baseAsset.isNative) {
      return [depositHash];
    }

    if (order.baseAssetStandard === Standard.ERC20) {
      return [approveHash, depositHash];
    }

    if (order.baseAssetStandard === Standard.ERC223) {
      return [transferHash, depositHash];
    }

    return [approveHash, depositHash];
  }, [approveHash, depositHash, order.baseAsset.isNative, order.baseAssetStandard, transferHash]);

  if (status !== OrderDepositStatus.INITIAL) {
    return (
      <OperationRows>
        {composeDepositOrderSteps(
          t,
          order.baseAsset.symbol,
          order.baseAsset.isNative,
          order.baseAssetStandard,
        ).map((step, index) => (
          <OperationStepRow
            key={index}
            iconName={step.iconName}
            hash={hashes[index]}
            statusTextMap={step.textMap}
            status={operationStatusToStepStatus({
              currentStatus: status,
              orderedSteps: composeDepositOrderSteps(
                t,
                order.baseAsset.symbol,
                order.baseAsset.isNative,
                order.baseAssetStandard,
              ).flatMap((s) => [s.pending, s.loading, s.error]),
              stepIndex: index,
              pendingStep: step.pending,
              loadingStep: step.loading,
              errorStep: step.error,
              successStep: OrderDepositStatus.SUCCESS,
            })}
            isFirstStep={index === 0}
          />
        ))}
      </OperationRows>
    );
  }

  return (
    <Button disabled={disabled} onClick={() => handleOrderDeposit(amountToApprove)} fullWidth>
      {t("deposit_symbol", { symbol: order.baseAsset.symbol })}
    </Button>
  );
}

export default function OrderDepositDialog({
  isOpen,
  setIsOpen,
  order,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  order: LendingOrder;
}) {
  const [isEditApproveActive, setEditApproveActive] = useState(false);
  const t = useTranslations("Margin");
  const {
    balance: { erc20Balance: tokenA0Balance, erc223Balance: tokenA1Balance },
    refetch: refetchABalance,
  } = useTokenBalances(order.baseAsset);

  const { status, setStatus } = useDepositOrderStatusStore();
  const [amountToDeposit, setAmountToDeposit] = useState("");

  const [amountToApprove, setAmountToApprove] = useState("");

  const [isAmountToApproveModified, setAmountToApproveModified] = useState(false);

  useEffect(() => {
    if (
      (status === OrderDepositStatus.ERROR_APPROVE ||
        status === OrderDepositStatus.ERROR_DEPOSIT ||
        status === OrderDepositStatus.ERROR_TRANSFER ||
        status === OrderDepositStatus.SUCCESS) &&
      !isOpen
    ) {
      setTimeout(() => {
        setStatus(OrderDepositStatus.INITIAL);
      }, 400);
    }
  }, [isOpen, setStatus, status]);

  const activeBalance = useMemo(
    () =>
      order.baseAsset.isNative || order.baseAssetStandard === Standard.ERC20
        ? tokenA0Balance
        : tokenA1Balance,
    [order.baseAsset.isNative, order.baseAssetStandard, tokenA0Balance, tokenA1Balance],
  );

  const parsedDepositAmount = useMemo(
    () => safeParseDepositUnits(amountToDeposit, order.baseAsset.decimals),
    [amountToDeposit, order.baseAsset.decimals],
  );
  const parsedApproveAmount = useMemo(
    () => safeParseDepositUnits(amountToApprove, order.baseAsset.decimals),
    [amountToApprove, order.baseAsset.decimals],
  );
  const isApproveBelowDeposit = Boolean(
    parsedDepositAmount !== null &&
      (parsedApproveAmount === null || parsedApproveAmount < parsedDepositAmount),
  );

  const error = useMemo(() => {
    if (!amountToDeposit.trim()) {
      return undefined;
    }
    if (parsedDepositAmount === null || parsedDepositAmount <= 0n) {
      return t("deposit_amount_required");
    }
    if (activeBalance && parsedDepositAmount > activeBalance.value) {
      return t("available_balance_value", {
        amount:
          activeBalance && Boolean(activeBalance.value) ? formatFloat(activeBalance.formatted) : 0,
        symbol: order.baseAsset.symbol,
      });
    }

    return undefined;
  }, [activeBalance, amountToDeposit, order.baseAsset.symbol, parsedDepositAmount, t]);

  const currentBalance = useMemo(() => {
    if (activeBalance && Boolean(activeBalance.value)) {
      return formatFloat(activeBalance.formatted);
    }

    return "0";
  }, [activeBalance]);

  return (
    <DrawerDialog isOpen={isOpen} setIsOpen={setIsOpen}>
      <DialogHeader onClose={() => setIsOpen(false)} title={t("deposit")} />
      <div className="w-full md:w-[600px] card-spacing-x card-spacing-b">
        {status === OrderDepositStatus.INITIAL ? (
          <>
            <p className="text-secondary-text mb-4">{t("deposit_hint")}</p>
            <TextField
              label={t("deposit_amount")}
              internalText={order.baseAsset.symbol}
              value={amountToDeposit}
              isNumeric
              placeholder={t("deposit_amount")}
              onChange={(e) => {
                const value = e.target.value;
                setAmountToDeposit(value);
                const nextDeposit = safeParseDepositUnits(value, order.baseAsset.decimals);
                if (
                  !isAmountToApproveModified ||
                  (nextDeposit !== null &&
                    (parsedApproveAmount === null || nextDeposit > parsedApproveAmount))
                ) {
                  setAmountToApprove(value);
                  setAmountToApproveModified(false);
                }
              }}
              helperText={t("available_balance_value", {
                amount: currentBalance,
                symbol: order.baseAsset.symbol,
              })}
              error={error}
            />

            {order.baseAsset.isToken && order.baseAssetStandard === Standard.ERC20 ? (
              <div
                className={clsx(
                  "bg-tertiary-bg rounded-3 flex justify-between items-center px-5 py-2 min-h-12 mt-4 gap-5",
                  isApproveBelowDeposit && "pb-[26px]",
                )}
              >
                <div className="flex items-center gap-1 text-secondary-text whitespace-nowrap">
                  <Tooltip iconSize={20} text={t("approve_amount_tooltip")} />
                  <span className="text-14">{t("approve_amount")}</span>
                </div>
                <div className="flex items-center gap-2 flex-grow justify-end">
                  {!isEditApproveActive ? (
                    <span className="text-14">
                      {amountToApprove ? `${amountToApprove} ${order.baseAsset.symbol}` : "—"}
                    </span>
                  ) : (
                    <div className="flex-grow">
                      <div className="relative w-full flex-grow">
                        <Input
                          isError={isApproveBelowDeposit}
                          className="h-8 pl-3"
                          value={amountToApprove}
                          onChange={(e) => setAmountToApprove(e.target.value)}
                          type="text"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-tertiary-text">
                          {order.baseAsset.symbol}
                        </span>
                      </div>
                      {isApproveBelowDeposit && (
                        <span className="text-red-light absolute text-12 translate-y-0.5">
                          {t("approve_must_be_higher", { amount: amountToDeposit })}
                        </span>
                      )}
                    </div>
                  )}
                  {!isEditApproveActive ? (
                    <Button
                      size={ButtonSize.EXTRA_SMALL}
                      colorScheme={ButtonColor.LIGHT_GREEN}
                      onClick={() => setEditApproveActive(true)}
                    >
                      {t("edit")}
                    </Button>
                  ) : (
                    <Button
                      disabled={isApproveBelowDeposit}
                      size={ButtonSize.EXTRA_SMALL}
                      colorScheme={ButtonColor.LIGHT_GREEN}
                      onClick={() => {
                        setEditApproveActive(false);
                        setAmountToApproveModified(true);
                      }}
                    >
                      {t("save")}
                    </Button>
                  )}
                </div>
              </div>
            ) : null}
            <MarginGasSettings operation="depositOrder" />
          </>
        ) : (
          <>
            {status === OrderDepositStatus.SUCCESS ||
            status === OrderDepositStatus.ERROR_DEPOSIT ||
            status === OrderDepositStatus.ERROR_TRANSFER ||
            status === OrderDepositStatus.ERROR_APPROVE ? (
              <div className="pb-1">
                <div className="mx-auto w-[80px] h-[80px] flex items-center justify-center relative mb-5">
                  {(status === OrderDepositStatus.ERROR_DEPOSIT ||
                    status === OrderDepositStatus.ERROR_APPROVE ||
                    status === OrderDepositStatus.ERROR_TRANSFER) && (
                    <EmptyStateIcon iconName="warning" />
                  )}

                  {status === OrderDepositStatus.SUCCESS && (
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

                {status === OrderDepositStatus.SUCCESS && (
                  <div>
                    <h2 className="text-center mb-1 font-bold text-20 ">{t("deposit_success")}</h2>
                    <p className="text-center mb-1">
                      {amountToDeposit} {order.baseAsset.symbol}
                    </p>
                  </div>
                )}

                {(status === OrderDepositStatus.ERROR_DEPOSIT ||
                  status === OrderDepositStatus.ERROR_APPROVE ||
                  status === OrderDepositStatus.ERROR_TRANSFER) && (
                  <div>
                    <h2 className="text-center mb-1 font-bold text-20 text-red-light">
                      {status === OrderDepositStatus.ERROR_DEPOSIT
                        ? t("deposit_failed")
                        : t("approve_failed")}
                    </h2>
                    <p className="text-center mb-1">
                      {amountToDeposit} {order.baseAsset.symbol}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <ReadonlyTokenAmountCard
                token={order.baseAsset}
                amount={amountToDeposit}
                amountUSD={"0"}
                standard={order.baseAssetStandard}
                title={t("deposit_amount")}
              />
            )}

            <div className="h-px bg-secondary-border my-4" />
          </>
        )}

        <OrderDepositActionButton
          disabled={
            isEditApproveActive ||
            !amountToDeposit ||
            !parsedDepositAmount ||
            parsedDepositAmount <= 0n ||
            !!error
          }
          order={order}
          amountToApprove={amountToApprove}
          amountToDeposit={amountToDeposit}
        />
      </div>
    </DrawerDialog>
  );
}
