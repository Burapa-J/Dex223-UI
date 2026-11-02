import Tooltip from "@repo/ui/tooltip";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import React, { useMemo } from "react";

import Badge, { BadgeVariant } from "@/components/badges/Badge";
import { ThemeColors } from "@/config/theme/colors";
import { clsxMerge } from "@/functions/clsxMerge";
import { Standard } from "@/sdk_bi/standard";

function StandardOption({
  balance,
  symbol,
  standard,
  active,
  gas,
  disabled,
  handleStandardSelect,
  colorScheme = ThemeColors.GREEN,
}: {
  balance: string | undefined;
  symbol: string | undefined;
  standard: Standard;
  active: Standard;
  handleStandardSelect: (standard: Standard) => void;
  gas?: string;
  disabled?: boolean;
  colorScheme?: ThemeColors;
}) {
  const t = useTranslations("Swap");
  const isActive = useMemo(() => {
    return active === standard;
  }, [active, standard]);

  const gradientColorMap = {
    [ThemeColors.GREEN]: "before:from-green-bg before:to-green-bg/0",
    [ThemeColors.PURPLE]: "before:from-purple-bg before:to-purple-bg/0",
  };

  return (
    <div className="flex flex-col min-w-0">
      <button
        type="button"
        onClick={() => handleStandardSelect(standard)}
        className={clsxMerge(
          "*:z-10 flex flex-col gap-1 px-3 pt-10 pb-2.5 @[480px]:py-2.5 rounded-2 before:absolute before:rounded-3 before:w-full before:h-full before:left-0 before:top-0 before:duration-200 relative before:bg-gradient-to-r hocus:cursor-pointer text-12 group",
          gradientColorMap[colorScheme],
          isActive ? "before:opacity-100" : "before:opacity-0 hocus:before:opacity-100",
          standard === Standard.ERC223 &&
            "before:rotate-180 items-end bg-gradient-to-l from-primary-bg to-secondary-bg",
          standard === Standard.ERC20 && "bg-gradient-to-r from-primary-bg to-secondary-bg",
          disabled &&
            "before:opacity-0 hocus:before:opacity-0 before:cursor-default cursor-default pointer-events-none",
          gas &&
            standard === Standard.ERC20 &&
            "@[480px]:rounded-b-0 @[480px]:before:rounded-b-0",
          gas &&
            standard === Standard.ERC223 &&
            "@[480px]:rounded-b-0 @[480px]:before:rounded-t-0",
        )}
      >
        <div className="hidden @[480px]:flex items-center gap-1 cursor-default">
          <span
            className={clsxMerge(
              "text-12 text-secondary-text",
              (disabled || standard !== active) && "text-tertiary-text",
            )}
          >
            {t("standard")}
          </span>
          <Badge
            size="small"
            variant={BadgeVariant.STANDARD}
            standard={standard}
            color={colorScheme === ThemeColors.GREEN ? "green" : "purple"}
          />

          <Tooltip
            iconSize={16}
            text={standard === Standard.ERC20 ? t("erc20_tooltip") : t("erc223_tooltip")}
          />
        </div>
        {disabled ? (
          <div
            className={clsx(
              "text-tertiary-text cursor-default",
              standard === Standard.ERC223 ? "text-right" : "text-left",
            )}
          >
            —
          </div>
        ) : (
          <span
            className={clsx(
              "w-full @[480px]:w-[calc(100%-55px)] table table-fixed",
              standard === active ? "text-secondary-text" : "text-tertiary-text",
            )}
          >
            <span
              className={clsx(
                "flex flex-col text-12 whitespace-nowrap overflow-ellipsis overflow-hidden @[480px]:table-cell",
                standard === active ? "text-primary-text" : "text-tertiary-text",
                standard === Standard.ERC223 ? "text-right" : "text-left",
              )}
            >
              <span className={standard === active ? "text-secondary-text" : "text-tertiary-text"}>
                {t("balance")}
              </span>{" "}
              {balance || "0"} {symbol}
            </span>
          </span>
        )}
      </button>
      {gas && (
        <div
          className={clsx(
            "py-1 px-3 text-12 bg-swap-gas-gradient hidden @[480px]:flex items-center text-tertiary-text w-fit",
            standard === Standard.ERC20 &&
              "bg-gradient-to-r from-primary-bg to-secondary-bg rounded-bl-2",
            standard === Standard.ERC223 &&
              "bg-gradient-to-l from-primary-bg to-secondary-bg rounded-br-2 justify-end ml-auto",
          )}
        >
          {gas}
        </div>
      )}
    </div>
  );
}

