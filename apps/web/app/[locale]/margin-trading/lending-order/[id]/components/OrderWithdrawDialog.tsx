import { useTranslations } from "next-intl";
import React, { useEffect, useMemo, useState } from "react";
import { formatEther, formatGwei, formatUnits, parseUnits } from "viem";
import { useAccount } from "wagmi";

import MarginGasSettings from "@/app/[locale]/margin-trading/components/MarginGasSettings";
import useOrderWithdraw from "@/app/[locale]/margin-trading/lending-order/[id]/hooks/useOrderWithdraw";
import {
  OrderWithdrawStatus,
  useWithdrawOrderStatusStore,
} from "@/app/[locale]/margin-trading/lending-order/[id]/stores/useWithdrawOrderStatusStore";
import { LendingOrder } from "@/app/[locale]/margin-trading/types";
import { ReadonlyTokenAmountCard } from "@/app/[locale]/swap/components/ConfirmConvertDialog";
import DialogHeader from "@/components/atoms/DialogHeader";
import DrawerDialog from "@/components/atoms/DrawerDialog";
import EmptyStateIcon from "@/components/atoms/EmptyStateIcon";
import { InputSize } from "@/components/atoms/Input";
import Svg from "@/components/atoms/Svg";
import TextField, { InputLabel } from "@/components/atoms/TextField";
import Button, { ButtonColor, ButtonSize } from "@/components/buttons/Button";
import RadioButton from "@/components/buttons/RadioButton";
import Erc223ReceiveWarning from "@/components/common/Erc223ReceiveWarning";
import OperationStepRow, {
  OperationRows,
  operationStatusToStepStatus,
  OperationStepStatus,
} from "@/components/common/OperationStepRow";
import { IconName } from "@/config/types/IconName";
import { formatFloat } from "@/functions/formatFloat";
import useCanReceiveERC223 from "@/hooks/useCanReceiveERC223";
import { Standard } from "@/sdk_bi/standard";

type StepTextMap = {
  [key in OperationStepStatus]: string;
};

type OperationStepConfig = {
  iconName: IconName;
  textMap: StepTextMap;
  pending: OrderWithdrawStatus;
  loading: OrderWithdrawStatus;
  error: OrderWithdrawStatus;
};

const withdrawOrderSteps: OperationStepConfig[] = [
  {
    iconName: "withdraw",
    pending: OrderWithdrawStatus.PENDING_WITHDRAW,
    loading: OrderWithdrawStatus.LOADING_WITHDRAW,
    error: OrderWithdrawStatus.ERROR_WITHDRAW,
    textMap: {
      [OperationStepStatus.IDLE]: "Withdraw assets",
      [OperationStepStatus.AWAITING_SIGNATURE]: "Confirm withdraw",
      [OperationStepStatus.LOADING]: "Executing withdraw",
      [OperationStepStatus.STEP_COMPLETED]: "Successfully withdrawn",
      [OperationStepStatus.STEP_FAILED]: "Failed to withdraw",
      [OperationStepStatus.OPERATION_COMPLETED]: "Successfully withdrawn",
    },
  },
];

function OrderWithdrawActionButton({
  order,
  amountToWithdraw,
  disabled = false,
}: {
  order: LendingOrder;
  amountToWithdraw: string;
  disabled?: boolean;
}) {
  const tSwap = useTranslations("Swap");
  const { address } = useAccount();
  const canReceiveERC223 = useCanReceiveERC223(address);
  // The order pays out in its base-asset standard; ERC-223 can't reach a smart account (EIP-7702).
  const cannotReceive = order.baseAssetStandard === Standard.ERC223 && !canReceiveERC223;
  const { handleOrderWithdraw } = useOrderWithdraw({
    order,
    amountToWithdraw,
    currency: order.baseAsset,
  });

  const { status, withdrawHash } = useWithdrawOrderStatusStore();

  if (status !== OrderWithdrawStatus.INITIAL) {
    return (
      <OperationRows>
        {withdrawOrderSteps.map((step, index) => (
          <OperationStepRow
            key={index}
            iconName={step.iconName}
            hash={[withdrawHash][index]}
            statusTextMap={step.textMap}
            status={operationStatusToStepStatus({
              currentStatus: status,
              orderedSteps: withdrawOrderSteps.flatMap((s) => [s.pending, s.loading, s.error]),
              stepIndex: index,
              pendingStep: step.pending,
              loadingStep: step.loading,
              errorStep: step.error,
              successStep: OrderWithdrawStatus.SUCCESS,
            })}
            isFirstStep={index === 0}
          />
        ))}
      </OperationRows>
    );
  }

  if (cannotReceive) {
    return (
      <>
        <Erc223ReceiveWarning className="mb-4" />
        <Button disabled fullWidth>
          {tSwap("wallet_cannot_receive_erc223")}
        </Button>
      </>
    );
  }

  return (
    <Button disabled={disabled} onClick={() => handleOrderWithdraw()} fullWidth>
      Withdraw
    </Button>
  );
}

