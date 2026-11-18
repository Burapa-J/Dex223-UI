import Image from "next/image";
import { useTranslations } from "next-intl";
import React, { useMemo } from "react";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";

import { OrderInfoCard } from "@/app/[locale]/margin-trading/components/widgets/OrderInfoBlock";
import { closedPositionLenderInterest } from "@/app/[locale]/margin-trading/helpers/liquidationMath";
import { MarginPosition } from "@/app/[locale]/margin-trading/types";
import Svg from "@/components/atoms/Svg";
import Button, { ButtonColor } from "@/components/buttons/Button";
import { formatFloat } from "@/functions/formatFloat";

export default function ClosedPositionInfoBlock({
  position,
  setIsWithdrawDialogOpened,
}: {
  position: MarginPosition;
  setIsWithdrawDialogOpened: (isOpen: boolean) => void;
}) {
  const t = useTranslations("Margin");
  const { address } = useAccount();
  // Lender's interest on a normally closed position; "-" for anyone else (see helper).
  const profitLabel = useMemo(() => {
    const interest = closedPositionLenderInterest(position, address);
    return interest === undefined
      ? "-"
      : `+${formatFloat(formatUnits(interest, position.loanAsset.decimals))} ${position.loanAsset.symbol ?? ""}`.trim();
  }, [address, position]);
  const isTokensToWithdraw = useMemo(() => {
    return position.assetsWithBalances.some((assetWithBalance) => {
      return !!assetWithBalance.balance && assetWithBalance.balance > BigInt(0);
    });
  }, [position.assetsWithBalances]);

  return (
    <div className="flex flex-col gap-5 px-4 sm:px-10 py-5 bg-primary-bg rounded-5">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Image
            width={40}
            height={40}
            src={position.loanAsset.logoURI || "/images/tokens/placeholder.svg"}
            alt=""
          />
          <span className="text-secondary-text text-18 font-bold">{position.loanAsset.name}</span>
          <div className="flex items-center gap-3 text-tertiary-text">
            {t("executed")}
            <Svg iconName="done" />
          </div>
        </div>
        {isTokensToWithdraw && (
          <Button
            colorScheme={ButtonColor.LIGHT_GREEN}
            onClick={() => setIsWithdrawDialogOpened(true)}
          >
            {t("withdraw")}
          </Button>
        )}
      </div>

      <div className="grid gap-3 grid-cols-3">
        <OrderInfoCard
          value={
            formatFloat(formatUnits(position.loanAmount, position.loanAsset.decimals)) +
            " " +
            position.loanAsset.symbol
          }
          title={t("borrowed")}
          tooltipText={t("borrowed_tooltip")}
          bg="borrowed"
        />
        <OrderInfoCard
          value={profitLabel}
          title={t("profit")}
          tooltipText={t("profit_tooltip")}
          bg="borrowed"
        />
        <OrderInfoCard
          value={formatFloat(position.initialLeverage, { trimZero: true })}
          title={t("initial_leverage")}
          tooltipText={t("initial_leverage_tooltip")}
          bg="borrowed"
        />
      </div>
    </div>
  );
}
