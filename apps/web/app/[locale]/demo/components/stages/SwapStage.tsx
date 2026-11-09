"use client";

import Alert from "@repo/ui/alert";
import { useTranslations } from "next-intl";

import Svg from "@/components/atoms/Svg";
import OperationStepRow, { OperationStepStatus } from "@/components/common/OperationStepRow";
import { IconName } from "@/config/types/IconName";

import { DEMO_D223_PER_USDT } from "../../flows";
import DemoAction from "../DemoAction";
import { DemoChip } from "../DemoChip";
import DemoTokenBox from "../DemoTokenBox";
import { DemoCard, DemoDetails, DemoHint, useDemoNumber } from "../DemoUi";
import { StageProps } from "../stageTypes";

function StepRow({
  label,
  status,
  iconName,
  isFirstStep,
}: {
  label: string;
  status: OperationStepStatus;
  iconName: IconName;
  isFirstStep: boolean;
}) {
  const textMap = Object.fromEntries(
    Object.values(OperationStepStatus)
      .filter((value) => typeof value === "number")
      .map((value) => [value, label]),
  ) as Record<OperationStepStatus, string>;
  return (
    <OperationStepRow
      status={status}
      statusTextMap={textMap}
      iconName={iconName}
      isFirstStep={isFirstStep}
    />
  );
}

export default function SwapStage(props: StageProps) {
  const {
    stepKey,
    stepNumber,
    status,
    pulse,
    balances,
    amount,
    setAmount,
    overBalance,
    amountInvalid,
    passed,
    onAction,
  } = props;
  const t = useTranslations("Demo");
  const tf = useTranslations("Demo.flows.swap");
  const format = useDemoNumber();

  const value = Number(amount) || 0;
  const receive = value * DEMO_D223_PER_USDT;

  if (stepKey === "compare") {
    const tiles = [
      {
        standard: "ERC-20",
        tx: tf("tx_two"),
        gas: "257K",
        tone: "text-red-light",
        ring: "ring-red/30",
      },
      {
        standard: "ERC-223",
        tx: tf("tx_one"),
        gas: "220K",
        tone: "text-green",
        ring: "ring-green/30",
      },
    ];
    return (
      <DemoCard>
        <h3 className="text-20 font-bold">{tf("result")}</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {tiles.map((tile) => (
            <div
              key={tile.standard}
              className={`bg-secondary-bg rounded-3 p-4 ring-1 ring-inset ${tile.ring} flex flex-col gap-2`}
            >
              <span className="text-12 font-medium text-secondary-text">{tile.standard}</span>
              <span className={`text-24 font-bold ${tile.tone}`}>{tile.tx}</span>
              <span className="flex items-center gap-1 text-secondary-text">
                <Svg iconName="gas" size={20} />
                {tile.gas} GAS
              </span>
            </div>
          ))}
        </div>
        <StepRow
          label={tf("swap_erc223")}
          status={OperationStepStatus.OPERATION_COMPLETED}
          iconName="swap"
          isFirstStep
        />
        <DemoDetails
          rows={[
            [tf("you_paid"), `${format(value, 4)} USDT (ERC-223)`],
            [tf("you_received"), `${format(receive)} D223`],
            [tf("saved"), tf("saved_value"), "text-green"],
          ]}
        />
      </DemoCard>
    );
  }

  const chosen = passed("choose") || stepKey !== "choose";
  const approveStatus = passed("approve")
    ? OperationStepStatus.STEP_COMPLETED
    : stepKey === "approve" && status === "signing"
      ? OperationStepStatus.AWAITING_SIGNATURE
      : OperationStepStatus.IDLE;
  const swapStatus = passed("swap")
    ? OperationStepStatus.OPERATION_COMPLETED
    : stepKey === "swap" && status === "signing"
      ? OperationStepStatus.AWAITING_SIGNATURE
      : OperationStepStatus.IDLE;

  const disabledLabel = overBalance
    ? t("insufficient", { symbol: "USDT" })
    : amountInvalid
      ? t("enter_amount")
      : null;
  const isChoosing = stepKey === "choose" && status === "idle";

  return (
    <DemoCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-20 font-bold">{t("flows.swap.short")}</h3>
        {chosen && <DemoChip tone="erc20">{t("pay_with", { standard: "ERC-20" })}</DemoChip>}
      </div>
      <DemoTokenBox
        label={t("you_pay")}
        amount={amount}
        onAmountChange={passed("approve") ? undefined : setAmount}
        usd={`$${format(value, 2)}`}
        symbol="USDT"
        balances={{ "ERC-20": balances.usdt20, "ERC-223": balances.usdt223 }}
        selected={chosen ? "ERC-20" : undefined}
        highlightStandard={isChoosing ? "ERC-20" : undefined}
        onPickStandard={() => onAction()}
        pulse={pulse}
        error={!!overBalance}
        footer={
          isChoosing ? (
            <div className="flex justify-end max-sm:hidden">
              <DemoHint step={stepNumber} text={tf("steps.choose.hint")} />
            </div>
          ) : null
        }
      />
      <DemoTokenBox
        label={t("you_receive")}
        amount={format(receive)}
        usd={`$${format(value * 0.9971, 2)}`}
        symbol="D223"
        balances={{ "ERC-20": 0, "ERC-223": balances.d223 }}
        selected="ERC-223"
      />
      {overBalance && (
        <Alert
          type="error"
          text={t("insufficient_alert", {
            balance: format(overBalance.balance, 4),
            symbol: overBalance.symbol,
          })}
        />
      )}
      <DemoDetails rows={[[t("network_fee"), tf("fee_value"), "text-red-light"]]} />
      {chosen && (
        <div className="flex flex-col gap-5">
          <StepRow label={tf("approve_usdt")} status={approveStatus} iconName="check" isFirstStep />
          <StepRow
            label={tf("swap_usdt")}
            status={swapStatus}
            iconName="swap"
            isFirstStep={false}
          />
        </div>
      )}
      <DemoAction
        label={stepKey === "swap" ? tf("swap_button") : tf("approve_button")}
        isTarget={stepKey === "approve" || stepKey === "swap"}
        status={status}
        pulse={pulse}
        stepNumber={stepNumber}
        hint={stepKey === "approve" || stepKey === "swap" ? tf(`steps.${stepKey}.hint`) : undefined}
        disabledLabel={stepKey === "choose" ? null : disabledLabel}
        onClick={() =>
          stepKey === "swap" ? onAction({ usdt20: -value, d223: receive }) : onAction()
        }
      />
    </DemoCard>
  );
}
