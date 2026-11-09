"use client";

import Alert from "@repo/ui/alert";
import { useTranslations } from "next-intl";

import { clsxMerge } from "@/functions/clsxMerge";

import { DEMO_D223_PER_USDT, DEMO_LIQUIDITY_DEPOSIT } from "../../flows";
import DemoAction from "../DemoAction";
import { DemoChip, DemoChipButton } from "../DemoChip";
import { DemoTokenLogo } from "../DemoTokenBox";
import {
  DEMO_TARGET,
  DemoCard,
  DemoDetails,
  demoHighlight,
  DemoHint,
  useDemoNumber,
} from "../DemoUi";
import { StageProps } from "../stageTypes";

const TIERS = [
  { fee: "0.01%", key: "t001" },
  { fee: "0.05%", key: "t005" },
  { fee: "0.3%", key: "t03" },
  { fee: "1%", key: "t1" },
] as const;

export default function LiquidityStage(props: StageProps) {
  const { stepKey, stepNumber, status, pulse, balances, passed, onAction } = props;
  const t = useTranslations("Demo");
  const tf = useTranslations("Demo.flows.liquidity");
  const format = useDemoNumber();

  const feePicked = passed("fee");
  const rangeSet = passed("range");
  const added = passed("add");
  const pickingFee = stepKey === "fee" && status === "idle";
  const settingRange = stepKey === "range" && status === "idle";
  const { usdt20, d223 } = DEMO_LIQUIDITY_DEPOSIT;
  const shortfalls =
    stepKey === "add" && status === "idle"
      ? [
          { symbol: "USDT", required: usdt20, balance: balances.usdt20 },
          { symbol: "D223", required: d223, balance: balances.d223 },
        ].filter(({ required, balance }) => balance < required)
      : [];

  return (
    <DemoCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex -space-x-2">
            <DemoTokenLogo symbol="USDT" size={28} />
            <DemoTokenLogo symbol="D223" size={28} />
          </span>
          <h3 className="text-20 font-bold">{tf("pair")}</h3>
        </div>
        {added && <DemoChip tone="success">{tf("in_range")}</DemoChip>}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-secondary-text font-medium">{tf("fee_tier")}</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TIERS.map((tier) => {
            const isTarget = pickingFee && tier.fee === "0.3%";
            const isSelected = feePicked && tier.fee === "0.3%";
            return (
              <button
                key={tier.key}
                type="button"
                {...(isTarget ? DEMO_TARGET : {})}
                onClick={isTarget ? () => onAction() : undefined}
                aria-pressed={isSelected}
                className={clsxMerge(
                  "text-left rounded-3 p-3 border duration-200",
                  isSelected ? "bg-green-bg border-green" : "bg-secondary-bg border-transparent",
                  demoHighlight(isTarget),
                  isTarget && pulse && "animate-pulse",
                )}
              >
                <span className="block text-18 font-bold">{tier.fee}</span>
                <span className="block text-12 text-secondary-text">{tf(`tiers.${tier.key}`)}</span>
              </button>
            );
          })}
        </div>
        {pickingFee && (
          <div className="flex justify-end max-sm:hidden">
            <DemoHint step={stepNumber} text={tf("steps.fee.hint")} />
          </div>
        )}
      </div>

      <div className={clsxMerge("flex flex-col gap-2", !feePicked && "opacity-40")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-secondary-text font-medium">{tf("price_range")}</span>
          <DemoChipButton
            {...(settingRange ? DEMO_TARGET : {})}
            onClick={settingRange ? () => onAction() : undefined}
            size="medium"
            tone={rangeSet ? "success" : "neutral"}
            className={clsxMerge(
              demoHighlight(settingRange),
              settingRange && pulse && "animate-pulse",
            )}
          >
            {tf("suggested")}
          </DemoChipButton>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            [tf("min_price"), rangeSet ? format(DEMO_D223_PER_USDT * 0.8) : "—"],
            [tf("max_price"), rangeSet ? format(DEMO_D223_PER_USDT * 1.25) : "—"],
          ].map(([label, value]) => (
            <div key={label} className="bg-secondary-bg rounded-3 p-3">
              <span className="block text-12 text-secondary-text">{label}</span>
              <span className="block text-18 font-bold">{value}</span>
              <span className="block text-12 text-tertiary-text">{tf("per")}</span>
            </div>
          ))}
        </div>
        {settingRange && (
          <div className="flex justify-end max-sm:hidden">
            <DemoHint step={stepNumber} text={tf("steps.range.hint")} />
          </div>
        )}
      </div>

      <div className={clsxMerge("flex flex-col gap-2", !rangeSet && "opacity-40")}>
        <span className="text-secondary-text font-medium">{tf("deposit")}</span>
        <DemoDetails
          rows={[
            ["USDT", rangeSet ? format(usdt20) : "—"],
            ["D223", rangeSet ? format(d223) : "—"],
          ]}
        />
      </div>

      {shortfalls.map(({ symbol, required, balance }) => (
        <Alert
          key={symbol}
          type="error"
          text={tf("insufficient_deposit", {
            symbol,
            required: format(required, 4),
            balance: format(balance, 4),
          })}
        />
      ))}

      <DemoAction
        label={tf("add_button")}
        isTarget={stepKey === "add"}
        status={status}
        pulse={pulse}
        stepNumber={stepNumber}
        hint={tf("steps.add.hint")}
        disabledLabel={
          shortfalls.length
            ? t("insufficient", { symbol: shortfalls.map(({ symbol }) => symbol).join(" / ") })
            : null
        }
        onClick={() => onAction({ usdt20: -usdt20, d223: -d223 })}
      />
    </DemoCard>
  );
}
