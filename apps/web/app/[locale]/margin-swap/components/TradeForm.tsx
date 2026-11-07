import Preloader from "@repo/ui/preloader";
import Tooltip from "@repo/ui/tooltip";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useMediaQuery } from "react-responsive";
import { formatEther, formatGwei, formatUnits, parseUnits } from "viem";
import { useAccount } from "wagmi";

import ConfirmMarginSwapDialog from "@/app/[locale]/margin-swap/components/ConfirmMarginSwapDialog";
import {
  getPositionAllowedOutputAssets,
  getPositionAllowedOutputStandard,
  getPositionHeldStandard,
} from "@/app/[locale]/margin-swap/hooks/useOpenMarginSwapForPosition";
import { useMarginSwapAmountsStore } from "@/app/[locale]/margin-swap/stores/useMarginSwapAmountsStore";
import { useMarginSwapPositionStore } from "@/app/[locale]/margin-swap/stores/useMarginSwapPositionStore";
import { useMarginSwapSettingsDialogStore } from "@/app/[locale]/margin-swap/stores/useMarginSwapSettingsDialogStore";
import { useMarginSwapSettingsStore } from "@/app/[locale]/margin-swap/stores/useMarginSwapSettingsStore";
import { useMarginSwapTokensStore } from "@/app/[locale]/margin-swap/stores/useMarginSwapTokensStore";
import useMarginPositionById from "@/app/[locale]/margin-trading/hooks/useMarginPosition";
import { useConfirmMarginSwapDialogStore } from "@/app/[locale]/margin-trading/stores/dialogStates";
import SwapDetails from "@/app/[locale]/swap/components/SwapDetails";
import SwapSettingsDialog, {
  MarginSwapSettingsDialog,
} from "@/app/[locale]/swap/components/SwapSettingsDialog";
import { useSwapStatus } from "@/app/[locale]/swap/hooks/useSwap";
import {
  useMarginTrade,
  useMarginTradeComputation,
  useTrade,
} from "@/app/[locale]/swap/hooks/useTrade";
import { useConfirmConvertDialogStore } from "@/app/[locale]/swap/stores/useConfirmConvertDialogOpened";
import { useConfirmSwapDialogStore } from "@/app/[locale]/swap/stores/useConfirmSwapDialogOpened";
import { Field, useSwapAmountsStore } from "@/app/[locale]/swap/stores/useSwapAmountsStore";
import {
  useSwapGasLimitStore,
  useSwapGasModeStore,
  useSwapGasPriceStore,
} from "@/app/[locale]/swap/stores/useSwapGasSettingsStore";
import { useSwapRecentTransactionsStore } from "@/app/[locale]/swap/stores/useSwapRecentTransactions";
import Button, { ButtonColor, ButtonSize } from "@/components/buttons/Button";
import IconButton, { IconButtonSize } from "@/components/buttons/IconButton";
import SwapButton from "@/components/buttons/SwapButton";
import TokenInput from "@/components/common/TokenInput";
import NetworkFeeConfigDialog from "@/components/dialogs/NetworkFeeConfigDialog";
import PickTokenDialog from "@/components/dialogs/PickTokenDialog";
import { useConnectWalletDialogStateStore } from "@/components/dialogs/stores/useConnectWalletStore";
import { networks } from "@/config/networks";
import { ThemeColors } from "@/config/theme/colors";
import { formatFloat } from "@/functions/formatFloat";
import { slippageToPercent } from "@/functions/slippageToPercent";
import { useStoreAllowance } from "@/hooks/useAllowance";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { useNativeCurrency } from "@/hooks/useNativeCurrency";
import { usePoolBalances } from "@/hooks/usePoolBalances";
import { useUSDPrice } from "@/hooks/useUSDPrice";
import { useColorScheme } from "@/lib/color-scheme";
import { ROUTER_ADDRESS } from "@/sdk_bi/addresses";
import { Currency } from "@/sdk_bi/entities/currency";
import { CurrencyAmount } from "@/sdk_bi/entities/fractions/currencyAmount";
import { Percent } from "@/sdk_bi/entities/fractions/percent";
import { wrappedTokens } from "@/sdk_bi/entities/weth9";
import { Standard } from "@/sdk_bi/standard";
import { useGlobalBlockNumber } from "@/shared/hooks/useGlobalBlockNumber";
import { useGlobalFees } from "@/shared/hooks/useGlobalFees";
import { GasOption } from "@/stores/factories/createGasPriceStore";
import { GasFeeModel } from "@/stores/useRecentTransactionsStore";

