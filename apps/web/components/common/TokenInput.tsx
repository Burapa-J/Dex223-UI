import Tooltip from "@repo/ui/tooltip";
import clsx from "clsx";
import Image from "next/image";
import { useTranslations } from "next-intl";
import React from "react";
import { NumericFormat } from "react-number-format";

import SelectButton from "@/components/atoms/SelectButton";
import Badge from "@/components/badges/Badge";
import InputButton from "@/components/buttons/InputButton";
import TokenStandardSelector from "@/components/common/TokenStandardSelector";
import { ThemeColors } from "@/config/theme/colors";
import { clsxMerge } from "@/functions/clsxMerge";
import { formatFloat } from "@/functions/formatFloat";
import { useUSDPrice } from "@/hooks/useUSDPrice";
import { Currency } from "@/sdk_bi/entities/currency";
import { Standard } from "@/sdk_bi/standard";

export default function TokenInput({
  handleClick,
  token,
  value,
  onInputChange,
  balance0,
  balance1,
  label,
  setStandard,
  standard,
  readOnly = false,
  readOnlyToken = false,
  isHalf = false,
  isMax = false,
  setHalf,
  setMax,
  gasERC20,
  gasERC223,
  colorScheme = ThemeColors.GREEN,
  isError,
  handleBlur,
  allowedErc223 = true,
}: {
  handleClick: () => void;
  token: Currency | undefined;
  value: string;
  onInputChange: (value: string) => void;
  balance0: string | undefined;
  balance1: string | undefined;
  label?: string;
  standard: Standard;
  setStandard: (standard: Standard) => void;
  readOnly?: boolean;
  readOnlyToken?: boolean;
  isHalf?: boolean;
  isMax?: boolean;
  setHalf?: () => void;
  setMax?: () => void;
  gasERC20?: string;
  gasERC223?: string;
  isError?: boolean;
  colorScheme?: ThemeColors;
  handleBlur?: () => void;
  allowedErc223?: boolean;
}) {
  const t = useTranslations("Swap");
  const tA11y = useTranslations("A11y");

  const { price, isLoading } = useUSDPrice(token?.wrapped.address0);

  return (
    <div className="p-3 sm:p-5 bg-secondary-bg rounded-3 relative min-w-0">
      {label && (
        <div className="flex justify-between items-center mb-5 h-[22px]">
          <span className="text-14 block text-secondary-text">{label}</span>
          {setMax && setHalf && (
            <div className="flex items-center gap-2">
              <InputButton
                colorScheme={colorScheme}
                onClick={setHalf}
                isActive={isHalf}
                text="Half"
              />
              <InputButton colorScheme={colorScheme} onClick={setMax} isActive={isMax} text="Max" />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-5 justify-between min-w-0">
        <div className="min-w-0 flex-[1_0_80px]">
          <NumericFormat
            allowedDecimalSeparators={[","]}
            decimalScale={token?.decimals}
            inputMode="decimal"
            placeholder="0"
            className={clsx(
              "h-12 bg-transparent outline-0 border-0 text-32 w-full peer placeholder:text-tertiary-text",
              readOnly && "pointer-events-none",
            )}
            type="text"
            // Name the field by its visible label ("You pay" / "You receive").
            aria-label={label || tA11y("amount")}
            // The computed output is not editable and is skipped in the tab order.
            readOnly={readOnly}
            tabIndex={readOnly ? -1 : undefined}
            value={value}
            onValueChange={(values, sourceInfo) => {
              // Calculated values arrive through props; only user edits should change the input side.
              if (sourceInfo.source === "event") {
                onInputChange(values.value);
              }
            }}
            allowNegative={false}
            onBlur={handleBlur}
          />
          <span className="text-12 block -mt-1 text-tertiary-text">
            ${price ? formatFloat(price * +value) : "0"}
          </span>
          <div
            className={clsxMerge(
              "duration-200 rounded-3 pointer-events-none absolute w-full h-full border border-transparent peer-hocus:shadow peer-focus:shadow top-0 left-0",
              colorScheme === ThemeColors.GREEN
                ? "peer-hocus:shadow-green/60 peer-focus:shadow-green/60 peer-focus:border-green"
                : "peer-hocus:shadow-purple/60 peer-focus:shadow-purple/60 peer-focus:border-purple",
              isError &&
                "shadow-red-light/60 border-red-light shadow peer-hocus:shadow-red-light/60 peer-focus:shadow peer-focus:shadow-red-light/60 peer-focus:border-red-light",
            )}
          />
        </div>
        <SelectButton
          type="button"
          className={clsx(
            "ml-auto min-w-0 max-w-full flex-shrink-0",
            readOnlyToken && "pointer-events-none",
          )}
          variant="rounded"
          onClick={handleClick}
          size="large"
          colorScheme={colorScheme}
        >
          {token ? (
            <span className="flex gap-2 items-center min-w-0">
              <Image
                className="flex-shrink-0"
                src={token?.logoURI || ""}
                alt="Ethereum"
                width={32}
                height={32}
              />
              <span className="min-w-0 max-w-[100px] md:max-w-[150px] overflow-ellipsis overflow-hidden whitespace-nowrap">
                {token.symbol}
              </span>
            </span>
          ) : (
            <span className="min-w-0 truncate text-tertiary-text pl-2">{t("select_token")}</span>
          )}
        </SelectButton>
      </div>

      {(!token || (token && token.isToken)) && (
        <TokenStandardSelector
          selectedStandard={standard}
          handleStandardSelect={(standard) => setStandard(standard)}
          disabled={!token || readOnlyToken}
          symbol={token?.symbol}
          balance0={balance0}
          balance1={balance1}
          gasERC20={gasERC20}
          gasERC223={gasERC223}
          colorScheme={colorScheme}
          allowedErc223={allowedErc223}
        />
      )}
      {token && token.isNative && (
        <div className="flex flex-col">
          <div
            className={clsxMerge(
              "*:z-10 flex flex-col gap-1 px-3 py-2.5  rounded-2 before:absolute before:rounded-3 before:w-full before:h-full before:left-0 before:top-0 before:duration-200 relative before:bg-gradient-to-r  before:to-green-bg/0 hocus:cursor-pointer text-12 group",
              colorScheme === ThemeColors.GREEN ? "before:from-green-bg" : "before:from-purple-bg",
              standard === Standard.ERC223 &&
                "before:rotate-180 items-end bg-gradient-to-l from-primary-bg to-secondary-bg",
              standard === Standard.ERC20 && "bg-gradient-to-r from-primary-bg to-secondary-bg",
              !token &&
                "before:opacity-0 hocus:before:opacity-0 before:cursor-default cursor-default",
            )}
          >
            <div className="flex items-center gap-1 cursor-default">
              <Badge color={colorScheme === ThemeColors.GREEN ? "green" : "purple"} text="Native" />
              <Tooltip
                iconSize={16}
                text="Native currency of the network you are using (e.g. ETH on Ethereum). On most networks gas fees are paid with native currency."
              />
            </div>

            <span className={clsx("block text-primary-text")}>
              {t("balance")}{" "}
              <span className="whitespace-nowrap">
                {balance1 || "0"} {token.symbol}
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
