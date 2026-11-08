import { useTranslations } from "next-intl";
import React, { useEffect, useMemo, useState } from "react";
import { parseUnits } from "viem";

import {
  getApproveTextMap,
  getTransferTextMap,
} from "@/app/[locale]/margin-trading/lending-order/[id]/helpers/getStepTexts";
import usePositionDeposit from "@/app/[locale]/margin-trading/position/[id]/deposit/hooks/usePositionDeposit";
import {
  PositionDepositStatus,
  useDepositPositionStatusStore,
} from "@/app/[locale]/margin-trading/position/[id]/stores/usePositionDepositStatusStore";
import { MarginPosition } from "@/app/[locale]/margin-trading/types";
import { ReadonlyTokenAmountCard } from "@/app/[locale]/swap/components/ConfirmConvertDialog";
import SwapDetailsRow from "@/app/[locale]/swap/components/SwapDetailsRow";
import DialogHeader from "@/components/atoms/DialogHeader";
import DrawerDialog from "@/components/atoms/DrawerDialog";
import EmptyStateIcon from "@/components/atoms/EmptyStateIcon";
import Svg from "@/components/atoms/Svg";
import Button from "@/components/buttons/Button";
import ApproveAmountConfig from "@/components/common/ApproveAmountConfig";
import OperationStepRow, {
  OperationRows,
  operationStatusToStepStatus,
  OperationStepStatus,
} from "@/components/common/OperationStepRow";
import { IconName } from "@/config/types/IconName";
import { Currency } from "@/sdk_bi/entities/currency";
import { Standard } from "@/sdk_bi/standard";

type StepTextMap = {
  [key in OperationStepStatus]: string;
};

type OperationStepConfig = {
  iconName: IconName;
  textMap: StepTextMap;
  pending: PositionDepositStatus;
  loading: PositionDepositStatus;
  error: PositionDepositStatus;
};

function composeDepositOrderSteps(symbol: string, standard: Standard): OperationStepConfig[] {
  const firstStep =
    standard === Standard.ERC20
      ? ({
          iconName: "done",
          pending: PositionDepositStatus.PENDING_APPROVE,
          loading: PositionDepositStatus.LOADING_APPROVE,
          error: PositionDepositStatus.ERROR_APPROVE,
          textMap: getApproveTextMap(symbol),
        } as const)
      : ({
          iconName: "transfer-to-contract",
          pending: PositionDepositStatus.PENDING_TRANSFER,
          loading: PositionDepositStatus.LOADING_TRANSFER,
          error: PositionDepositStatus.ERROR_TRANSFER,
          textMap: getTransferTextMap(symbol),
        } as const);

  return [
    firstStep,
    {
      iconName: "deposit",
      pending: PositionDepositStatus.PENDING_DEPOSIT,
      loading: PositionDepositStatus.LOADING_DEPOSIT,
      error: PositionDepositStatus.ERROR_DEPOSIT,
      textMap: {
        [OperationStepStatus.IDLE]: "Deposit funds",
        [OperationStepStatus.AWAITING_SIGNATURE]: "Deposit funds",
        [OperationStepStatus.LOADING]: "Executing deposit",
        [OperationStepStatus.STEP_COMPLETED]: "Deposited funds",
        [OperationStepStatus.STEP_FAILED]: "Failed to deposit funds",
        [OperationStepStatus.OPERATION_COMPLETED]: "Deposited funds",
      },
    },
  ];
}

function PositionDepositActionButton({
  position,
  amountToApprove,
  amountToDeposit,
  disabled,
  assetToDeposit,
  assetToDepositStandard,
}: {
  position: MarginPosition;
  amountToApprove: string;
  amountToDeposit: string;
  disabled: boolean;
  assetToDeposit: Currency;
  assetToDepositStandard: Standard;
}) {
  const t = useTranslations("Margin");
  const { handlePositionDeposit } = usePositionDeposit({
    position: position,
    currency: assetToDeposit,
    amount: amountToDeposit,
    standard: assetToDepositStandard,
  });

  const { status, approveHash, transferHash, depositHash } = useDepositPositionStatusStore();

  const hashes = useMemo(() => {
    if (assetToDeposit.isNative) {
      return [depositHash];
    }

    if (assetToDepositStandard === Standard.ERC20) {
      return [approveHash, depositHash];
    }

    if (assetToDepositStandard === Standard.ERC223) {
      return [transferHash, depositHash];
    }

    return [approveHash, depositHash];
  }, [approveHash, assetToDeposit.isNative, assetToDepositStandard, depositHash, transferHash]);

  if (status !== PositionDepositStatus.INITIAL) {
    return (
      <OperationRows>
        {composeDepositOrderSteps(
          assetToDeposit.wrapped.symbol || "Unknown",
          assetToDepositStandard,
        ).map((step, index) => (
          <OperationStepRow
            key={index}
            iconName={step.iconName}
            hash={hashes[index]}
            statusTextMap={step.textMap}
            status={operationStatusToStepStatus({
              currentStatus: status,
              orderedSteps: composeDepositOrderSteps(
                assetToDeposit.wrapped.symbol || "Unknown",
                assetToDepositStandard,
              ).flatMap((s) => [s.pending, s.loading, s.error]),
              stepIndex: index,
              pendingStep: step.pending,
              loadingStep: step.loading,
              errorStep: step.error,
              successStep: PositionDepositStatus.SUCCESS,
            })}
            isFirstStep={index === 0}
          />
        ))}
      </OperationRows>
    );
  }

  return (
    <Button disabled={disabled} onClick={() => handlePositionDeposit(amountToApprove)} fullWidth>
      {t("deposit_symbol", { symbol: assetToDeposit.symbol })}
    </Button>
  );
}