const ActionButtonSize = ButtonSize.EXTRA_LARGE;
const MobileActionButtonSize = ButtonSize.LARGE;
function OpenConfirmDialogButton({
  isSufficientBalance,
  isSufficientPoolBalance,
  isTradeReady,
  isTradeLoading,
}: {
  isSufficientBalance: boolean;
  isTradeReady: boolean;
  isTradeLoading: boolean;
  isSufficientPoolBalance: boolean;
}) {
  const tWallet = useTranslations("Wallet");
  const t = useTranslations("Swap");
  const { isConnected } = useAccount();

  const { tokenA, tokenB, tokenBStandard } = useMarginSwapTokensStore();
  const { typedValue } = useMarginSwapAmountsStore();
  const { setIsOpen: setConfirmSwapDialogOpen } = useConfirmMarginSwapDialogStore();

  const { isLoadingSwap, isLoadingApprove, isPendingApprove, isPendingSwap } = useSwapStatus();
  const { setIsOpened: setWalletConnectOpened } = useConnectWalletDialogStateStore();

  if (!isConnected) {
    return (
      <Button
        colorScheme={ButtonColor.PURPLE}
        onClick={() => setWalletConnectOpened(true)}
        fullWidth
        size={ActionButtonSize}
        mobileSize={MobileActionButtonSize}
      >
        {tWallet("connect_wallet")}
      </Button>
    );
  }

  if (isLoadingSwap) {
    return (
      <Button
        colorScheme={ButtonColor.PURPLE}
        fullWidth
        isLoading
        size={ActionButtonSize}
        mobileSize={MobileActionButtonSize}
      >
        <span className="flex items-center gap-2">
          <span>{t("processing_swap")}</span>
          <Preloader size={20} color="black" />
        </span>
      </Button>
    );
  }

  if (isLoadingApprove) {
    return (
      <Button
        colorScheme={ButtonColor.PURPLE}
        fullWidth
        isLoading
        size={ActionButtonSize}
        mobileSize={MobileActionButtonSize}
      >
        <span className="flex items-center gap-2">
          <span>{t("approving_in_progress")}</span>
          <Preloader size={20} color="black" />
        </span>
      </Button>
    );
  }

  if (isPendingApprove || isPendingSwap) {
    return (
      <Button
        colorScheme={ButtonColor.PURPLE}
        fullWidth
        isLoading
        size={ActionButtonSize}
        mobileSize={MobileActionButtonSize}
      >
        <span className="flex items-center gap-2">
          <span>{t("waiting_for_confirmation")}</span>
          <Preloader size={20} color="black" />
        </span>
      </Button>
    );
  }

  if (!tokenA || !tokenB) {
    return (
      <Button
        colorScheme={ButtonColor.PURPLE}
        fullWidth
        disabled
        size={ActionButtonSize}
        mobileSize={MobileActionButtonSize}
      >
        {t("select_tokens")}
      </Button>
    );
  }

  if (!+typedValue) {
    return (
      <Button
        colorScheme={ButtonColor.PURPLE}
        fullWidth
        disabled
        size={ActionButtonSize}
        mobileSize={MobileActionButtonSize}
      >
        {t("enter_amount")}
      </Button>
    );
  }

  if (!isSufficientBalance) {
    return (
      <Button
        colorScheme={ButtonColor.PURPLE}
        fullWidth
        disabled
        size={ActionButtonSize}
        mobileSize={MobileActionButtonSize}
      >
        {t("insufficient_balance")}
      </Button>
    );
  }

  if (!isSufficientPoolBalance) {
    return (
      <Button
        colorScheme={ButtonColor.PURPLE}
        fullWidth
        disabled
        size={ActionButtonSize}
        mobileSize={MobileActionButtonSize}
      >
        {t("insufficient_liquidity")}
      </Button>
    );
  }

  if (isTradeLoading) {
    return (
      <Button
        colorScheme={ButtonColor.PURPLE}
        fullWidth
        disabled
        size={ActionButtonSize}
        mobileSize={MobileActionButtonSize}
      >
        {t("looking_for_the_best_trade")}
      </Button>
    );
  }

  if (!isTradeReady) {
    return (
      <Button
        colorScheme={ButtonColor.PURPLE}
        fullWidth
        disabled
        size={ActionButtonSize}
        mobileSize={MobileActionButtonSize}
      >
        {t("swap_is_unavailable_for_this_pair")}
      </Button>
    );
  }

  return (
    <Button
      colorScheme={ButtonColor.PURPLE}
      onClick={() => setConfirmSwapDialogOpen(true)}
      fullWidth
      size={ActionButtonSize}
      tabletSize={MobileActionButtonSize}
    >
      {t("swap")}
    </Button>
  );
}

