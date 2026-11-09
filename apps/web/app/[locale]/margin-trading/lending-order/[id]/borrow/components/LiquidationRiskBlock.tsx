import Checkbox from "@repo/ui/checkbox";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { parseUnits } from "viem";
import { useReadContract } from "wagmi";

import {
  formatGroupedAmount,
  formatMaintenanceMultiplier,
  formatShortDate,
  fullDurationInterest,
  liquidationDropPercent,
  liquidationLevel,
  scaleDecimals,
} from "@/app/[locale]/margin-trading/helpers/liquidationMath";
import useMaintenanceMarginBps from "@/app/[locale]/margin-trading/hooks/useMaintenanceMarginBps";
import { useCreateMarginPositionConfigStore } from "@/app/[locale]/margin-trading/lending-order/[id]/borrow/stores/useCreateMarginPositionConfigStore";
import { LendingOrder } from "@/app/[locale]/margin-trading/types";
import { ORACLE_ABI } from "@/config/abis/oracle";

const DASH = "—";

function parseTokenAmount(
  amount: string | number | undefined,
  decimals: number,
): bigint | undefined {
  if (amount === undefined || amount === "") {
    return undefined;
  }

  try {
    return parseUnits(String(amount), decimals);
  } catch {
    return undefined;
  }
}

export default function LiquidationRiskBlock({
  order,
  isOpen,
  acknowledged,
  onAcknowledgedChange,
}: {
  order: LendingOrder;
  isOpen: boolean;
  acknowledged: boolean;
  onAcknowledgedChange: (acknowledged: boolean) => void;
}) {
  const t = useTranslations("Margin");
  const { values } = useCreateMarginPositionConfigStore();
  const maintenanceBps = useMaintenanceMarginBps();

  const base = order.baseAsset.wrapped;
  const collateral = values.collateralToken?.wrapped;
  const sameAsset =
    !!collateral && base.address0.toLowerCase() === collateral.address0.toLowerCase();

  const loanAmount = useMemo(
    () => parseTokenAmount(values.borrowAmount, base.decimals),
    [base.decimals, values.borrowAmount],
  );
  const collateralAmount = useMemo(
    () => (collateral ? parseTokenAmount(values.collateralAmount, collateral.decimals) : undefined),
    [collateral, values.collateralAmount],
  );

  const { data: quotedCollateral } = useReadContract({
    address: order.oracle,
    abi: ORACLE_ABI,
    functionName: "getAmountOut",
    args: [base.address0, collateral?.address0 ?? base.address0, collateralAmount ?? 0n],
    query: {
      enabled: isOpen && !sameAsset && !!collateral && !!collateralAmount && collateralAmount > 0n,
    },
  });

  const collateralValue = sameAsset
    ? collateral && collateralAmount !== undefined
      ? scaleDecimals(collateralAmount, collateral.decimals, base.decimals)
      : undefined
    : quotedCollateral;

  const figures = useMemo(() => {
    if (loanAmount === undefined || maintenanceBps === undefined) {
      return undefined;
    }

    const interest = fullDurationInterest(loanAmount, order.interestRate, order.positionDuration);
    const level = liquidationLevel(loanAmount, interest, maintenanceBps);
    const positionValue = collateralValue !== undefined ? loanAmount + collateralValue : undefined;
    const room = positionValue !== undefined ? positionValue - level : undefined;

    return { interest, level, positionValue, room };
  }, [collateralValue, loanAmount, maintenanceBps, order.interestRate, order.positionDuration]);

  const symbol = order.baseAsset.symbol || t("unknown");
  const deadline = formatShortDate(Math.floor(Date.now() / 1000) + Number(order.positionDuration));

  const amount = (value: bigint | undefined) =>
    value === undefined ? DASH : `${formatGroupedAmount(value, base.decimals)} ${symbol}`;

  const dropPercent =
    figures?.room !== undefined && figures.positionValue !== undefined
      ? liquidationDropPercent(figures.room, figures.positionValue)
      : undefined;

  return (
    <div className="bg-tertiary-bg rounded-3 flex flex-col gap-3 px-5 pb-5 pt-4 mt-5">
      <h3 className="text-16 font-medium text-primary-text">{t("when_position_liquidated")}</h3>

      <div className="flex items-start justify-between gap-3 text-14">
        <span className="text-secondary-text">{t("liquidated_if_value_below")}</span>
        <span className="font-medium text-primary-text text-right">{amount(figures?.level)}</span>
      </div>
      <div className="flex items-start justify-between gap-3 text-14">
        <span className="text-secondary-text">{t("made_of")}</span>
        <span className="font-medium text-primary-text text-right">
          {figures && loanAmount !== undefined && maintenanceBps !== undefined
            ? t("made_of_value", {
                loan: formatGroupedAmount(loanAmount, base.decimals),
                interest: formatGroupedAmount(figures.interest, base.decimals),
                multiplier: formatMaintenanceMultiplier(maintenanceBps),
              })
            : DASH}
        </span>
      </div>
      <div className="flex items-start justify-between gap-3 text-14">
        <span className="text-secondary-text">{t("position_value_now")}</span>
        <span className="font-medium text-primary-text text-right">
          {amount(figures?.positionValue)}
        </span>
      </div>
      <div className="flex items-start justify-between gap-3 text-14">
        <span className="text-secondary-text">{t("room_before_liquidation")}</span>
        <span className="font-medium text-primary-text text-right">{amount(figures?.room)}</span>
      </div>

      <div className="rounded-2 bg-yellow-bg px-3 py-2 text-14 leading-5 text-yellow-light">
        {dropPercent === undefined
          ? DASH
          : dropPercent > 0
            ? t("liquidation_drop_hint", { percent: dropPercent })
            : t("liquidation_drop_hint_reached")}
      </div>

      <ul className="flex list-disc flex-col gap-1.5 pl-4 text-14 leading-5 text-secondary-text">
        <li>{t("liquidation_rule_stays", { symbol })}</li>
        <li>{t("liquidation_rule_repay", { deadline })}</li>
        <li>{t("liquidation_rule_collateral")}</li>
        <li>{t("liquidation_rule_frozen")}</li>
      </ul>

      <div className="[&>div]:w-full [&>div]:items-start [&_label]:whitespace-normal [&_label]:text-14 [&_label]:leading-5 [&_label]:text-primary-text">
        <Checkbox
          id="borrow-liquidation-risk"
          checked={acknowledged}
          handleChange={() => onAcknowledgedChange(!acknowledged)}
          label={t("liquidation_risk_acknowledge")}
        />
      </div>
    </div>
  );
}
