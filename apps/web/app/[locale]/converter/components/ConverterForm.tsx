"use client";

import Preloader from "@repo/ui/preloader";
import { useTranslations } from "next-intl";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount } from "wagmi";

import { useSwapEstimatedGas, useSwapStatus } from "@/app/[locale]/swap/hooks/useSwap";
import { useConfirmConvertDialogStore } from "@/app/[locale]/swap/stores/useConfirmConvertDialogOpened";
import { Field, useSwapAmountsStore } from "@/app/[locale]/swap/stores/useSwapAmountsStore";
import { useSwapTokensStore } from "@/app/[locale]/swap/stores/useSwapTokensStore";
import Button, { ButtonSize } from "@/components/buttons/Button";
import SwapButton from "@/components/buttons/SwapButton";
import TokenInput from "@/components/common/TokenInput";
import PickTokenDialog from "@/components/dialogs/PickTokenDialog";
import { useConnectWalletDialogStateStore } from "@/components/dialogs/stores/useConnectWalletStore";
import { formatFloat } from "@/functions/formatFloat";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import useTokenBalances from "@/hooks/useTokenBalances";
import { useTokens } from "@/hooks/useTokenLists";
import { Currency } from "@/sdk_bi/entities/currency";
import { Standard } from "@/sdk_bi/standard";
import { useGlobalBlockNumber } from "@/shared/hooks/useGlobalBlockNumber";

const ActionButtonSize = ButtonSize.EXTRA_LARGE;
const MobileActionButtonSize = ButtonSize.LARGE;

function ConvertActionButton({ isSufficientBalance }: { isSufficientBalance: boolean }) {
  const t = useTranslations("Converter");
  const { isConnected } = useAccount();
  const { tokenA, tokenB, tokenBStandard } = useSwapTokensStore();
  const { typedValue } = useSwapAmountsStore();
  const { setIsOpen: setConfirmConvertDialogOpen } = useConfirmConvertDialogStore();
  const { setIsOpened: setWalletConnectOpened } = useConnectWalletDialogStateStore();
  const { isLoadingSwap, isLoadingApprove, isPendingApprove, isPendingSwap } = useSwapStatus();

  if (!isConnected) {
    return (
      <Button
        onClick={() => setWalletConnectOpened(true)}
        fullWidth
        size={ActionButtonSize}
        mobileSize={MobileActionButtonSize}
      >
        {t("connect_wallet")}
      </Button>
    );
  }

  if (isLoadingSwap || isLoadingApprove || isPendingApprove || isPendingSwap) {
    return (
      <Button fullWidth isLoading size={ActionButtonSize} mobileSize={MobileActionButtonSize}>
        <span className="flex items-center gap-2">
          <span>{t("convert_button")}</span>
          <Preloader size={20} color="black" />
        </span>
      </Button>
    );
  }

  if (!tokenA || !tokenB) {
    return (
      <Button fullWidth disabled size={ActionButtonSize} mobileSize={MobileActionButtonSize}>
        {t("pick_token")}
      </Button>
    );
  }

  if (!+typedValue) {
    return (
      <Button fullWidth disabled size={ActionButtonSize} mobileSize={MobileActionButtonSize}>
        {t("convert_button")}
      </Button>
    );
  }

  if (!isSufficientBalance) {
    return (
      <Button fullWidth disabled size={ActionButtonSize} mobileSize={MobileActionButtonSize}>
        {t("insufficient_balance")}
      </Button>
    );
  }

  return (
    <Button
      size={ActionButtonSize}
      mobileSize={MobileActionButtonSize}
      fullWidth
      onClick={() => setConfirmConvertDialogOpen(true)}
    >
      {t("convert_button")} {tokenA.wrapped.symbol} → {tokenBStandard}
    </Button>
  );
}

