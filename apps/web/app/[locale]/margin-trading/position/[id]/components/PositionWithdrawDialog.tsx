import { useTranslations } from "next-intl";
import React, { useEffect, useMemo, useState } from "react";
import { formatEther, formatGwei, formatUnits, parseUnits } from "viem";
import { useAccount } from "wagmi";

import MarginGasSettings from "@/app/[locale]/margin-trading/components/MarginGasSettings";
import usePositionWithdraw, {
  positionWithdrawDeliversErc223,
} from "@/app/[locale]/margin-trading/position/[id]/hooks/usePositionWithdraw";
import {
  PositionWithdrawStatus,
  useWithdrawPositionStatusStore,
} from "@/app/[locale]/margin-trading/position/[id]/stores/usePositionWithdrawStatusStore";
import { MarginPosition } from "@/app/[locale]/margin-trading/types";
import { ReadonlyTokenAmountCard } from "@/app/[locale]/swap/components/ConfirmConvertDialog";
import DialogHeader from "@/components/atoms/DialogHeader";
import DrawerDialog from "@/components/atoms/DrawerDialog";
import EmptyStateIcon from "@/components/atoms/EmptyStateIcon";
import Svg from "@/components/atoms/Svg";
import { InputLabel } from "@/components/atoms/TextField";
import Button, { ButtonColor, ButtonSize } from "@/components/buttons/Button";
import Erc223ReceiveWarning from "@/components/common/Erc223ReceiveWarning";
import OperationStepRow, {
  OperationRows,
  operationStatusToStepStatus,
  OperationStepStatus,
} from "@/components/common/OperationStepRow";
import TokenInput from "@/components/common/TokenInput";
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
  pending: PositionWithdrawStatus;
  loading: PositionWithdrawStatus;
  error: PositionWithdrawStatus;
};

const withdrawPositionSteps: OperationStepConfig[] = [
  {
    iconName: "withdraw",
    pending: PositionWithdrawStatus.PENDING_WITHDRAW,
    loading: PositionWithdrawStatus.LOADING_WITHDRAW,
    error: PositionWithdrawStatus.ERROR_WITHDRAW,
    textMap: {
      [OperationStepStatus.IDLE]: "Withdraw funds",
      [OperationStepStatus.AWAITING_SIGNATURE]: "Withdraw funds",
      [OperationStepStatus.LOADING]: "Executing withdraw",
      [OperationStepStatus.STEP_COMPLETED]: "Withdrawn funds",
      [OperationStepStatus.STEP_FAILED]: "Failed to withdraw funds",
      [OperationStepStatus.OPERATION_COMPLETED]: "Withdrawn funds",
    },
  },
];

function PositionWithdrawActionButton({ position }: { position: MarginPosition }) {
  const t = useTranslations("Margin");
  const { handlePositionWithdraw } = usePositionWithdraw({
    position: position,
  });
  const tSwap = useTranslations("Swap");
  const { address } = useAccount();
  const canReceiveERC223 = useCanReceiveERC223(address);
  const cannotReceive = positionWithdrawDeliversErc223(position) && !canReceiveERC223;

  const { status, withdrawHash } = useWithdrawPositionStatusStore();

  if (status !== PositionWithdrawStatus.INITIAL) {
    return (
      <OperationRows>
        {withdrawPositionSteps.map((step, index) => (
          <OperationStepRow
            key={index}
            iconName={step.iconName}
            hash={[withdrawHash][index]}
            statusTextMap={step.textMap}
            status={operationStatusToStepStatus({
              currentStatus: status,
              orderedSteps: withdrawPositionSteps.flatMap((s) => [s.pending, s.loading, s.error]),
              stepIndex: index,
              pendingStep: step.pending,
              loadingStep: step.loading,
              errorStep: step.error,
              successStep: PositionWithdrawStatus.SUCCESS,
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
    <Button onClick={() => handlePositionWithdraw()} fullWidth>
      {t("withdraw_symbol", { symbol: position.loanAsset.symbol })}
    </Button>
  );
}

export default function PositionWithdrawDialog({
  isOpen,
  setIsOpen,
  position,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  position: MarginPosition;
}) {
  const t = useTranslations("Margin");
  const { status, setStatus } = useWithdrawPositionStatusStore();
  const [amountToWithdraw, setAmountToWithdraw] = useState("");

  const isInitialStatus = useMemo(() => status === PositionWithdrawStatus.INITIAL, [status]);
  const isFinalStatus = useMemo(
    () =>
      status === PositionWithdrawStatus.SUCCESS || status === PositionWithdrawStatus.ERROR_WITHDRAW,
    [status],
  );
  const isLoadingStatus = useMemo(
    () => !isInitialStatus && !isFinalStatus,
    [isFinalStatus, isInitialStatus],
  );

  useEffect(() => {
    if (isFinalStatus && !isOpen) {
      setTimeout(() => {
        setStatus(PositionWithdrawStatus.INITIAL);
      }, 400);
    }
  }, [isFinalStatus, isOpen, setStatus]);

  return (
    <DrawerDialog isOpen={isOpen} setIsOpen={setIsOpen}>
      <DialogHeader onClose={() => setIsOpen(false)} title={t("withdraw")} />
      <div className="w-full md:w-[600px] card-spacing-x card-spacing-b">
        {isInitialStatus && (
          <>
            <p className="text-secondary-text mb-4">{t("position_withdraw_hint")}</p>
            <InputLabel
              label={t("withdraw_amount")}
              tooltipText={t("tokens_for_withdrawal_tooltip")}
            />
            <TokenInput
              handleClick={() => null}
              token={position.loanAsset}
              value={amountToWithdraw}
              onInputChange={(value) => {
                setAmountToWithdraw(value);
              }}
              balance0={"0"}
              balance1={"0"}
              standard={Standard.ERC20}
              setStandard={() => null}
            />

            <MarginGasSettings operation="withdrawPosition" />
          </>
        )}

        {isLoadingStatus && (
          <>
            <ReadonlyTokenAmountCard
              token={position.loanAsset}
              amount={t("unknown")}
              amountUSD={"0"}
              standard={Standard.ERC20}
              title={t("withdraw_amount")}
            />
            <div className="h-px bg-secondary-border my-4" />
          </>
        )}

        {isFinalStatus && (
          <div className="pb-1">
            <div className="mx-auto w-[80px] h-[80px] flex items-center justify-center relative mb-5">
              {status === PositionWithdrawStatus.ERROR_WITHDRAW && (
                <EmptyStateIcon iconName="warning" />
              )}

              {status === PositionWithdrawStatus.SUCCESS && (
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

            {status === PositionWithdrawStatus.SUCCESS && (
              <div>
                <h2 className="text-center mb-1 font-bold text-20 ">{t("withdraw_success")}</h2>
                <p className="text-center mb-1">
                  {amountToWithdraw} {position.loanAsset.symbol}
                </p>
              </div>
            )}
            <div className="my-4 border-b border-secondary-border w-full" />
          </div>
        )}

        <PositionWithdrawActionButton position={position} />
      </div>
    </DrawerDialog>
  );
}
