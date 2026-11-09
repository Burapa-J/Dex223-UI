import Alert from "@repo/ui/alert";
import { useTranslations } from "next-intl";
import React, { useEffect } from "react";

import {
  OraclePricingState,
  useOraclePricingCheck,
} from "@/app/[locale]/margin-trading/lending-order/create/hooks/useOraclePricingCheck";
import Svg from "@/components/atoms/Svg";
import Button, { ButtonColor, ButtonSize } from "@/components/buttons/Button";
import addToast from "@/other/toast";
import { Currency } from "@/sdk_bi/entities/currency";

const symbols = (tokens: Currency[]) => tokens.map((t) => t.symbol ?? "").join(", ");

export type OraclePricingStatus = {
  hasBlocking: boolean;
  /** Pricing state per token, keyed by lowercased ERC-20 address (OK tokens omitted). */
  flags: Map<string, OraclePricingState>;
};

/**
 * Step 2 of the lending order: one alert per oracle pricing state (Figma page 11, "New lending order:
 * oracle pricing check"). THIN offers Enable pricing per token; NO_POOL blocks Next (see hasBlocking).
 */
export default function OraclePricingAlerts({
  loanToken,
  tokens,
  onStatus,
}: {
  loanToken: Currency | undefined;
  tokens: Currency[];
  onStatus: (status: OraclePricingStatus) => void;
}) {
  const t = useTranslations("Margin");
  const check = useOraclePricingCheck(loanToken, tokens);

  const flagsKey = check.results.map((r) => `${r.token.wrapped.address0}:${r.state}`).join(",");
  useEffect(() => {
    const flags = new Map<string, OraclePricingState>();
    check.results.forEach((r) => {
      if (r.state !== OraclePricingState.OK)
        flags.set(r.token.wrapped.address0.toLowerCase(), r.state);
    });
    onStatus({ hasBlocking: check.hasBlocking, flags });
    // flagsKey captures every change of results
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagsKey]);

  if (!loanToken) return null;

  const loan = loanToken.symbol ?? "";
  const thin = check.results.filter((r) => r.state === OraclePricingState.THIN);
  const noPool = check.results.filter((r) => r.state === OraclePricingState.NO_POOL);
  const enabled = check.enabledTokens.filter(
    (token) => check.stateOf(token) === OraclePricingState.OK,
  );

  return (
    <>
      {noPool.length > 0 && (
        <Alert
          type="error"
          text={t("oracle_pricing_no_pool", {
            symbols: symbols(noPool.map((r) => r.token)),
            loan,
          })}
        />
      )}
      {thin.length > 0 && (
        <div className="flex flex-col gap-3">
          <Alert
            type="warning"
            text={t("oracle_pricing_thin", { symbols: symbols(thin.map((r) => r.token)), loan })}
          />
          <div className="flex flex-wrap items-center gap-3">
            {thin.map((result) => (
              <Button
                key={result.token.wrapped.address0}
                type="button"
                colorScheme={ButtonColor.LIGHT_PURPLE}
                size={ButtonSize.SMALL}
                isLoading={check.isEnabling(result.token)}
                disabled={check.isEnabling(result.token)}
                onClick={async () => {
                  const outcome = await check.enablePricing(result);
                  if (outcome === "failed") addToast(t("oracle_pricing_enable_failed"), "error");
                }}
              >
                {t("oracle_pricing_enable", { symbol: result.token.symbol ?? "" })}
              </Button>
            ))}
            <span className="text-12 text-tertiary-text">{t("oracle_pricing_enable_hint")}</span>
          </div>
        </div>
      )}
      {enabled.length > 0 && (
        <Alert type="success" text={t("oracle_pricing_enabled", { symbols: symbols(enabled) })} />
      )}
    </>
  );
}

/** Marker on a token chip whose pricing state needs attention (none for OK). */
export function OraclePricingChipMarker({ state }: { state: OraclePricingState | undefined }) {
  if (state === undefined || state === OraclePricingState.OK) return null;
  return (
    <Svg
      iconName="warning"
      size={16}
      className={state === OraclePricingState.NO_POOL ? "text-red-light" : "text-yellow-light"}
    />
  );
}

export function oraclePricingChipBorder(state: OraclePricingState | undefined): string {
  if (state === OraclePricingState.NO_POOL) return "border-red-light";
  if (state === OraclePricingState.THIN) return "border-yellow-light";
  return "border-primary-border";
}