export function StandardButton({
  selectedStandard,
  handleStandardSelect,
  disabled,
  standard,
  colorScheme = ThemeColors.GREEN,
}: {
  standard: Standard;
  handleStandardSelect: (standard: Standard) => void;
  disabled?: boolean;
  selectedStandard: Standard;
  colorScheme?: ThemeColors;
}) {
  const activeColorMap: Record<ThemeColors, string> = {
    [ThemeColors.GREEN]: "bg-green text-black shadow shadow-green/60",
    [ThemeColors.PURPLE]: "bg-purple text-black shadow shadow-purple/60",
  };

  const inactiveColorMap: Record<ThemeColors, string> = {
    [ThemeColors.GREEN]: "hocus:bg-green-bg hocus:text-primary-text",
    [ThemeColors.PURPLE]: "hocus:bg-purple-bg hocus:text-primary-text",
  };

  return (
    <button
      type="button"
      className={clsxMerge(
        "h-6 rounded-3 duration-200 flex items-center justify-center gap-1 px-2 min-w-[58px] w-auto whitespace-nowrap text-secondary-text",
        selectedStandard === standard ? activeColorMap[colorScheme] : inactiveColorMap[colorScheme],
        disabled && standard === Standard.ERC20 && "bg-primary-bg shadow-none",
        disabled && "text-tertiary-text pointer-events-none",
      )}
      onClick={() => handleStandardSelect(standard)}
    >
      {standard}
    </button>
  );
}

export default function TokenStandardSelector({
  selectedStandard,
  handleStandardSelect,
  disabled,
  symbol,
  balance0,
  balance1,
  gasERC20,
  gasERC223,
  colorScheme = ThemeColors.GREEN,
  allowedErc223 = true,
}: {
  selectedStandard: Standard;
  handleStandardSelect: (standard: Standard) => void;
  disabled?: boolean;
  symbol?: string;
  balance0?: string;
  balance1?: string;
  gasERC20?: string;
  gasERC223?: string;
  colorScheme?: ThemeColors;
  allowedErc223?: boolean;
}) {
  // Follow this control's width, not the window. Above ~1280px the swap+chart
  // layout pins the form at 480/540px, so viewport `md:` (and a 340px container
  // query) still paint the wide layout and the toggle covers the labels. 480px
  // stays above the home preview and swap+chart form, under the full 600px forms.
  return (
    <div className="@container min-w-0 w-full">
      <div className="gap-1 @[480px]:gap-3 relative @[480px]:pb-2 grid grid-cols-2">
        <StandardOption
          active={selectedStandard}
          standard={Standard.ERC20}
          symbol={symbol}
          balance={balance0}
          gas={gasERC20}
          handleStandardSelect={handleStandardSelect}
          disabled={disabled}
          colorScheme={colorScheme}
        />
        <div
          className={clsxMerge(
            "mx-auto z-10 text-10 w-auto h-[32px] top-1 left-1/2 -translate-x-1/2 rounded-20 border p-1 flex gap-1 items-center absolute @[480px]:top-[14px]",
            colorScheme === ThemeColors.GREEN ? "border-green" : "border-purple",
            disabled && "border-secondary-border",
          )}
        >
          {[Standard.ERC20, Standard.ERC223].map((standard) => {
            return (
              <StandardButton
                colorScheme={colorScheme}
                key={standard}
                handleStandardSelect={handleStandardSelect}
                standard={standard}
                selectedStandard={selectedStandard}
                disabled={disabled || (standard === Standard.ERC223 && !allowedErc223)}
              />
            );
          })}
        </div>
        <StandardOption
          active={selectedStandard}
          standard={Standard.ERC223}
          symbol={symbol}
          balance={balance1}
          gas={gasERC223}
          disabled={disabled || !allowedErc223}
          handleStandardSelect={handleStandardSelect}
          colorScheme={colorScheme}
        />
      </div>
    </div>
  );
}
