import { useTranslations } from "next-intl";
import React from "react";
import { formatUnits } from "viem";

import { OrderInfoBlock } from "@/app/[locale]/margin-trading/components/widgets/OrderInfoBlock";
import { MarginPosition } from "@/app/[locale]/margin-trading/types";
import { formatFloat, formatLeverage } from "@/functions/formatFloat";

export default function ActivePositionParametersBlock({ position }: { position: MarginPosition }) {
  const t = useTranslations("Margin");

  return (
    <div className="rounded-5 gap-x-5 gap-y-4 bg-primary-bg px-4 sm:px-10 pt-4 pb-5 mb-5">
      <OrderInfoBlock
        title={t("step_parameters")}
        cards={[
          {
            title: t("borrowed"),
            tooltipText: t("borrowed_tooltip"),
            value: `${formatFloat(formatUnits(position.loanAmount, position.loanAsset.decimals))} ${position.loanAsset.symbol}`,
            bg: "borrowed",
          },
          {
            title: t("initial_collateral"),
            tooltipText: t("initial_collateral_tooltip"),
            value: `${formatFloat(formatUnits(position.collateralAmount, position.collateralAsset.decimals))} ${position.collateralAsset.symbol}`,
            bg: "collateral",
          },
          {
            title: t("leverage"),
            tooltipText: t("leverage_position_tooltip"),
            value: formatLeverage(position.initialLeverage),
            bg: "leverage",
          },
        ]}
      />
    </div>
  );
}