export default function PositionDepositDialog({
  isOpen,
  setIsOpen,
  position,
  amountToDeposit,
  assetToDeposit,
  assetToDepositStandard,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  position: MarginPosition;
  assetToDeposit: Currency;
  assetToDepositStandard: Standard;
  amountToDeposit: string;
}) {
  const t = useTranslations("Margin");
  const { status, setStatus } = useDepositPositionStatusStore();
  const [isEditApproveActive, setEditApproveActive] = useState(false);

  const isInitialStatus = useMemo(() => status === PositionDepositStatus.INITIAL, [status]);
  const isErrorStatus = useMemo(
    () =>
      status === PositionDepositStatus.ERROR_DEPOSIT ||
      status === PositionDepositStatus.ERROR_APPROVE ||
      status === PositionDepositStatus.ERROR_TRANSFER,
    [status],
  );
  const isFinalStatus = useMemo(
    () => status === PositionDepositStatus.SUCCESS || isErrorStatus,
    [isErrorStatus, status],
  );

  const isLoadingStatus = useMemo(
    () => !isInitialStatus && !isFinalStatus,
    [isFinalStatus, isInitialStatus],
  );

  const parsedMinAmount = useMemo(() => {
    try {
      return amountToDeposit.trim() ? parseUnits(amountToDeposit, assetToDeposit.decimals) : 0n;
    } catch {
      return 0n;
    }
  }, [amountToDeposit, assetToDeposit.decimals]);

  useEffect(() => {
    if (isFinalStatus && !isOpen) {
      setTimeout(() => {
        setStatus(PositionDepositStatus.INITIAL);
      }, 400);
    }
  }, [isFinalStatus, isOpen, setStatus, status]);

  const [amountToApprove, setAmountToApprove] = useState(amountToDeposit);

  useEffect(() => {
    setAmountToApprove(amountToDeposit);
  }, [amountToDeposit]);

  return (
    <DrawerDialog isOpen={isOpen} setIsOpen={setIsOpen}>
      <DialogHeader onClose={() => setIsOpen(false)} title={t("deposit")} />
      <div className="w-full md:w-[600px] card-spacing-x card-spacing-b">
        {isInitialStatus && (
          <>
            <ReadonlyTokenAmountCard
              token={assetToDeposit}
              amount={amountToDeposit}
              amountUSD={"0"}
              standard={assetToDepositStandard}
              title={t("deposit_amount")}
            />
            <div className="flex flex-col mt-4">
              <SwapDetailsRow
                title={t("leverage")}
                tooltipText={t("leverage_deposit_tooltip")}
                value={position.order.leverage}
              />
            </div>
            {assetToDeposit.isToken && assetToDepositStandard === Standard.ERC20 ? (
              <ApproveAmountConfig
                asset={assetToDeposit}
                amountToApprove={amountToApprove}
                setAmountToApprove={setAmountToApprove}
                setEditApproveActive={setEditApproveActive}
                isEditApproveActive={isEditApproveActive}
                minAmount={parsedMinAmount}
              />
            ) : null}
          </>
        )}

        {isLoadingStatus && (
          <>
            <ReadonlyTokenAmountCard
              token={assetToDeposit}
              amount={amountToDeposit}
              amountUSD={"0"}
              standard={assetToDepositStandard}
              title={t("deposit_amount")}
            />
            <div className="h-px bg-secondary-border my-4" />
          </>
        )}

        {isFinalStatus && (
          <div className="pb-1">
            <div className="mx-auto w-[80px] h-[80px] flex items-center justify-center relative mb-5">
              {isErrorStatus && <EmptyStateIcon iconName="warning" />}

              {status === PositionDepositStatus.SUCCESS && (
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

            {status === PositionDepositStatus.SUCCESS && (
              <div>
                <h2 className="text-center mb-1 font-bold text-20 ">{t("deposit_success")}</h2>
                <p className="text-center mb-1">
                  {amountToDeposit} {assetToDeposit.symbol}
                </p>
              </div>
            )}

            {isErrorStatus && (
              <div>
                <h2 className="text-center mb-1 font-bold text-20 text-red-light">
                  {status === PositionDepositStatus.ERROR_DEPOSIT
                    ? t("deposit_failed")
                    : t("approve_failed")}
                </h2>
                <p className="text-center mb-1">
                  {amountToDeposit} {assetToDeposit.symbol}
                </p>
              </div>
            )}
            <div className="my-4 border-b border-secondary-border w-full" />
          </div>
        )}

        <PositionDepositActionButton
          position={position}
          amountToApprove={amountToApprove}
          amountToDeposit={amountToDeposit}
          disabled={isEditApproveActive}
          assetToDeposit={assetToDeposit}
          assetToDepositStandard={assetToDepositStandard}
        />
      </div>
    </DrawerDialog>
  );
}

