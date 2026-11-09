"use client";

import Alert from "@repo/ui/alert";
import { useTranslations } from "next-intl";

import Svg from "@/components/atoms/Svg";
import { clsxMerge } from "@/functions/clsxMerge";

import DemoAction from "../DemoAction";
import DemoTokenBox from "../DemoTokenBox";
import {
  DEMO_TARGET,
  DemoCard,
  DemoDetails,
  demoHighlight,
  DemoHint,
  useDemoNumber,
} from "../DemoUi";
import { StageProps } from "../stageTypes";

export default function ConvertStage(props: StageProps) {
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
  const tf = useTranslations("Demo.flows.convert");
  const format = useDemoNumber();

  const value = Number(amount) || 0;
  const reverse = stepKey === "back";
  const from = reverse ? "ERC-223" : "ERC-20";
  const to = reverse ? "ERC-20" : "ERC-223";
  const picking = stepKey === "pick" && status === "idle";
  const usdtBalances = { "ERC-20": balances.usdt20, "ERC-223": balances.usdt223 };
  const disabledLabel = overBalance
    ? t("insufficient", { symbol: "USDT" })
    : amountInvalid
      ? t("enter_amount")
      : null;

  return (
    <DemoCard>
      <h3 className="text-20 font-bold">{tf("card_title")}</h3>
      <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-2">
        {(
          [
            ["ERC-20", "ERC-223"],
            ["ERC-223", "ERC-20"],
          ] as const
        ).map(([a, b]) => {
          const isTarget = picking && a === "ERC-20";
          const isActive = (passed("pick") || stepKey !== "pick") && a === from;
          return (
            <button
              key={a}
              type="button"
              {...(isTarget ? DEMO_TARGET : {})}
              onClick={isTarget ? () => onAction() : undefined}
              aria-pressed={isActive}
              className={clsxMerge(
                "min-h-10 rounded-2 px-2 py-2 text-12 xl:text-14 font-medium border duration-200 whitespace-nowrap",
                isActive ? "bg-green-bg border-green" : "bg-secondary-bg border-transparent",
                demoHighlight(isTarget),
                isTarget && pulse && "animate-pulse",
              )}
            >
              {tf("direction", { from: a, to: b })}
            </button>
          );
        })}
      </div>
      {picking && (
        <div className="flex justify-end max-sm:hidden">
          <DemoHint step={stepNumber} text={tf("steps.pick.hint")} />
        </div>
      )}
      <DemoTokenBox
        label={tf("from", { standard: from })}
        amount={amount}
        onAmountChange={status === "idle" ? setAmount : undefined}
        usd={`$${format(value, 2)}`}
        symbol="USDT"
        balances={usdtBalances}
        selected={from}
        error={!!overBalance}
      />
      <div className="flex justify-center text-green">
        <Svg iconName="convert" />
      </div>
      <DemoTokenBox
        label={tf("to", { standard: to })}
        amount={format(value, 4)}
        usd={`$${format(value, 2)}`}
        symbol="USDT"
        balances={usdtBalances}
        selected={to}
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
      <DemoDetails
        rows={[
          [tf("rate"), tf("rate_value")],
          [tf("fee"), "0", "text-green"],
        ]}
      />
      <DemoAction
        label={reverse ? tf("convert_back_button") : tf("convert_button")}
        isTarget={stepKey === "convert" || stepKey === "back"}
        status={status}
        pulse={pulse}
        stepNumber={stepNumber}
        hint={
          stepKey === "pick"
            ? undefined
            : tf(stepKey === "back" ? "steps.back.hint" : "steps.convert.hint")
        }
        disabledLabel={stepKey === "pick" ? null : disabledLabel}
        onClick={() =>
          onAction(
            reverse ? { usdt223: -value, usdt20: value } : { usdt20: -value, usdt223: value },
          )
        }
      />
    </DemoCard>
  );
}
