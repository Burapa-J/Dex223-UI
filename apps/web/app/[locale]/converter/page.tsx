"use client";

import { useTranslations } from "next-intl";
import React, { useEffect } from "react";

import ConverterForm from "@/app/[locale]/converter/components/ConverterForm";
import ConfirmConvertDialog from "@/app/[locale]/swap/components/ConfirmConvertDialog";
import { useSwapAmountsStore } from "@/app/[locale]/swap/stores/useSwapAmountsStore";
import { SwapStatus, useSwapStatusStore } from "@/app/[locale]/swap/stores/useSwapStatusStore";
import { useSwapTokensStore } from "@/app/[locale]/swap/stores/useSwapTokensStore";
import Container from "@/components/atoms/Container";
import { ThemeColors } from "@/config/theme/colors";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { ColorSchemeProvider } from "@/lib/color-scheme";

export default function ConverterPage() {
  const t = useTranslations("Converter");
  const chainId = useCurrentChainId();
  const { reset: resetTokens } = useSwapTokensStore();
  const { reset: resetAmount } = useSwapAmountsStore();
  const { setStatus: setSwapStatus } = useSwapStatusStore();

  useEffect(() => {
    resetTokens();
    resetAmount();
    setSwapStatus(SwapStatus.INITIAL);
  }, [chainId, resetAmount, resetTokens, setSwapStatus]);

  return (
    <ColorSchemeProvider value={ThemeColors.GREEN}>
      <Container>
        <div className="py-4 lg:py-[40px] flex justify-center">
          <div className="w-full sm:max-w-[600px] flex flex-col gap-4 md:gap-5">
            <header className="bg-primary-bg rounded-5 px-4 py-5 md:px-6 md:py-6">
              <h1 className="text-24 md:text-32 font-medium text-primary-text mb-2">
                {t("title")}
              </h1>
              <p className="text-14 md:text-16 text-secondary-text">{t("description")}</p>
            </header>

            <ConverterForm />
          </div>
        </div>

        <ConfirmConvertDialog />
      </Container>
    </ColorSchemeProvider>
  );
}
