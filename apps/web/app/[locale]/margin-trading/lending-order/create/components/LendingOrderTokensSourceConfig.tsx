import Checkbox from "@repo/ui/checkbox";
import clsx from "clsx";
import Image from "next/image";
import { useTranslations } from "next-intl";
import React from "react";

import {
  oraclePricingChipBorder,
  OraclePricingChipMarker,
} from "@/app/[locale]/margin-trading/lending-order/create/components/OraclePricingAlerts";
import { OraclePricingState } from "@/app/[locale]/margin-trading/lending-order/create/hooks/useOraclePricingCheck";
import {
  LendingOrderTradingTokens,
  TradingTokensInputMode,
} from "@/app/[locale]/margin-trading/lending-order/create/steps/types";
import {
  useAllowedTokenListsDialogOpenedStore,
  useAllowedTokensDialogOpenedStore,
} from "@/app/[locale]/margin-trading/stores/dialogStates";
import { InputSize } from "@/components/atoms/Input";
import { HelperText, InputLabel } from "@/components/atoms/TextField";
import IconButton from "@/components/buttons/IconButton";
import RadioButton from "@/components/buttons/RadioButton";

export default function LendingOrderTokensSourceConfig({
  values,
  setValues,
  manualError,
  autoListingError,
  pricingFlags,
}: {
  pricingFlags?: Map<string, OraclePricingState>;
  values: LendingOrderTradingTokens;
  setValues: (values: LendingOrderTradingTokens) => void;
  manualError?: string;
  autoListingError?: string;
}) {
  const { setIsOpen: setAllowedListingsOpened } = useAllowedTokenListsDialogOpenedStore();
  const { setIsOpen: setAllowedTokensDialogOpened } = useAllowedTokensDialogOpenedStore();
  const t = useTranslations("Margin");

  return (
    <div className="bg-tertiary-bg rounded-3 py-4 px-5 mb-4">
      <InputLabel inputSize={InputSize.LARGE} label={t("token_source_type")} />
      <div className="grid grid-cols-2 gap-2 mb-4 mt-1">
        {[TradingTokensInputMode.MANUAL, TradingTokensInputMode.AUTOLISTING].map((_source) => {
          return (
            <RadioButton
              type="button"
              key={_source}
              isActive={values.inputMode === _source}
              onClick={() => {
                setValues({ ...values, inputMode: _source });
              }}
            >
              {_source === TradingTokensInputMode.MANUAL
                ? t("source_tokens")
                : t("listing_contract")}
            </RadioButton>
          );
        })}
      </div>

      {values.inputMode === TradingTokensInputMode.MANUAL && (
        <>
          <div className="flex justify-between items-center">
            <InputLabel
              inputSize={InputSize.LARGE}
              label={t("tokens_allowed_trading")}
              tooltipText={t("tokens_allowed_tooltip")}
              noMargin
            />
            <IconButton
              onClick={() => setAllowedTokensDialogOpened(true)}
              buttonSize={32}
              iconSize={20}
              iconName={"edit"}
            />
          </div>
          <div>
            <div
              className={clsx(
                "bg-quaternary-bg rounded-3 min-h-[132px] p-2 items-start flex flex-wrap gap-1 content-start",
                manualError && "border border-red-light",
              )}
            >
              {values.allowedTokens.map((currency) => {
                return (
                  <div
                    key={
                      currency.isToken ? currency.address0 : `native-${currency.wrapped.address0}`
                    }
                    className={clsx(
                      "border pl-1 py-1 pr-3 flex items-center gap-2 rounded-2",
                      oraclePricingChipBorder(
                        pricingFlags?.get(currency.wrapped.address0.toLowerCase()),
                      ),
                    )}
                  >
                    <Image
                      className="flex-shrink-0"
                      width={24}
                      height={24}
                      src={currency.logoURI || "/images/tokens/placeholder.svg"}
                      alt={""}
                    />
                    <span>{currency.name}</span>
                    <OraclePricingChipMarker
                      state={pricingFlags?.get(currency.wrapped.address0.toLowerCase())}
                    />
                  </div>
                );
              })}
            </div>

            <HelperText error={manualError} />
          </div>

          <div className="py-2">
            <Checkbox
              label={t("allow_erc223_trading")}
              tooltipText={t("allow_erc223_tooltip")}
              labelClassName="text-secondary-text"
              checked={values.includeERC223Trading}
              handleChange={() =>
                setValues({ ...values, includeERC223Trading: !values.includeERC223Trading })
              }
              id={"allow-223-trading"}
            />
          </div>
        </>
      )}

      {values.inputMode === TradingTokensInputMode.AUTOLISTING && (
        <>
          <div className="flex justify-between items-center">
            <InputLabel
              inputSize={InputSize.LARGE}
              label={t("tokens_allowed_trading")}
              tooltipText={t("tokens_allowed_tooltip")}
              noMargin
            />
            <IconButton
              buttonSize={32}
              iconSize={20}
              iconName={"edit"}
              onClick={() => {
                setAllowedListingsOpened(true);
              }}
            />
          </div>
          <div
            className={clsx(
              "bg-quaternary-bg rounded-3 min-h-[132px] p-2 items-start flex flex-wrap gap-1",
              autoListingError && "border border-red-light",
            )}
          >
            {values.tradingTokensAutoListing && (
              <div className="pb-1.5 pt-0.5 px-4 rounded-2.5 bg-primary-bg">
                <p>{values.tradingTokensAutoListing.name}</p>
                <p className="text-12 text-tertiary-text">
                  {t("listing_tokens_count", {
                    count: values.tradingTokensAutoListing.totalTokens,
                  })}
                </p>
              </div>
            )}
          </div>
          <HelperText error={autoListingError} />
        </>
      )}
    </div>
  );
}
