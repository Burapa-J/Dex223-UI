"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import React from "react";

import SelectButton from "@/components/atoms/SelectButton";
import Svg from "@/components/atoms/Svg";
import Button from "@/components/buttons/Button";
import InputButton from "@/components/buttons/InputButton";
import SwapButton from "@/components/buttons/SwapButton";
import TokenStandardSelector from "@/components/common/TokenStandardSelector";
import { IconName } from "@/config/types/IconName";
import { Link } from "@/i18n/routing";
import { Standard } from "@/sdk_bi/standard";

const noop = () => {};

// React 18's types don't know `inert` yet; it keeps the copy out of the tab order and away
// from screen readers, so the one link over the card is the only thing users interact with.
const INERT = { inert: "" } as unknown as React.HTMLAttributes<HTMLDivElement>;

/** Same markup as TokenInput on /swap, with fixed values and no price or balance lookups. */
function PreviewTokenInput({
  label,
  symbol,
  logo,
  standard,
}: {
  label: string;
  symbol: string;
  logo: string;
  standard: Standard;
}) {
  return (
    <div className="p-5 bg-secondary-bg rounded-3 relative">
      <div className="flex justify-between items-center mb-5 h-[22px]">
        <span className="text-14 block text-secondary-text">{label}</span>
        <div className="flex items-center gap-2">
          <InputButton onClick={noop} isActive={false} text="Half" />
          <InputButton onClick={noop} isActive={false} text="Max" />
        </div>
      </div>

      <div className="flex items-center mb-5 justify-between">
        <div>
          <span className="h-12 flex items-center text-32 text-tertiary-text">0</span>
          <span className="text-12 block -mt-1 text-tertiary-text">$0</span>
        </div>
        <SelectButton
          type="button"
          className="flex-shrink-0"
          variant="rounded"
          onClick={noop}
          size="large"
        >
          <span className="flex gap-2 items-center">
            <Image className="flex-shrink-0" src={logo} alt="" width={32} height={32} />
            <span>{symbol}</span>
          </span>
        </SelectButton>
      </div>

      <TokenStandardSelector
        compact
        selectedStandard={standard}
        handleStandardSelect={noop}
        symbol={symbol}
        balance0="0"
        balance1="0"
        gasERC20="—"
        gasERC223="—"
      />
    </div>
  );
}

const HEADER_ICONS: IconName[] = ["recent-transactions", "gas-edit", "settings"];

/**
 * The landing hero's swap card: a static copy of the real /swap card (not connected), so the
 * preview matches what people get after clicking. Built from the same components as the
 * swap form, rendered inert, with one link over it to /swap.
 */
export default function LandingSwapPreview() {
  const t = useTranslations("Swap");
  const tLanding = useTranslations("Landing");
  const tWallet = useTranslations("Wallet");

  return (
    <div className="relative group">
      <div
        {...INERT}
        aria-hidden
        className="card-spacing pt-2.5 surface rounded-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
      >
        <div className="flex justify-between items-center mb-2.5">
          <span className="font-bold text-20">{t("swap")}</span>
          <div className="flex items-center relative left-3">
            {HEADER_ICONS.map((icon) => (
              <span
                key={icon}
                className="w-12 h-12 flex items-center justify-center text-tertiary-text"
              >
                <Svg iconName={icon} />
              </span>
            ))}
          </div>
        </div>
        <PreviewTokenInput
          label={t("you_pay")}
          symbol="USDT"
          logo="/images/tokens/USDT.svg"
          standard={Standard.ERC20}
        />
        <div className="relative h-4 md:h-5 z-10">
          <SwapButton onClick={noop} />
        </div>
        <PreviewTokenInput
          label={t("you_receive")}
          symbol="D223"
          logo="/images/tokens/DEX.svg"
          standard={Standard.ERC223}
        />
        <div className="h-4 md:h-5" />
        <Button fullWidth>{tWallet("connect_wallet")}</Button>
      </div>
      <Link
        href="/swap"
        aria-label={tLanding("preview.aria")}
        className="absolute inset-0 rounded-5 border border-transparent group-hover:border-green-bg focus-visible:border-green duration-200"
      />
    </div>
  );
}
