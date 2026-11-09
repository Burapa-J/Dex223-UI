import Tooltip from "@repo/ui/tooltip";
import { useTranslations } from "next-intl";
import { ReactNode } from "react";

import usePositionUnfreeze from "@/app/[locale]/margin-trading/position/[id]/hooks/usePositionUnfreeze";
import { MarginPosition } from "@/app/[locale]/margin-trading/types";
import Button, { ButtonColor } from "@/components/buttons/Button";
import { Link } from "@/i18n/routing";

function HoverTooltip({ text, children }: { text?: string; children: ReactNode }) {
  if (!text) {
    return children;
  }

  return (
    <Tooltip
      text={text}
      renderTrigger={(ref, refProps) => (
        <span className="inline-flex" tabIndex={0} ref={ref.setReference} {...refProps}>
          {children}
        </span>
      )}
    />
  );
}

export default function FrozenPositionActions({
  position,
  isLiquidatable,
  isKnown,
  onTrade,
  onClose,
  onUnfrozen,
  tradeDisabled,
}: {
  position: MarginPosition;
  isLiquidatable: boolean;
  isKnown: boolean;
  onTrade: () => void;
  onClose: () => void;
  onUnfrozen: () => void | Promise<unknown>;
  tradeDisabled: boolean;
}) {
  const t = useTranslations("Margin");
  const { unfreeze, pending } = usePositionUnfreeze(position, onUnfrozen);
  const closeBlocked = !isKnown || isLiquidatable;
  const closeTooltip = isKnown && isLiquidatable ? t("frozen_close_tooltip") : undefined;

  return (
    <>
      <Button colorScheme={ButtonColor.LIGHT_GREEN} disabled={tradeDisabled} onClick={onTrade}>
        {t("trade")}
      </Button>
      <Link href={`/margin-trading/position/${position.id}/deposit`}>
        <Button colorScheme={ButtonColor.LIGHT_GREEN}>{t("deposit")}</Button>
      </Link>
      {isKnown && isLiquidatable && (
        <Link href={`/margin-trading/position/${position.id}/liquidate`}>
          <Button colorScheme={ButtonColor.RED}>{t("liquidate")}</Button>
        </Link>
      )}
      <HoverTooltip text={closeTooltip}>
        <Button disabled colorScheme={ButtonColor.LIGHT_GREEN}>
          {t("withdraw")}
        </Button>
      </HoverTooltip>
      {closeBlocked ? (
        <HoverTooltip text={closeTooltip}>
          <Button disabled colorScheme={ButtonColor.LIGHT_GREEN}>
            {t("close")}
          </Button>
        </HoverTooltip>
      ) : (
        <Button colorScheme={ButtonColor.LIGHT_GREEN} onClick={onClose}>
          {t("close")}
        </Button>
      )}
      {isKnown && !isLiquidatable && (
        <Button colorScheme={ButtonColor.LIGHT_GREEN} disabled={pending} onClick={() => unfreeze()}>
          {t("unfreeze")}
        </Button>
      )}
    </>
  );
}
