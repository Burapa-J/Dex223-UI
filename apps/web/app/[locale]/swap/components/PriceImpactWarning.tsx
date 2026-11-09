import Alert from "@repo/ui/alert";
import Checkbox from "@repo/ui/checkbox";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { formatFloat } from "@/functions/formatFloat";
import { Trade } from "@/sdk_bi/entities/trade";

// Same thresholds most DEX interfaces use: warn from 5%, show an error from 15%.
const HIGH_PRICE_IMPACT = 5;
export const VERY_HIGH_PRICE_IMPACT = 15;

/** Price impact in percent, formatted like the "Price impact" row so both show the same number. */
function priceImpactOf(trade: Trade<any, any, any> | null | undefined): number | undefined {
  return trade ? +trade.priceImpact.toSignificant() : undefined;
}

export function isVeryHighPriceImpact(trade: Trade<any, any, any> | null | undefined): boolean {
  const impact = priceImpactOf(trade);
  return impact !== undefined && impact >= VERY_HIGH_PRICE_IMPACT;
}

export default function PriceImpactWarning({
  trade,
  slippage,
  className,
}: {
  trade: Trade<any, any, any> | null | undefined;
  /** Max slippage in percent. When given and price impact is above it, the alert explains the difference. */
  slippage?: number;
  className?: string;
}) {
  const t = useTranslations("Swap");

  const impact = priceImpactOf(trade);
  if (impact === undefined || impact < HIGH_PRICE_IMPACT) {
    return null;
  }

  const isVeryHigh = impact >= VERY_HIGH_PRICE_IMPACT;
  const formatted = formatFloat(trade!.priceImpact.toSignificant());
  let text = t(isVeryHigh ? "very_high_price_impact_warning" : "high_price_impact_warning", {
    impact: formatted,
  });
  if (slippage !== undefined && impact > slippage) {
    text += ` ${t("price_impact_above_slippage", { slippage: formatFloat(slippage) })}`;
  }

  return (
    <div className={className}>
      <Alert type={isVeryHigh ? "error" : "warning"} text={text} />
    </div>
  );
}

/**
 * Explicit acknowledgement required before confirming a trade with very high price impact. It resets
 * whenever the quote changes (amount, tokens or price), so an old tick never carries over.
 */
export function usePriceImpactAcknowledgement(trade: Trade<any, any, any> | null | undefined) {
  const required = isVeryHighPriceImpact(trade);
  const [acknowledged, setAcknowledged] = useState(false);

  const quoteKey = trade
    ? `${trade.inputAmount.currency.symbol}:${trade.inputAmount.quotient.toString()}>${trade.outputAmount.currency.symbol}:${trade.outputAmount.quotient.toString()}`
    : "";
  useEffect(() => {
    setAcknowledged(false);
  }, [quoteKey]);

  return { required, acknowledged, setAcknowledged };
}

export function PriceImpactAcknowledgement({
  id,
  trade,
  checked,
  onChange,
  className,
}: {
  id: string;
  trade: Trade<any, any, any> | null | undefined;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  const t = useTranslations("Swap");

  if (!trade || !isVeryHighPriceImpact(trade)) {
    return null;
  }

  return (
    <div className={className}>
      <Checkbox
        id={id}
        checked={checked}
        handleChange={() => onChange(!checked)}
        label={t("price_impact_acknowledge", {
          impact: formatFloat(trade.priceImpact.toSignificant()),
        })}
        labelClassName="text-primary-text"
      />
    </div>
  );
}
