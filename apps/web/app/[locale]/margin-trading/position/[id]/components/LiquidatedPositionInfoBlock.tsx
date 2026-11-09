import Image from "next/image";
import { useTranslations } from "next-intl";
import React from "react";
import { formatUnits } from "viem";

import { OrderInfoCard } from "@/app/[locale]/margin-trading/components/widgets/OrderInfoBlock";
import timestampToDateString from "@/app/[locale]/margin-trading/helpers/timestampToDateString";
import { MarginPosition } from "@/app/[locale]/margin-trading/types";
import Svg from "@/components/atoms/Svg";
import { formatFloat } from "@/functions/formatFloat";

export default function LiquidatedPositionInfoBlock({ position }: { position: MarginPosition }) {
  const t = useTranslations("Margin");

  return (
    <div className="flex flex-col gap-5 px-4 sm:px-10 py-5 bg-primary-bg rounded-5">
      <div className="flex items-center gap-2">
        <Image width={32} height={32} src="/images/tokens/placeholder.svg" alt="" />
        <span className="text-secondary-text text-18 font-bold">{position.loanAsset.name}</span>
        <div className="flex items-center gap-3 text-tertiary-text">
          {t("liquidated")}
          <Svg iconName="liquidated" />
        </div>
      </div>

      <div className="grid gap-3 grid-cols-4">
        <OrderInfoCard
          value={formatFloat(formatUnits(position.loanAmount, position.loanAsset.decimals))}
          title={t("borrowed")}
          tooltipText={t("borrowed_tooltip")}
          bg="borrowed"
        />
        <OrderInfoCard
          value={100}
          title={t("initial_collateral")}
          tooltipText={t("initial_collateral_tooltip")}
          bg="collateral"
        />
        <OrderInfoCard
          value={timestampToDateString(position.liquidatedAt, { withUTC: false })}
          title={t("liquidation_date")}
          tooltipText={t("liquidation_date_tooltip")}
          bg="leverage"
        />
        <OrderInfoCard
          value={formatFloat(position.initialLeverage, { trimZero: true })}
          title={t("initial_leverage")}
          tooltipText={t("initial_leverage_tooltip")}
          bg="leverage"
        />
      </div>
    </div>
  );
}
