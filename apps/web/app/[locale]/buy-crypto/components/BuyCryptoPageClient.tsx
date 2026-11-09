"use client";

import clsx from "clsx";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { useAccount } from "wagmi";

import Container from "@/components/atoms/Container";
import Button, { ButtonColor, ButtonSize, ButtonVariant } from "@/components/buttons/Button";
import { ThemeColors } from "@/config/theme/colors";
import { Link } from "@/i18n/routing";
import { ColorSchemeProvider } from "@/lib/color-scheme";

import BuyOnramp from "./BuyOnramp";
import { BUY_ASSETS, OnrampAsset, OnrampAssetId, OnrampFlow } from "./onrampAssets";

const FLOWS: OnrampFlow[] = ["buy", "sell"];

export default function BuyCryptoPageClient() {
  const t = useTranslations("BuyCrypto");
  const { address } = useAccount();
  const [flow, setFlow] = useState<OnrampFlow>("buy");
  const [assetId, setAssetId] = useState<OnrampAssetId>("d223");
  const [completedSymbol, setCompletedSymbol] = useState<string | null>(null);

  const appId = Number(process.env.NEXT_PUBLIC_ONRAMP_APP_ID);
  const selectedAsset = useMemo(
    () => BUY_ASSETS.find((asset) => asset.id === assetId) || BUY_ASSETS[0],
    [assetId],
  );

  const handleCompleted = useCallback(
    (payload: { coinCode?: string }) => {
      const symbol =
        payload.coinCode?.toUpperCase() ||
        (selectedAsset.coinCode ? selectedAsset.symbol : t("any_token"));
      setCompletedSymbol(symbol);
    },
    [selectedAsset.coinCode, selectedAsset.symbol, t],
  );

  const selectAsset = (asset: OnrampAsset) => {
    setAssetId(asset.id);
    setCompletedSymbol(null);
  };

  // Switching tabs clears completedSymbol, so the success card always matches the current flow.
  const isSell = flow === "sell";
  const steps = isSell
    ? [t("step_sell_send"), t("step_sell_fiat"), t("step_sell_use")]
    : [t("step_buy"), t("step_receive"), t("step_use")];

  return (
    <ColorSchemeProvider value={ThemeColors.PURPLE}>
      <Container>
        <div className="py-4 lg:py-[40px] flex justify-center">
          <div className="w-full max-w-[640px] flex flex-col gap-4 md:gap-5">
            <header className="bg-primary-bg rounded-5 px-4 py-5 md:px-6 md:py-6">
              <p className="text-12 uppercase tracking-[0.08em] text-purple mb-2">
                {t("powered_by_onramp")}
              </p>
              <h1 className="text-24 md:text-32 font-medium text-primary-text mb-2">
                {t("title")}
              </h1>
              <p className="text-14 md:text-16 text-secondary-text">{t("description")}</p>
            </header>

            <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {steps.map((label, index) => (
                <li
                  key={label}
                  className="bg-primary-bg rounded-3 px-4 py-3 flex items-start gap-3 border border-transparent"
                >
                  <span className="text-12 font-medium text-purple mt-0.5">{index + 1}</span>
                  <span className="text-14 text-primary-text">{label}</span>
                </li>
              ))}
            </ol>

            <section className="bg-primary-bg rounded-5 p-4 md:p-6 flex flex-col gap-5">
              <div className="w-full flex bg-secondary-bg p-1 gap-1 rounded-3">
                {FLOWS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setFlow(item);
                      setCompletedSymbol(null);
                    }}
                    className={clsx(
                      "w-full h-10 lg:h-12 rounded-2 text-14 lg:text-16 border duration-200",
                      flow === item
                        ? "text-primary-text border-purple bg-purple-bg pointer-events-none"
                        : "text-secondary-text border-transparent hocus:bg-purple-bg hocus:text-primary-text",
                    )}
                  >
                    {t(`flow_${item}`)}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-16 md:text-18 font-medium">
                    {t(isSell ? "choose_asset_sell" : "choose_asset")}
                  </h2>
                  <span className="text-12 text-secondary-text">{t("choose_asset_hint")}</span>
                </div>

                <button
                  type="button"
                  onClick={() => selectAsset(BUY_ASSETS[0])}
                  className={clsx(
                    "w-full text-left rounded-4 border px-4 py-4 duration-200",
                    assetId === "d223"
                      ? "border-purple bg-purple-bg shadow shadow-purple/40"
                      : "border-transparent bg-secondary-bg hocus:bg-purple-bg",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Image
                      src="/images/tokens/DEX.svg"
                      alt=""
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-18 font-medium">D223</span>
                        <span className="text-12 px-2 py-0.5 rounded-20 bg-primary-bg text-purple">
                          {t("badge_erc223")}
                        </span>
                        <span className="text-12 px-2 py-0.5 rounded-20 bg-primary-bg text-secondary-text">
                          {t("badge_featured")}
                        </span>
                      </div>
                      <p className="text-14 text-secondary-text mt-1">
                        {t(isSell ? "d223_sell_blurb" : "d223_blurb")}
                      </p>
                    </div>
                  </div>
                </button>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {BUY_ASSETS.slice(1).map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => selectAsset(asset)}
                      className={clsx(
                        "rounded-3 border px-3 py-3 flex flex-col items-center gap-2 duration-200",
                        assetId === asset.id
                          ? "border-purple bg-purple-bg"
                          : "border-transparent bg-secondary-bg hocus:bg-purple-bg",
                      )}
                    >
                      {asset.logoURI ? (
                        <Image src={asset.logoURI} alt="" width={28} height={28} />
                      ) : (
                        <span className="w-7 h-7 rounded-full bg-primary-bg flex items-center justify-center text-12 text-secondary-text">
                          +
                        </span>
                      )}
                      <span className="text-14 font-medium">{asset.symbol}</span>
                      <span className="text-12 text-secondary-text text-center leading-tight">
                        {asset.id === "any" ? t("any_token_short") : asset.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {isSell && (
                <div className="bg-secondary-bg rounded-3 px-4 py-3 text-14 text-secondary-text">
                  {t(selectedAsset.coinCode ? "sell_hint" : "sell_hint_any")}
                </div>
              )}

              {address && (
                <div className="bg-secondary-bg rounded-3 px-4 py-3 text-12 text-secondary-text break-all">
                  {t(isSell ? "sending_wallet" : "receiving_wallet")}:{" "}
                  <span className="text-primary-text font-medium">{address}</span>
                </div>
              )}

              <BuyOnramp
                appId={appId}
                flow={flow}
                asset={selectedAsset}
                onCompleted={handleCompleted}
              />
            </section>

            {completedSymbol && (
              <section className="bg-primary-bg rounded-5 p-4 md:p-6 border border-purple">
                <h2 className="text-18 font-medium mb-1">
                  {t(isSell ? "success_sell_title" : "success_title")}
                </h2>
                <p className="text-14 text-secondary-text mb-4">
                  {t(isSell ? "success_sell_body" : "success_body", {
                    symbol: completedSymbol,
                  })}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Link href="/swap" className="w-full">
                    <Button fullWidth colorScheme={ButtonColor.PURPLE} size={ButtonSize.LARGE}>
                      {t("cta_trade")}
                    </Button>
                  </Link>
                  <Link href="/pools" className="w-full">
                    <Button
                      fullWidth
                      colorScheme={ButtonColor.PURPLE}
                      variant={ButtonVariant.OUTLINED}
                      size={ButtonSize.LARGE}
                    >
                      {t("cta_pools")}
                    </Button>
                  </Link>
                </div>
              </section>
            )}

            <section className="bg-primary-bg rounded-5 p-4 md:p-6">
              <h2 className="text-16 md:text-18 font-medium mb-3">
                {t(isSell ? "after_sell_title" : "after_title")}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                  href="/swap"
                  className="rounded-3 bg-secondary-bg px-4 py-4 hocus:bg-purple-bg duration-200"
                >
                  <div className="text-16 font-medium mb-1">{t("cta_trade")}</div>
                  <p className="text-14 text-secondary-text">{t("after_trade_body")}</p>
                </Link>
                <Link
                  href="/add"
                  className="rounded-3 bg-secondary-bg px-4 py-4 hocus:bg-purple-bg duration-200"
                >
                  <div className="text-16 font-medium mb-1">{t("cta_add_liquidity")}</div>
                  <p className="text-14 text-secondary-text">{t("after_pool_body")}</p>
                </Link>
              </div>
            </section>

            <p className="text-12 text-secondary-text text-center px-2">
              {t("disclaimer")}{" "}
              <a
                href="https://onramp.money"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple hocus:text-purple-hover duration-200"
              >
                onramp.money
              </a>
            </p>
          </div>
        </div>
      </Container>
    </ColorSchemeProvider>
  );
}