const gasOptionTitle: Record<GasOption, any> = {
  [GasOption.CHEAP]: "cheap",
  [GasOption.FAST]: "fast",
  [GasOption.CUSTOM]: "custom",
};

export default function TradeForm({
  setIsChartVisible,
  isChartVisible,
}: {
  setIsChartVisible?: (isVisible: boolean) => void;
  isChartVisible?: boolean;
}) {
  const t = useTranslations("Swap");
  const tChart = useTranslations("TradingChart");

  useMarginTradeComputation();

  const chainId = useCurrentChainId();
  const [isOpenedFee, setIsOpenedFee] = useState(false);
  const { isOpened: showRecentTransactions, setIsOpened: setShowRecentTransactions } =
    useSwapRecentTransactionsStore();
  const { setIsOpen } = useMarginSwapSettingsDialogStore();
  const {
    tokenA,
    tokenB,
    setTokenA,
    setTokenB,
    tokenAStandard,
    tokenBStandard,
    setTokenAStandard,
    setTokenBStandard,
    switchTokens,
  } = useMarginSwapTokensStore();

  const settingsStore = useMarginSwapSettingsStore();
  const { computed } = settingsStore;
  const [currentlyPicking, setCurrentlyPicking] = useState<"tokenA" | "tokenB">("tokenA");

  const { setTypedValue, typedValue } = useMarginSwapAmountsStore();

  const { isAllowed: isAllowedA } = useStoreAllowance({
    token: tokenA,
    contractAddress: ROUTER_ADDRESS[chainId],
    amountToCheck: parseUnits(typedValue, tokenA?.decimals ?? 18),
  });

  const { trade } = useMarginTrade();

  const { erc20BalanceToken1, erc223BalanceToken1 } = usePoolBalances({
    tokenA,
    tokenB,
    fee: trade?.route.pools?.[0]?.fee,
  });

  const dependentAmount: CurrencyAmount<Currency> | undefined = useMemo(() => {
    return trade?.outputAmount;
  }, [trade?.outputAmount]);

  const dependentAmountValue = useMemo(() => {
    if (tokenA && tokenB && tokenA.equals(tokenB)) {
      return typedValue;
    }

    return dependentAmount?.toSignificant() || "";
  }, [dependentAmount, tokenA, tokenB, typedValue]);

  const { slippage } = useMarginSwapSettingsStore();

  const minimumAmountOut = useMemo(() => {
    if (!trade) {
      return BigInt(0);
    }

    return BigInt(
      trade.minimumAmountOut(slippageToPercent(slippage), dependentAmount).quotient.toString(),
    );
  }, [dependentAmount, slippage, trade]);

  const isSufficientPoolBalance = useMemo(() => {
    const erc20Balance = erc20BalanceToken1?.value ?? BigInt(0);
    const erc223Balance = erc223BalanceToken1?.value ?? BigInt(0);
    const poolBalance = erc20Balance + erc223Balance;

    return poolBalance > minimumAmountOut;
  }, [erc20BalanceToken1, erc223BalanceToken1, minimumAmountOut]);

  const isConvertationRequired = useMemo(() => {
    if (erc20BalanceToken1 && tokenBStandard === Standard.ERC20) {
      if (dependentAmount && +dependentAmount.toSignificant() > +erc20BalanceToken1.formatted) {
        return true;
      }
    }

    if (erc223BalanceToken1 && tokenBStandard === Standard.ERC223) {
      if (dependentAmount && +dependentAmount.toSignificant() > +erc223BalanceToken1.formatted) {
        return true;
      }
    }

    return false;
  }, [dependentAmount, erc20BalanceToken1, erc223BalanceToken1, tokenBStandard]);

  const gasERC20 = useMemo(() => {
    if (!tokenA || !tokenB || !typedValue) {
      return "—";
    }

    let gasForERC20 = 149;

    if (!isAllowedA) {
      gasForERC20 += 29;
    }

    if (isConvertationRequired) {
      gasForERC20 += 56;
    }

    return `~${gasForERC20}K gas`;
  }, [isAllowedA, isConvertationRequired, tokenA, tokenB, typedValue]);

  const gasERC223 = useMemo(() => {
    if (!tokenA || !tokenB || !typedValue) {
      return "—";
    }

    let gasForERC223 = 127;

    if (isConvertationRequired) {
      gasForERC223 += 56;
    }

    return `~${gasForERC223}K gas`;
  }, [isConvertationRequired, tokenA, tokenB, typedValue]);

  const [isOpenedTokenPick, setIsOpenedTokenPick] = useState(false);

  const { marginSwapPositionId } = useMarginSwapPositionStore();

  const {
    loading,
    position: marginSwapPosition,
    refetch,
  } = useMarginPositionById({
    id: marginSwapPositionId?.toString(),
  });

  const handlePick = useCallback(
    (token: Currency) => {
      if (currentlyPicking === "tokenA") {
        setTokenA(token);
        setTokenAStandard(getPositionHeldStandard(marginSwapPosition, token));

        if (token.isNative || tokenB?.isNative) {
          if (tokenB && tokenB.equals(token)) {
            setTokenB(tokenA);
            setTokenBStandard(tokenAStandard);
          }
        } else {
          if (token.address0 === tokenB?.address0) {
            if (tokenBStandard === Standard.ERC20) {
              setTokenAStandard(Standard.ERC223);
            } else {
              setTokenAStandard(Standard.ERC20);
            }
          }
        }
      }

      if (currentlyPicking === "tokenB") {
        setTokenB(token);
        setTokenBStandard(getPositionAllowedOutputStandard(marginSwapPosition, token));

        if (token.isNative || tokenA?.isNative) {
          if (tokenA && tokenA.equals(token)) {
            setTokenA(tokenB);
            setTokenAStandard(tokenBStandard);
          }
        } else {
          if (token.address0 === tokenA?.address0) {
            if (tokenAStandard === Standard.ERC20) {
              setTokenBStandard(Standard.ERC223);
            } else {
              setTokenBStandard(Standard.ERC20);
            }
          }
        }
      }

      setIsOpenedTokenPick(false);
    },
    [
      currentlyPicking,
      marginSwapPosition,
      setTokenA,
      setTokenAStandard,
      setTokenB,
      setTokenBStandard,
      tokenA,
      tokenAStandard,
      tokenB,
      tokenBStandard,
    ],
  );

  // const {
  //   balance: { erc20Balance: tokenA0Balance, erc223Balance: tokenA1Balance },
  //   refetch: refetchABalance,
  // } = useTokenBalances(tokenA);
  // const {
  //   balance: { erc20Balance: tokenB0Balance, erc223Balance: tokenB1Balance },
  //   refetch: refetchBBalance,
  // } = useTokenBalances(tokenB);

  // useEffect(() => {
  //   refetchABalance();
  //   refetchBBalance();
  // }, [blockNumber, refetchABalance, refetchBBalance]);

  const {
    gasPriceOption,
    gasPriceSettings,
    setGasPriceOption,
    setGasPriceSettings,
    updateDefaultState,
  } = useSwapGasPriceStore();
  const { estimatedGas, customGasLimit, setEstimatedGas, setCustomGasLimit } =
    useSwapGasLimitStore();
  const { isAdvanced, setIsAdvanced } = useSwapGasModeStore();

  const { isLoadingSwap, isPendingSwap, isLoadingApprove, isPendingApprove } = useSwapStatus();

  const { setIsOpen: setConfirmSwapDialogOpen } = useConfirmSwapDialogStore();
  const { baseFee, priorityFee, gasPrice } = useGlobalFees();

  const { blockNumber } = useGlobalBlockNumber();

  useEffect(() => {
    refetch();
  }, [blockNumber, refetch]);

  useEffect(() => {
    updateDefaultState(chainId);
  }, [chainId, updateDefaultState]);

  const computedGasSpending = useMemo(() => {
    if (gasPriceSettings.model === GasFeeModel.LEGACY && gasPriceSettings.gasPrice) {
      return formatFloat(formatGwei(gasPriceSettings.gasPrice));
    }

    if (gasPriceSettings.model === GasFeeModel.LEGACY && gasPrice) {
      return formatFloat(formatGwei(gasPrice));
    }

    if (
      gasPriceSettings.model === GasFeeModel.EIP1559 &&
      gasPriceSettings.maxFeePerGas &&
      gasPriceSettings.maxPriorityFeePerGas &&
      baseFee &&
      gasPriceOption === GasOption.CUSTOM
    ) {
      const lowerFeePerGas =
        gasPriceSettings.maxFeePerGas > baseFee ? baseFee : gasPriceSettings.maxFeePerGas;

      return formatFloat(formatGwei(lowerFeePerGas + gasPriceSettings.maxPriorityFeePerGas));
    }

    if (
      gasPriceSettings.model === GasFeeModel.EIP1559 &&
      baseFee &&
      priorityFee &&
      gasPriceOption !== GasOption.CUSTOM
    ) {
      return formatFloat(formatGwei(baseFee + priorityFee));
    }

    return undefined;
  }, [baseFee, gasPrice, gasPriceOption, gasPriceSettings, priorityFee]);

  const computedGasSpendingETH = useMemo(() => {
    if (gasPriceSettings.model === GasFeeModel.LEGACY && gasPriceSettings.gasPrice) {
      return formatFloat(formatEther(gasPriceSettings.gasPrice * estimatedGas));
    }

    if (
      gasPriceSettings.model === GasFeeModel.EIP1559 &&
      gasPriceSettings.maxFeePerGas &&
      gasPriceSettings.maxPriorityFeePerGas &&
      baseFee &&
      gasPriceOption === GasOption.CUSTOM
    ) {
      const lowerFeePerGas =
        gasPriceSettings.maxFeePerGas > baseFee ? baseFee : gasPriceSettings.maxFeePerGas;

      return formatFloat(
        formatEther((lowerFeePerGas + gasPriceSettings.maxPriorityFeePerGas) * estimatedGas),
      );
    }

    if (
      gasPriceSettings.model === GasFeeModel.EIP1559 &&
      baseFee &&
      priorityFee &&
      gasPriceOption !== GasOption.CUSTOM
    ) {
      return formatFloat(formatEther((baseFee + priorityFee) * estimatedGas));
    }

    return undefined;
  }, [baseFee, estimatedGas, gasPriceOption, gasPriceSettings, priorityFee]);

  const { tokenA0Balance, unformattedTokenA0Balance } = useMemo(() => {
    if (!marginSwapPosition || !tokenA) {
      return { tokenA0Balance: "0" };
    }

    const tokenABalanceUnformatted = marginSwapPosition.assetAddresses.find(
      (asset) => asset.address.toLowerCase() === tokenA.wrapped.address0.toLowerCase(),
    );

    if (tokenABalanceUnformatted) {
      return {
        tokenA0Balance: formatUnits(tokenABalanceUnformatted.balance, tokenA.decimals),
        unformattedTokenA0Balance: tokenABalanceUnformatted.balance,
      };
    }

    return { tokenA0Balance: "0", unformattedTokenA0Balance: BigInt(0) };
  }, [marginSwapPosition, tokenA]);

  const { tokenA1Balance, unformattedTokenA1Balance } = useMemo(() => {
    if (!marginSwapPosition || !tokenA) {
      return { tokenA1Balance: "0" };
    }
    const tokenABalanceUnformatted = marginSwapPosition.assetAddresses.find(
      (asset) => asset.address.toLowerCase() === tokenA.wrapped.address1.toLowerCase(),
    );

    if (tokenABalanceUnformatted) {
      return {
        tokenA1Balance: formatUnits(tokenABalanceUnformatted.balance, tokenA.decimals),
        unformattedTokenA1Balance: tokenABalanceUnformatted.balance,
      };
    }

    return { tokenA1Balance: "0", unformattedTokenA1Balance: BigInt(0) };
  }, [marginSwapPosition, tokenA]);

  const { tokenB0Balance } = useMemo(() => {
    if (!marginSwapPosition || !tokenB) {
      return { tokenB0Balance: "0" };
    }
    const tokenABalanceUnformatted = marginSwapPosition.assetAddresses.find(
      (asset) => asset.address.toLowerCase() === tokenB.wrapped.address0.toLowerCase(),
    );

    if (tokenABalanceUnformatted) {
      return { tokenB0Balance: formatUnits(tokenABalanceUnformatted.balance, tokenB.decimals) };
    }

    return { tokenB0Balance: "0" };
  }, [marginSwapPosition, tokenB]);

  const { tokenB1Balance } = useMemo(() => {
    if (!marginSwapPosition || !tokenB) {
      return { tokenB1Balance: "0" };
    }
    const tokenABalanceUnformatted = marginSwapPosition.assetAddresses.find(
      (asset) => asset.address.toLowerCase() === tokenB.wrapped.address1.toLowerCase(),
    );

    if (tokenABalanceUnformatted) {
      return { tokenB1Balance: formatUnits(tokenABalanceUnformatted.balance, tokenB.decimals) };
    }

    return { tokenB1Balance: "0" };
  }, [marginSwapPosition, tokenB]);

  const _isMobile = useMediaQuery({ query: "(max-width: 767px)" });
  const nativeCurrency = useNativeCurrency();
  const { price } = useUSDPrice(wrappedTokens[chainId]?.address0);
  const colorScheme = useColorScheme();

  return (
    <div className="card-spacing pt-2.5 surface rounded-5">
      <div className="flex justify-between items-center mb-2.5">
        <h1 className="font-bold text-20">{t("swap")}</h1>
        <div className="flex items-center relative left-3">
          {setIsChartVisible && tokenB && tokenA && (
            <IconButton
              buttonSize={IconButtonSize.LARGE}
              active={isChartVisible}
              iconName="toggle-trading-view"
              aria-label={isChartVisible ? tChart("hide_chart") : tChart("show_chart")}
              aria-pressed={isChartVisible}
              onClick={() => setIsChartVisible(!isChartVisible)}
              colorScheme={ThemeColors.PURPLE}
            />
          )}
          <IconButton
            buttonSize={IconButtonSize.LARGE}
            active={showRecentTransactions}
            iconName="recent-transactions"
            onClick={() => setShowRecentTransactions(!showRecentTransactions)}
            colorScheme={ThemeColors.PURPLE}
          />
          <IconButton
            buttonSize={IconButtonSize.LARGE}
            iconName="gas-edit"
            onClick={() => setIsOpenedFee(true)}
            colorScheme={ThemeColors.PURPLE}
          />
          <span className="relative">
            <IconButton
              buttonSize={IconButtonSize.LARGE}
              iconSize={24}
              iconName="settings"
              onClick={() => setIsOpen(true)}
              colorScheme={ThemeColors.PURPLE}
            />
            {computed.isModified && (
              <div className="absolute w-2 h-2 right-[13px] top-[13px] bg-primary-bg flex items-center z-10 justify-center rounded-full">
                <div className="w-1 h-1 bg-red-light rounded-full" />
              </div>
            )}
          </span>
        </div>
      </div>
      <TokenInput
        colorScheme={ThemeColors.PURPLE}
        value={typedValue}
        onInputChange={(value) => setTypedValue({ typedValue: value, field: Field.CURRENCY_A })}
        handleClick={() => {
          setCurrentlyPicking("tokenA");
          setIsOpenedTokenPick(true);
        }}
        gasERC20={gasERC20}
        gasERC223={gasERC223}
        token={tokenA}
        balance0={tokenA0Balance}
        balance1={tokenA1Balance}
        setMax={
          (Boolean(unformattedTokenA0Balance) && tokenAStandard === Standard.ERC20) ||
          (Boolean(unformattedTokenA1Balance) && tokenAStandard === Standard.ERC223)
            ? () => {
                if (tokenA0Balance && tokenAStandard === Standard.ERC20) {
                  setTypedValue({
                    typedValue: tokenA0Balance,

                    field: Field.CURRENCY_A,
                  });
                }
                if (tokenA1Balance && tokenAStandard === Standard.ERC223) {
                  setTypedValue({
                    typedValue: tokenA1Balance,

                    field: Field.CURRENCY_A,
                  });
                }
              }
            : undefined
        }
        setHalf={
          (Boolean(unformattedTokenA0Balance) && tokenAStandard === Standard.ERC20) ||
          (Boolean(unformattedTokenA1Balance) && tokenAStandard === Standard.ERC223)
            ? () => {
                if (unformattedTokenA0Balance && tokenAStandard === Standard.ERC20 && tokenA) {
                  setTypedValue({
                    typedValue: formatUnits(unformattedTokenA0Balance / BigInt(2), tokenA.decimals),

                    field: Field.CURRENCY_A,
                  });
                }
                if (unformattedTokenA1Balance && tokenAStandard === Standard.ERC223 && tokenA) {
                  setTypedValue({
                    typedValue: formatUnits(unformattedTokenA1Balance / BigInt(2), tokenA.decimals),

                    field: Field.CURRENCY_A,
                  });
                }
              }
            : undefined
        }
        isHalf={
          !!(
            tokenAStandard === Standard.ERC20 &&
            tokenA0Balance &&
            unformattedTokenA0Balance &&
            tokenA &&
            typedValue !== "0" &&
            typedValue === formatUnits(unformattedTokenA0Balance / BigInt(2), tokenA.decimals)
          ) ||
          !!(
            tokenAStandard === Standard.ERC223 &&
            typedValue !== "0" &&
            unformattedTokenA1Balance &&
            tokenA &&
            typedValue === formatUnits(unformattedTokenA1Balance / BigInt(2), tokenA.decimals)
          )
        }
        isMax={
          !!(
            (tokenAStandard === Standard.ERC20 &&
              typedValue !== "0" &&
              tokenA0Balance &&
              typedValue === tokenA0Balance) ||
            (tokenAStandard === Standard.ERC223 &&
              typedValue !== "0" &&
              tokenA1Balance &&
              typedValue === tokenA1Balance)
          )
        }
        label={t("you_pay")}
        standard={tokenAStandard}
        setStandard={setTokenAStandard}
      />
      <div className="relative h-4 md:h-5 z-10">
        <SwapButton
          colorScheme={ThemeColors.PURPLE}
          onClick={() => {
            switchTokens();
            setTypedValue({
              typedValue: dependentAmountValue,
              field: Field.CURRENCY_A,
            });
          }}
        />
      </div>
      <TokenInput
        readOnly
        colorScheme={ThemeColors.PURPLE}
        value={dependentAmountValue}
        onInputChange={(value) => null}
        handleClick={() => {
          setCurrentlyPicking("tokenB");
          setIsOpenedTokenPick(true);
        }}
        token={tokenB}
        balance0={tokenB0Balance}
        balance1={tokenB1Balance}
        label={t("you_receive")}
        standard={tokenBStandard}
        setStandard={setTokenBStandard}
      />

      {/*{error === TradeError.NO_LIQUIDITY && (*/}
      {/*  <div className="mt-5">*/}
      {/*    <Alert*/}
      {/*      text="Swap unavailable. One of the tokens lacks liquidity. Please try again later or choose another pair"*/}
      {/*      type="warning"*/}
      {/*    />*/}
      {/*  </div>*/}
      {/*)}*/}

      {/*{!isLoadingTrade && !poolExists && tokenA && tokenB && !tokenA.equals(tokenB) && (*/}
      {/*  <div className="mt-5">*/}
      {/*    <Alert*/}
      {/*      text={*/}
      {/*        <span>*/}
      {/*          The requested pool does not exist. You can{" "}*/}
      {/*          <a*/}
      {/*            className="text-green hover:text-green-hover duration-200"*/}
      {/*            target="_blank"*/}
      {/*            href={`/add?tokenA=${tokenA.wrapped.address0}&tokenB=${tokenB.wrapped.address0}`}*/}
      {/*          >*/}
      {/*            create a new pool*/}
      {/*          </a>*/}
      {/*        </span>*/}
      {/*      }*/}
      {/*      type="warning"*/}
      {/*    />*/}
      {/*  </div>*/}
      {/*)}*/}

      {tokenA && tokenB && typedValue ? (
        <div
          className={clsx(
            "rounded-3 py-3.5 flex justify-between duration-200 px-5 bg-tertiary-bg my-5 md:items-center flex-wrap",
          )}
          role="button"
        >
          {computedGasSpending ? (
            <>
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-1">
                  <Tooltip
                    iconSize={_isMobile ? 16 : 24}
                    text={t("network_fee_tooltip", {
                      networkName: networks.find((n) => n.chainId === chainId)?.name,
                    })}
                  />
                  <div className="text-secondary-text text-12 md:text-14 flex items-center ">
                    {t("network_fee")}
                  </div>
                  <span className="mr-1 text-12 md:hidden">
                    {price && computedGasSpendingETH
                      ? `$${formatFloat(+computedGasSpendingETH * price)}`
                      : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2 max-sm:hidden">
                  <span className="text-secondary-text text-12 md:text-14 ">
                    {computedGasSpendingETH} {nativeCurrency.symbol}
                  </span>
                  <span className="block h-4 w-px bg-primary-border" />
                  <span className="text-tertiary-text mr-1 text-12 md:text-14 ">
                    {computedGasSpending} GWEI
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 justify-between md:justify-end">
                <span className="mr-1 text-14 max-md:hidden">
                  {price && computedGasSpendingETH
                    ? `$${formatFloat(+computedGasSpendingETH * price)}`
                    : ""}
                </span>
                <span className="flex items-center justify-center px-2 text-12 md:text-14 h-5 rounded-20 font-500 text-tertiary-text border border-secondary-border">
                  {t(gasOptionTitle[gasPriceOption])}
                </span>
                <Button
                  size={ButtonSize.EXTRA_SMALL}
                  colorScheme={
                    colorScheme === ThemeColors.GREEN
                      ? ButtonColor.LIGHT_GREEN
                      : ButtonColor.LIGHT_PURPLE
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpenedFee(true);
                  }}
                >
                  {t("edit")}
                </Button>
              </div>

              <div className="flex items-center gap-2 sm:hidden w-full mt-0.5">
                <span className="text-secondary-text text-12 md:text-14 ">
                  {computedGasSpendingETH} {nativeCurrency.symbol}
                </span>
                <span className="block h-4 w-px bg-primary-border" />
                <span className="text-tertiary-text mr-1 text-12 md:text-14 ">
                  {computedGasSpending} GWEI
                </span>
              </div>
            </>
          ) : (
            <span className="text-secondary-text text-14 flex items-center min-h-[26px]">
              {t("fetching_best_price")}
            </span>
          )}
        </div>
      ) : (
        <div className="h-4 md:h-5" />
      )}

      {(isLoadingSwap || isPendingSwap || isPendingApprove || isLoadingApprove) && (
        <div className="flex justify-between px-5 py-3 rounded-2 bg-tertiary-bg mb-5">
          <div className="flex items-center gap-2 text-14">
            <Preloader size={20} />

            {isLoadingSwap && <span>{t("processing_swap")}</span>}
            {isPendingSwap && <span>{t("waiting_for_confirmation")}</span>}
            {isLoadingApprove && <span>{t("approving_in_progress")}</span>}
            {isPendingApprove && <span>{t("waiting_for_confirmation")}</span>}
          </div>

          <Button
            onClick={() => {
              setConfirmSwapDialogOpen(true);
            }}
            size={ButtonSize.EXTRA_SMALL}
          >
            {tokenB && tokenA?.equals(tokenB) ? t("review_conversion") : t("review_swap")}
          </Button>
        </div>
      )}

      <OpenConfirmDialogButton
        isSufficientBalance={
          (tokenAStandard === Standard.ERC20 &&
            (unformattedTokenA0Balance && tokenA
              ? unformattedTokenA0Balance >= parseUnits(typedValue, tokenA.decimals)
              : false)) ||
          (tokenAStandard === Standard.ERC223 &&
            (unformattedTokenA1Balance && tokenA
              ? unformattedTokenA1Balance >= parseUnits(typedValue, tokenA.decimals)
              : false))
        }
        isSufficientPoolBalance={isSufficientPoolBalance}
        isTradeReady={Boolean(trade)}
        isTradeLoading={false}
      />

      {trade && tokenA && tokenB && (
        <SwapDetails
          trade={trade}
          tokenA={tokenA}
          tokenB={tokenB}
          networkFee={computedGasSpendingETH}
          gasPrice={computedGasSpending}
          settingsStore={settingsStore}
        />
      )}

      <NetworkFeeConfigDialog
        isAdvanced={isAdvanced}
        setIsAdvanced={setIsAdvanced}
        estimatedGas={estimatedGas}
        setEstimatedGas={setEstimatedGas}
        gasPriceSettings={gasPriceSettings}
        gasPriceOption={gasPriceOption}
        customGasLimit={customGasLimit}
        setCustomGasLimit={setCustomGasLimit}
        setGasPriceOption={setGasPriceOption}
        setGasPriceSettings={setGasPriceSettings}
        isOpen={isOpenedFee}
        setIsOpen={setIsOpenedFee}
      />
      <PickTokenDialog
        handlePick={handlePick}
        isOpen={isOpenedTokenPick}
        setIsOpen={setIsOpenedTokenPick}
        availableTokens={
          currentlyPicking === "tokenA"
            ? marginSwapPosition?.assets
            : marginSwapPosition
              ? getPositionAllowedOutputAssets(marginSwapPosition)
              : undefined
        }
      />
      <MarginSwapSettingsDialog />
      <ConfirmMarginSwapDialog trade={trade} />
    </div>
  );
}