export default function ConverterForm() {
  const t = useTranslations("Converter");
  const chainId = useCurrentChainId();
  const {
    tokenA,
    tokenB,
    setTokenA,
    setTokenB,
    tokenAStandard,
    tokenBStandard,
    setTokenAStandard,
    setTokenBStandard,
  } = useSwapTokensStore();
  const { setTypedValue, typedValue, reset: resetAmount } = useSwapAmountsStore();
  const [isOpenedTokenPick, setIsOpenedTokenPick] = useState(false);

  // Convert params do not need a trade route; keep gas store updated for the review dialog.
  useSwapEstimatedGas({ trade: null });

  const tokens = useTokens();
  const convertibleTokens = useMemo(() => tokens.filter((token) => !token.isNative), [tokens]);

  const {
    balance: { erc20Balance: tokenA0Balance, erc223Balance: tokenA1Balance },
    refetch: refetchABalance,
  } = useTokenBalances(tokenA);
  const {
    balance: { erc20Balance: tokenB0Balance, erc223Balance: tokenB1Balance },
    refetch: refetchBBalance,
  } = useTokenBalances(tokenB);

  const { blockNumber } = useGlobalBlockNumber();

  useEffect(() => {
    refetchABalance();
    refetchBBalance();
  }, [blockNumber, refetchABalance, refetchBBalance]);

  useEffect(() => {
    resetAmount();
  }, [chainId, resetAmount]);

  const handlePick = useCallback(
    (token: Currency) => {
      if (token.isNative) {
        setIsOpenedTokenPick(false);
        return;
      }

      setTokenA(token);
      setTokenB(token);
      setTokenAStandard(Standard.ERC20);
      setTokenBStandard(Standard.ERC223);
      setIsOpenedTokenPick(false);
    },
    [setTokenA, setTokenAStandard, setTokenB, setTokenBStandard],
  );

  const flipStandards = useCallback(() => {
    setTokenAStandard(tokenBStandard);
    setTokenBStandard(tokenAStandard);
  }, [setTokenAStandard, setTokenBStandard, tokenAStandard, tokenBStandard]);

  const isSufficientBalance =
    (tokenAStandard === Standard.ERC20 &&
      (tokenA0Balance && tokenA
        ? tokenA0Balance.value >= parseUnits(typedValue || "0", tokenA.decimals)
        : false)) ||
    (tokenAStandard === Standard.ERC223 &&
      (tokenA1Balance && tokenA
        ? tokenA1Balance.value >= parseUnits(typedValue || "0", tokenA.decimals)
        : false));

  return (
    <div className="card-spacing pt-2.5 surface rounded-5">
      <p className="text-14 text-tertiary-text mb-4">{t("no_fees")}</p>

      <TokenInput
        value={typedValue}
        onInputChange={(value) => setTypedValue({ typedValue: value, field: Field.CURRENCY_A })}
        handleClick={() => setIsOpenedTokenPick(true)}
        token={tokenA}
        balance0={
          tokenA0Balance && Boolean(tokenA0Balance.value)
            ? formatFloat(tokenA0Balance.formatted)
            : "0"
        }
        balance1={
          tokenA1Balance && Boolean(tokenA1Balance.value)
            ? formatFloat(tokenA1Balance.formatted)
            : "0"
        }
        setMax={
          (Boolean(tokenA0Balance?.value) && tokenAStandard === Standard.ERC20) ||
          (Boolean(tokenA1Balance?.value) && tokenAStandard === Standard.ERC223)
            ? () => {
                if (tokenA0Balance && tokenAStandard === Standard.ERC20) {
                  setTypedValue({
                    typedValue: tokenA0Balance.formatted,
                    field: Field.CURRENCY_A,
                  });
                }
                if (tokenA1Balance && tokenAStandard === Standard.ERC223) {
                  setTypedValue({
                    typedValue: tokenA1Balance.formatted,
                    field: Field.CURRENCY_A,
                  });
                }
              }
            : undefined
        }
        setHalf={
          (Boolean(tokenA0Balance?.value) && tokenAStandard === Standard.ERC20) ||
          (Boolean(tokenA1Balance?.value) && tokenAStandard === Standard.ERC223)
            ? () => {
                if (tokenA0Balance && tokenAStandard === Standard.ERC20) {
                  setTypedValue({
                    typedValue: formatUnits(
                      tokenA0Balance.value / BigInt(2),
                      tokenA0Balance.decimals,
                    ),
                    field: Field.CURRENCY_A,
                  });
                }
                if (tokenA1Balance && tokenAStandard === Standard.ERC223) {
                  setTypedValue({
                    typedValue: formatUnits(
                      tokenA1Balance.value / BigInt(2),
                      tokenA1Balance.decimals,
                    ),
                    field: Field.CURRENCY_A,
                  });
                }
              }
            : undefined
        }
        isHalf={
          (tokenAStandard === Standard.ERC20 &&
            tokenA0Balance &&
            typedValue !== "0" &&
            typedValue ===
              formatUnits(tokenA0Balance.value / BigInt(2), tokenA0Balance.decimals)) ||
          (tokenAStandard === Standard.ERC223 &&
            typedValue !== "0" &&
            tokenA1Balance &&
            typedValue === formatUnits(tokenA1Balance.value / BigInt(2), tokenA1Balance.decimals))
        }
        isMax={
          (tokenAStandard === Standard.ERC20 &&
            typedValue !== "0" &&
            tokenA0Balance &&
            typedValue === tokenA0Balance.formatted) ||
          (tokenAStandard === Standard.ERC223 &&
            typedValue !== "0" &&
            tokenA1Balance &&
            typedValue === tokenA1Balance.formatted)
        }
        label={t("you_pay")}
        standard={tokenAStandard}
        setStandard={(standard) => {
          setTokenAStandard(standard);
          setTokenBStandard(standard === Standard.ERC20 ? Standard.ERC223 : Standard.ERC20);
        }}
      />

      <div className="relative h-4 md:h-5 z-10">
        <SwapButton aria-label={t("flip_direction")} onClick={flipStandards} disabled={!tokenA} />
      </div>

      <TokenInput
        readOnly
        value={typedValue}
        onInputChange={() => null}
        handleClick={() => setIsOpenedTokenPick(true)}
        token={tokenB}
        balance0={
          tokenB0Balance && Boolean(tokenB0Balance.value)
            ? formatFloat(tokenB0Balance.formatted)
            : "0"
        }
        balance1={
          tokenB1Balance && Boolean(tokenB1Balance.value)
            ? formatFloat(tokenB1Balance.formatted)
            : "0"
        }
        label={t("you_receive")}
        standard={tokenBStandard}
        setStandard={(standard) => {
          setTokenBStandard(standard);
          setTokenAStandard(standard === Standard.ERC20 ? Standard.ERC223 : Standard.ERC20);
        }}
      />

      <div className="mt-5">
        <ConvertActionButton isSufficientBalance={Boolean(isSufficientBalance)} />
      </div>

      <PickTokenDialog
        handlePick={handlePick}
        isOpen={isOpenedTokenPick}
        setIsOpen={setIsOpenedTokenPick}
        availableTokens={convertibleTokens}
      />
    </div>
  );
}