export default function OrderWithdrawDialog({
  isOpen,
  setIsOpen,
  order,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  order: LendingOrder;
}) {
  const { status, setStatus } = useWithdrawOrderStatusStore();
  const t = useTranslations("Margin");

  const [amountToWithdraw, setAmountToWithdraw] = useState<string>("");

  const isInitialStatus = useMemo(() => status === OrderWithdrawStatus.INITIAL, [status]);
  const isFinalStatus = useMemo(
    () => status === OrderWithdrawStatus.SUCCESS || status === OrderWithdrawStatus.ERROR_WITHDRAW,
    [status],
  );
  const isLoadingStatus = useMemo(
    () => !isInitialStatus && !isFinalStatus,
    [isFinalStatus, isInitialStatus],
  );

  useEffect(() => {
    if (isFinalStatus && !isOpen && !isOpen) {
      setTimeout(() => {
        setStatus(OrderWithdrawStatus.INITIAL);
      }, 400);
    }
  }, [isFinalStatus, isOpen, setStatus]);

  const error = useMemo(() => {
    if (parseUnits(amountToWithdraw, order.baseAsset.decimals) > order.balance)
      return `Maximum withdraw amount: ${formatUnits(order.balance, order.baseAsset.decimals)} ${order.baseAsset.symbol}`;
  }, [amountToWithdraw, order.balance, order.baseAsset.decimals, order.baseAsset.symbol]);

  return (
    <DrawerDialog isOpen={isOpen} setIsOpen={setIsOpen}>
      <DialogHeader onClose={() => setIsOpen(false)} title={t("withdraw")} />
      <div className="w-full md:w-[600px] card-spacing-x card-spacing-b">
        {isInitialStatus && (
          <>
            <p className="text-secondary-text mb-4">{t("withdraw_hint")}</p>
            <TextField
              label={t("withdraw_amount")}
              tooltipText={t("withdraw_amount_tooltip")}
              internalText={order.baseAsset.symbol}
              placeholder={t("withdraw_amount")}
              value={amountToWithdraw}
              onChange={(e) => setAmountToWithdraw(e.target.value)}
              helperText={t("max_withdraw_amount", {
                amount: formatUnits(order.balance, order.baseAsset.decimals),
                symbol: order.baseAsset.symbol,
              })}
              error={error}
            />

            <div className="mt-3 ">
              <InputLabel
                inputSize={InputSize.LARGE}
                label={t("standard_for", { symbol: order.baseAsset.symbol })}
                tooltipText={t("withdraw_limit_tooltip")}
              />
              <div className="grid grid-cols-2 gap-3">
                {[Standard.ERC20, Standard.ERC223].map((st) => {
                  return (
                    <RadioButton
                      key={st}
                      className="min-h-10 py-2 bg-tertiary-bg"
                      isActive={st === order.baseAssetStandard}
                      disabled={st !== order.baseAssetStandard}
                    >
                      {st}
                    </RadioButton>
                  );
                })}
              </div>
            </div>

            <div className="mt-6" />
            <InputLabel
              inputSize={InputSize.LARGE}
              label="Withdraw limit"
              tooltipText={t("withdraw_limit_tooltip")}
            />
            <div className="pt-4 pb-5 px-5 rounded-4 bg-tertiary-bg mb-4">
              <p className="mb-2">
                No limit
                {/*1000 / 1200 <span className="text-secondary-text">USDT</span>*/}
              </p>
              <div className="rounded-20 h-3 bg-secondary-bg w-full">
                <div
                  className="rounded-20 h-3 bg-gradient-progress-bar-green"
                  style={{ width: `${100}%` }}
                />
              </div>
            </div>

            <MarginGasSettings operation="withdrawOrder" />
          </>
        )}
        {isFinalStatus && (
          <div className="pb-1">
            <div className="mx-auto w-[80px] h-[80px] flex items-center justify-center relative mb-5">
              {status === OrderWithdrawStatus.ERROR_WITHDRAW && (
                <EmptyStateIcon iconName="warning" />
              )}

              {status === OrderWithdrawStatus.SUCCESS && (
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

            {status === OrderWithdrawStatus.SUCCESS && (
              <div>
                <h2 className="text-center mb-1 font-bold text-20 ">{t("withdraw_success")}</h2>
                <p className="text-center mb-1">
                  {amountToWithdraw} {order.baseAsset.symbol}
                </p>
              </div>
            )}
            {status === OrderWithdrawStatus.ERROR_WITHDRAW && (
              <div>
                <h2 className="text-center mb-1 font-bold text-20 text-red-light">
                  {t("withdraw_failed")}
                </h2>
                <p className="text-center mb-1">
                  {amountToWithdraw} {order.baseAsset.symbol}
                </p>
              </div>
            )}
            <div className="my-4 border-b border-secondary-border w-full" />
          </div>
        )}
        {isLoadingStatus && (
          <>
            <ReadonlyTokenAmountCard
              token={order.baseAsset}
              amount={amountToWithdraw}
              amountUSD={"0"}
              standard={Standard.ERC20}
              title={t("withdraw_amount")}
            />
            <div className="h-px bg-secondary-border my-4" />
          </>
        )}
        <OrderWithdrawActionButton
          disabled={!!error || !amountToWithdraw}
          order={order}
          amountToWithdraw={amountToWithdraw}
        />
      </div>
    </DrawerDialog>
  );
}
