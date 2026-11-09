"use client";

import Alert from "@repo/ui/alert";
import Preloader from "@repo/ui/preloader";
import Tooltip from "@repo/ui/tooltip";
import clsx from "clsx";
import Image from "next/image";
import { useTranslations } from "next-intl";
import React, { PropsWithChildren, useCallback, useEffect, useMemo, useState } from "react";
import { NumericFormat } from "react-number-format";
import { Address, formatUnits, parseUnits } from "viem";
import { useAccount } from "wagmi";

import DialogHeader from "@/components/atoms/DialogHeader";
import DrawerDialog from "@/components/atoms/DrawerDialog";
import Input from "@/components/atoms/Input";
import Svg from "@/components/atoms/Svg";
import { HelperText } from "@/components/atoms/TextField";
import WhyApproveHint from "@/components/atoms/WhyApproveHint";
import Button, { ButtonColor, ButtonSize } from "@/components/buttons/Button";
import IconButton, { IconButtonSize } from "@/components/buttons/IconButton";
import GasSettingsBlock from "@/components/common/GasSettingsBlock";
import TokenStandardSelector from "@/components/common/TokenStandardSelector";
import NetworkFeeConfigDialog from "@/components/dialogs/NetworkFeeConfigDialog";
import { useConnectWalletDialogStateStore } from "@/components/dialogs/stores/useConnectWalletStore";
import { useTransactionSpeedUpDialogStore } from "@/components/dialogs/stores/useTransactionSpeedUpDialogStore";
import { ThemeColors } from "@/config/theme/colors";
import { clsxMerge } from "@/functions/clsxMerge";
import { durationMessageKey, formatDuration } from "@/functions/formatDuration";
import { getFormattedGasPrice } from "@/functions/gasSettings";
import getExplorerLink, { ExplorerLinkType } from "@/functions/getExplorerLink";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { useUSDPrice } from "@/hooks/useUSDPrice";
import addToast from "@/other/toast";
import { Standard } from "@/sdk_bi/standard";
import { useGlobalFees } from "@/shared/hooks/useGlobalFees";

import useRecentTransactionByHash from "../hooks/useRecentTransactionByHash";
import useRevenueContract from "../hooks/useRevenueContract";
import { getTxErrorCategory } from "../lib/txError";
import { StakeError, StakeStatus, useStakeDialogStore } from "../stores/useStakeDialogStore";
import {
  useStakeGasLimitStore,
  useStakeGasModeStore,
  useStakeGasPriceStore,
} from "../stores/useStakeGasSettingsStore";

export function useStakeStatus() {
  const { status: stakeStatus } = useStakeDialogStore();

  return {
    isPendingApprove: stakeStatus === StakeStatus.PENDING_APPROVE,
    isLoadingApprove: stakeStatus === StakeStatus.LOADING_APPROVE,
    isPendingStake: stakeStatus === StakeStatus.PENDING,
    isLoadingStake: stakeStatus === StakeStatus.LOADING,
    isSuccessStake: stakeStatus === StakeStatus.SUCCESS,
    isRevertedStake: stakeStatus === StakeStatus.ERROR,
    isSettledStake: stakeStatus === StakeStatus.SUCCESS || stakeStatus === StakeStatus.ERROR,
    isRevertedApprove: stakeStatus === StakeStatus.APPROVE_ERROR,
  };
}

function ApproveRow({
  isPending = false,
  isLoading = false,
  isSuccess = false,
  isSuccessStake = false,
  isReverted = false,
  hash,
}: {
  isLoading?: boolean;
  isPending?: boolean;
  isSuccess?: boolean;
  isSuccessStake?: boolean;
  isReverted?: boolean;
  hash?: Address | undefined;
}) {
  const t = useTranslations("Revenue");
  const tSwap = useTranslations("Swap");
  const tLiq = useTranslations("Liquidity");
  const chainId = useCurrentChainId();
  const recentTransaction = useRecentTransactionByHash(hash);
  const { handleSpeedUp } = useTransactionSpeedUpDialogStore();

  return (
    <div
      className={clsx(
        "relative grid grid-cols-[32px_1fr_auto] gap-2 md:gap-3 min-h-10 pb-5 before:absolute before:left-[15px] before:top-10 before:w-0.5 before:h-4 before:rounded-1",
        isSuccess || isSuccessStake ? "before:bg-green" : "before:bg-tertiary-bg",
      )}
    >
      <div className="flex items-center">
        <div
          className={clsx(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
            isSuccess || isSuccessStake ? "bg-tertiary-bg" : "bg-tertiary-bg",
            isReverted && "bg-red-bg",
          )}
        >
          {isSuccess || isSuccessStake ? (
            <Image
              src="/images/logo-short.svg"
              alt="D223"
              width={14}
              height={14}
              className="md:w-4 md:h-4"
            />
          ) : isReverted ? (
            <Image
              src="/images/logo-short.svg"
              alt="D223"
              width={14}
              height={14}
              className="md:w-4 md:h-4"
            />
          ) : (
            <Image
              src="/images/logo-short.svg"
              alt="D223"
              width={14}
              height={14}
              className="md:w-4 md:h-4"
            />
          )}
        </div>
      </div>

      <div className="flex flex-col justify-center min-w-0 pr-2">
        <span
          className={clsx(
            "text-14",
            isSuccess || isSuccessStake ? "text-secondary-text" : "text-primary-text",
          )}
        >
          {(isSuccess || isSuccessStake) && t("approved")}
          {isPending && t("approve_action")}
          {isLoading && t("approve_action")}
          {!isSuccess &&
            !isPending &&
            !isReverted &&
            !isLoading &&
            !isSuccessStake &&
            t("approve_action")}
          {isReverted && t("approve_failed")}
        </span>
        {!isSuccess && !isSuccessStake && !isReverted && (
          <WhyApproveHint className="max-md:hidden" />
        )}
        {isPending && (
          <span className="text-secondary-text text-12 md:hidden mt-0.5">
            {tSwap("proceed_in_your_wallet")}
          </span>
        )}
      </div>
      <div className="relative flex items-center gap-1 md:gap-2 justify-end flex-shrink-0">
        {isPending && (
          <>
            <div className="max-md:hidden">
              <Preloader type="linear" />
            </div>
            <span className="text-secondary-text text-12 md:text-14 whitespace-nowrap max-md:hidden">
              {tSwap("proceed_in_your_wallet")}
            </span>
          </>
        )}
        {isLoading && (
          <>
            {recentTransaction && (
              <button
                type="button"
                onClick={() => handleSpeedUp(recentTransaction)}
                className="relative z-20 px-2 md:px-3 py-1 md:py-1.5 bg-tertiary-bg text-secondary-text text-10 md:text-12 rounded-2 hover:bg-quaternary-bg transition-colors font-normal whitespace-nowrap"
              >
                {tLiq("speed_up")}
              </button>
            )}
            <IconButton iconName="forward" buttonSize={IconButtonSize.EXTRA_SMALL} />
            <Preloader size={16} />
          </>
        )}
        {(isSuccess || isSuccessStake) && (
          <>
            <IconButton iconName="forward" buttonSize={IconButtonSize.EXTRA_SMALL} />
            <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-green flex items-center justify-center flex-shrink-0">
              <Svg className="text-primary-bg" iconName="check" size={12} />
            </div>
          </>
        )}
        {isReverted && (
          <>
            <IconButton iconName="forward" buttonSize={IconButtonSize.EXTRA_SMALL} />
            <Svg className="text-red-light" iconName="warning" size={18} />
          </>
        )}
        {hash && (
          <a
            target="_blank"
            rel="noopener noreferrer"
            href={getExplorerLink(ExplorerLinkType.TRANSACTION, hash, chainId)}
            className="absolute z-10"
            aria-label={t("view_transaction")}
          />
        )}
      </div>
    </div>
  );
}

function StakeRow({
  isPending = false,
  isLoading = false,
  isSuccess = false,
  isSettled = false,
  isReverted = false,
  isDisabled = false,
  isStaking = true,
  hash,
}: {
  isLoading?: boolean;
  isPending?: boolean;
  isSettled?: boolean;
  isSuccess?: boolean;
  isReverted?: boolean;
  isDisabled?: boolean;
  isStaking?: boolean;
  hash?: Address | undefined;
}) {
  const t = useTranslations("Revenue");
  const tSwap = useTranslations("Swap");
  const tLiq = useTranslations("Liquidity");
  const chainId = useCurrentChainId();
  const recentTransaction = useRecentTransactionByHash(hash);
  const { handleSpeedUp } = useTransactionSpeedUpDialogStore();

  return (
    <div className="relative grid grid-cols-[32px_1fr_auto] gap-2 md:gap-3 min-h-10">
      <div className="flex items-center h-full">
        <div
          className={clsx(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
            isDisabled && "bg-tertiary-bg",
            !isDisabled && !isSuccess && !isReverted && "bg-tertiary-bg",
            isSuccess && "bg-tertiary-bg",
            isReverted && "bg-red-bg",
          )}
        >
          {isSuccess ? (
            <Svg iconName="deposit" size={16} />
          ) : isReverted ? (
            <Svg className="text-red-light" iconName="withdraw" size={16} />
          ) : (
            <Svg
              className={clsx(isDisabled ? "text-tertiary-text" : "text-secondary-text")}
              iconName={isStaking ? "deposit" : "withdraw"}
              size={16}
            />
          )}
        </div>
      </div>

      <div className="flex flex-col justify-center min-w-0 pr-2">
        <span className={clsx("text-14", isDisabled ? "text-tertiary-text" : "text-primary-text")}>
          {isDisabled && (isStaking ? t("stake_action") : t("unstake_action"))}
          {isPending && (isStaking ? t("confirm_stake") : t("confirm_unstaking"))}
          {isLoading && (isStaking ? t("executing_staking") : t("executing_unstaking"))}
          {isReverted && (isStaking ? t("failed_stake") : t("failed_unstake"))}
          {isSuccess && (isStaking ? t("success_staked") : t("success_unstaked"))}
        </span>
        {isPending && (
          <span className="text-secondary-text text-12 md:hidden mt-0.5">
            {tSwap("proceed_in_your_wallet")}
          </span>
        )}
      </div>
      <div className="relative flex items-center gap-1 md:gap-2 justify-end flex-shrink-0">
        {isPending && (
          <>
            <div className="max-md:hidden">
              <Preloader type="linear" />
            </div>
            <span className="text-secondary-text text-12 md:text-14 whitespace-nowrap max-md:hidden">
              {tSwap("proceed_in_your_wallet")}
            </span>
          </>
        )}
        {isLoading && (
          <>
            {recentTransaction && (
              <button
                type="button"
                onClick={() => handleSpeedUp(recentTransaction)}
                className="relative z-20 px-2 md:px-3 py-1 md:py-1.5 bg-tertiary-bg text-secondary-text text-10 md:text-12 rounded-2 hover:bg-quaternary-bg transition-colors font-normal whitespace-nowrap"
              >
                {tLiq("speed_up")}
              </button>
            )}
            <IconButton iconName="forward" buttonSize={IconButtonSize.EXTRA_SMALL} />
            <Preloader size={16} />
          </>
        )}
        {isSuccess && (
          <>
            <IconButton iconName="forward" buttonSize={IconButtonSize.EXTRA_SMALL} />
            <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-green flex items-center justify-center flex-shrink-0">
              <Svg className="text-primary-bg" iconName="check" size={12} />
            </div>
          </>
        )}
        {isReverted && (
          <>
            <IconButton iconName="forward" buttonSize={IconButtonSize.EXTRA_SMALL} />
            <Svg className="text-red-light" iconName="warning" size={18} />
          </>
        )}
        {hash && (
          <a
            target="_blank"
            rel="noopener noreferrer"
            href={getExplorerLink(ExplorerLinkType.TRANSACTION, hash, chainId)}
            className="absolute inset-0 z-10"
            aria-label={t("view_transaction")}
          />
        )}
      </div>
    </div>
  );
}

function Rows({ children }: PropsWithChildren<{}>) {
  return <div className="flex flex-col gap-2">{children}</div>;
}

const StakeDialog = () => {
  const t = useTranslations("Revenue");
  const tSwap = useTranslations("Swap");
  const tLiq = useTranslations("Liquidity");
  const {
    isOpen,
    status,
    amount: storeAmount,
    selectedStandard: storeStandard,
    dialogType,
    closeDialog,
    setStatus,
    setErrorType,
    setErrorMessage,
    setApproveHash,
    setStakeHash,
    approveHash,
    stakeHash,
    errorMessage,
    errorType,
  } = useStakeDialogStore();

  const tWallet = useTranslations("Wallet");
  const { address: connectedAddress } = useAccount();
  const { setIsOpened: setWalletConnectOpened } = useConnectWalletDialogStateStore();

  // Maps a failed transaction to the error type and the message the dialog shows.
  const describeTxError = useCallback(
    (error: any, fallback: string): { type: StakeError; message: string } => {
      switch (getTxErrorCategory(error)) {
        case "rejected":
          return { type: StakeError.UNKNOWN, message: tWallet("user_rejected") };
        case "insufficient_funds":
          return { type: StakeError.UNKNOWN, message: t("tx_insufficient_funds") };
        case "out_of_gas":
          return { type: StakeError.OUT_OF_GAS, message: t("gas_too_low_hint") };
        case "reverted":
          return { type: StakeError.UNKNOWN, message: t("tx_reverted") };
        default:
          return { type: StakeError.UNKNOWN, message: error?.shortMessage || fallback };
      }
    },
    [t, tWallet],
  );

  const [amount, setAmount] = useState("");
  const [selectedStandard, setSelectedStandard] = useState<Standard>(Standard.ERC20);
  const [isOpenedFee, setIsOpenedFee] = useState(false);
  const [isEditApproveActive, setIsEditApproveActive] = useState(false);
  const [amountToApprove, setAmountToApprove] = useState("");
  const chainId = useCurrentChainId();

  const {
    redErc20Balance,
    redErc223Balance,
    approve,
    stake,
    stakeERC223,
    unstake,
    refetchUserData,
    canUnstake,
    userStaked,
    userStakedErc20,
    userStakedErc223,
    minStake,
    unstakeAll,
    isCorrectNetwork,
    isRevenueDeployed,
    stakingTokenERC20,
    stakingTokenERC223,
    claimDelay,
    hasStaked,
  } = useRevenueContract();

  // claim_delay is configurable per deployment (10 days on mainnet, 5 minutes on Sepolia),
  // so format whatever the chain returns and show nothing until it has loaded.
  const lockDuration =
    typeof claimDelay === "bigint"
      ? formatDuration(Number(claimDelay), (unit, count) => t(durationMessageKey[unit], { count }))
      : null;

  const {
    isPendingApprove,
    isLoadingApprove,
    isPendingStake,
    isLoadingStake,
    isSuccessStake,
    isRevertedStake,
    isSettledStake,
    isRevertedApprove,
  } = useStakeStatus();

  const {
    gasPriceOption,
    gasPriceSettings,
    setGasPriceOption,
    setGasPriceSettings,
    updateDefaultState,
  } = useStakeGasPriceStore();

  const { estimatedGas, customGasLimit, setEstimatedGas, setCustomGasLimit } =
    useStakeGasLimitStore();

  const { isAdvanced, setIsAdvanced } = useStakeGasModeStore();

  const { baseFee, gasPrice } = useGlobalFees();

  // Dynamic gas limit estimation based on selected standard

  const gasToUse = customGasLimit || estimatedGas;

  const formattedGasPrice = useMemo(() => {
    return getFormattedGasPrice({
      baseFee,
      chainId,
      gasPrice,
      gasPriceOption,
      gasPriceSettings,
    });
  }, [baseFee, chainId, gasPrice, gasPriceOption, gasPriceSettings]);

  // Dynamic gas display values (similar to swap module pattern)
  const gasERC20Display = useMemo(() => {
    if (!amount || parseFloat(amount) === 0) {
      return "—";
    }
    const gasInK = Math.round(Number(estimatedGas) / 1000);
    return `~${gasInK}K gas`;
  }, [amount, estimatedGas]);

  const gasERC223Display = useMemo(() => {
    if (!amount || parseFloat(amount) === 0) {
      return "—";
    }
    const gasInK = Math.round(Number(estimatedGas) / 1000);
    return `~${gasInK}K gas`;
  }, [amount, estimatedGas]);

  useEffect(() => {
    if (isOpen && storeAmount) {
      setAmount(storeAmount);
      setAmountToApprove(storeAmount);
      setSelectedStandard(storeStandard === "ERC-223" ? Standard.ERC223 : Standard.ERC20);
    }
  }, [isOpen, storeAmount, storeStandard]);

  useEffect(() => {
    if (amount) {
      setAmountToApprove(amount);
    }
  }, [amount]);

  useEffect(() => {
    if (isOpen) {
      updateDefaultState(chainId);
    }
  }, [chainId, isOpen, updateDefaultState]);

  useEffect(() => {
    if (!isOpen) {
      setAmount("");
    }
  }, [isOpen]);

  const isStaking = dialogType === "stake";
  const title = isStaking ? t("stake_action") : t("unstake_action");

  // RevenueV2 returns each stake in the version it was staked in, so the most a user can
  // unstake in one version is what they staked in it.
  const available0 = isStaking ? redErc20Balance : userStakedErc20;
  const available1 = isStaking ? redErc223Balance : userStakedErc223;
  const balance0 = available0 ? formatUnits(available0, 18) : "0";
  const balance1 = available1 ? formatUnits(available1, 18) : "0";

  const isInsufficientBalance = useMemo(() => {
    if (!amount || parseFloat(amount) <= 0) {
      return false;
    }

    try {
      const amountBigInt = parseUnits(amount, 18);
      const currentBalance = selectedStandard === Standard.ERC20 ? available0 : available1;

      if (!currentBalance) {
        return true;
      }

      return amountBigInt > currentBalance;
    } catch {
      return false;
    }
  }, [amount, selectedStandard, available0, available1]);

  // RevenueV2: every position is 0 or at least min_stake. See the "Revenue" page in the DEX223 Figma file.
  const amountWei = useMemo(() => {
    try {
      return amount && parseFloat(amount) > 0 ? parseUnits(amount, 18) : 0n;
    } catch {
      return 0n;
    }
  }, [amount]);
  const stakedTotal = typeof userStaked === "bigint" ? userStaked : 0n;
  const minStakeError = useMemo(() => {
    if (typeof minStake !== "bigint" || amountWei === 0n) return null;
    if (isStaking) {
      return stakedTotal + amountWei < minStake ? "stake" : null;
    }
    if (amountWei >= stakedTotal) return null;
    return stakedTotal - amountWei < minStake ? "remainder" : null;
  }, [minStake, amountWei, isStaking, stakedTotal]);
  // Both version parts below the minimum: withdraw() can take neither, only withdraw_all() closes it.
  const isSplitBelowMinimum =
    !isStaking &&
    typeof minStake === "bigint" &&
    typeof userStakedErc20 === "bigint" &&
    typeof userStakedErc223 === "bigint" &&
    userStakedErc20 > 0n &&
    userStakedErc223 > 0n &&
    userStakedErc20 < minStake &&
    userStakedErc223 < minStake;
  const minStakeDisplay = typeof minStake === "bigint" ? formatUnits(minStake, 18) : "1";
  const stakedTotalDisplay = formatUnits(stakedTotal, 18);

  const isProcessing = useMemo(() => {
    return (
      isPendingStake ||
      isLoadingStake ||
      isSettledStake ||
      isLoadingApprove ||
      isPendingApprove ||
      isRevertedApprove
    );
  }, [
    isLoadingApprove,
    isLoadingStake,
    isPendingApprove,
    isPendingStake,
    isRevertedApprove,
    isSettledStake,
  ]);

  const handleUnstakeAll = useCallback(async () => {
    if (!connectedAddress) {
      setWalletConnectOpened(true);
      return;
    }
    if (!isCorrectNetwork) {
      setStatus(StakeStatus.ERROR);
      setErrorType(StakeError.UNKNOWN);
      setErrorMessage(t("switch_network"));
      return;
    }
    if (!canUnstake) {
      setStatus(StakeStatus.ERROR);
      setErrorType(StakeError.LOCKED_TOKENS);
      setErrorMessage(t("tokens_locked"));
      return;
    }
    setStatus(StakeStatus.PENDING);
    try {
      const result = await unstakeAll(gasPriceSettings, undefined, (hash) => {
        setStakeHash(hash);
        setStatus(StakeStatus.LOADING);
      });
      if (result?.hash) {
        setStakeHash(result.hash);
        if (result.receipt) {
          setStatus(StakeStatus.SUCCESS);
          await refetchUserData();
          addToast(t("success_unstaked_toast", { amount: stakedTotalDisplay }), "success");
        }
      }
    } catch (error: any) {
      console.error("Unstake all error:", error);
      const { type, message } = describeTxError(error, t("unstake_failed"));
      setStatus(StakeStatus.ERROR);
      setErrorType(type);
      setErrorMessage(message);
    }
  }, [
    connectedAddress,
    isCorrectNetwork,
    canUnstake,
    unstakeAll,
    gasPriceSettings,
    refetchUserData,
    stakedTotalDisplay,
    setStatus,
    setErrorType,
    setErrorMessage,
    setStakeHash,
    setWalletConnectOpened,
    describeTxError,
    t,
  ]);

  const handleStakeUnstake = useCallback(async () => {
    try {
      if (!isRevenueDeployed) {
        setStatus(StakeStatus.ERROR);
        setErrorType(StakeError.UNKNOWN);
        setErrorMessage(t("not_deployed"));
        return;
      }

      if (!connectedAddress) {
        setWalletConnectOpened(true);
        return;
      }

      if (!isCorrectNetwork) {
        setStatus(StakeStatus.ERROR);
        setErrorType(StakeError.UNKNOWN);
        setErrorMessage(t("switch_network"));
        return;
      }

      if (!amount || parseFloat(amount) <= 0) {
        setStatus(StakeStatus.ERROR);
        setErrorType(StakeError.UNKNOWN);
        setErrorMessage(t("invalid_amount"));
        return;
      }

      const amountBigInt = parseUnits(amount, 18);
      const amountToApproveBigInt = parseUnits(amountToApprove || amount, 18);

      if (isStaking) {
        const currentBalance =
          selectedStandard === Standard.ERC20 ? redErc20Balance : redErc223Balance;
        if (!currentBalance || amountBigInt > currentBalance) {
          setStatus(StakeStatus.ERROR);
          setErrorType(StakeError.INSUFFICIENT_BALANCE);
          setErrorMessage(tSwap("insufficient_balance"));
          return;
        }

        // Handle ERC20 approval
        if (selectedStandard === Standard.ERC20) {
          setStatus(StakeStatus.PENDING_APPROVE);
          try {
            // The hash arrives before the receipt, so the loading row (and speed up) shows
            // while the approval is being mined.
            const approveResult = await approve(
              amountToApproveBigInt,
              gasPriceSettings,
              gasToUse,
              (hash) => {
                setApproveHash(hash);
                setStatus(StakeStatus.LOADING_APPROVE);
              },
            );
            if (approveResult?.hash) {
              setApproveHash(approveResult.hash);
            }
          } catch (error: any) {
            console.error("Approval error:", error);
            const { type, message } = describeTxError(error, t("approval_failed"));
            setStatus(StakeStatus.APPROVE_ERROR);
            setErrorType(type);
            setErrorMessage(message);
            return;
          }
        }

        // Execute stake
        setStatus(selectedStandard === Standard.ERC223 ? StakeStatus.PENDING : StakeStatus.PENDING);
        try {
          const onStakeHash = (hash: Address) => {
            setStakeHash(hash);
            setStatus(StakeStatus.LOADING);
          };
          let stakeResult;
          if (selectedStandard === Standard.ERC20) {
            stakeResult = await stake(amountBigInt, gasPriceSettings, gasToUse, onStakeHash);
          } else {
            stakeResult = await stakeERC223(amountBigInt, gasPriceSettings, gasToUse, onStakeHash);
          }

          if (stakeResult?.hash) {
            setStakeHash(stakeResult.hash);

            // executeTransaction resolves only after a successful receipt
            if (stakeResult.receipt) {
              setStatus(StakeStatus.SUCCESS);
              await refetchUserData();
              addToast(t("success_staked_toast", { amount }), "success");
            }
          }
        } catch (error: any) {
          console.error("Stake error:", error);
          const { type, message } = describeTxError(error, t("stake_failed"));
          setStatus(StakeStatus.ERROR);
          setErrorType(type);
          setErrorMessage(message);
        }
      } else {
        // Unstaking logic
        if (!canUnstake) {
          setStatus(StakeStatus.ERROR);
          setErrorType(StakeError.LOCKED_TOKENS);
          setErrorMessage(t("tokens_locked"));
          return;
        }

        if (!userStaked || typeof userStaked !== "bigint" || amountBigInt > userStaked) {
          setStatus(StakeStatus.ERROR);
          setErrorType(StakeError.INSUFFICIENT_BALANCE);
          setErrorMessage(t("insufficient_staked"));
          return;
        }

        const stakedInVersion =
          selectedStandard === Standard.ERC223 ? userStakedErc223 : userStakedErc20;
        if (stakedInVersion === undefined || amountBigInt > stakedInVersion) {
          setStatus(StakeStatus.ERROR);
          setErrorType(StakeError.INSUFFICIENT_BALANCE);
          setErrorMessage(
            t("staked_in_version_only", {
              amount: formatUnits(stakedInVersion ?? 0n, 18),
              standard: selectedStandard,
            }),
          );
          return;
        }

        setStatus(StakeStatus.PENDING);
        try {
          // RevenueV2 pays withdraw() in the version passed, out of what was staked in it.
          const withdrawToken =
            selectedStandard === Standard.ERC223 ? stakingTokenERC223 : stakingTokenERC20;
          const unstakeResult = await unstake(
            withdrawToken,
            amountBigInt,
            gasPriceSettings,
            gasToUse,
            selectedStandard,
            (hash) => {
              setStakeHash(hash);
              setStatus(StakeStatus.LOADING);
            },
          );
          if (unstakeResult?.hash) {
            setStakeHash(unstakeResult.hash);

            // executeTransaction resolves only after a successful receipt
            if (unstakeResult.receipt) {
              setStatus(StakeStatus.SUCCESS);
              await refetchUserData();
              addToast(t("success_unstaked_toast", { amount }), "success");
            }
          }
        } catch (error: any) {
          console.error("Unstake error:", error);
          const { type, message } = describeTxError(error, t("unstake_failed"));
          setStatus(StakeStatus.ERROR);
          setErrorType(type);
          setErrorMessage(message);
        }
      }
    } catch (error: any) {
      console.error("Transaction error:", error);
      setStatus(StakeStatus.ERROR);
      setErrorType(StakeError.UNKNOWN);
      setErrorMessage(error.message || t("tx_failed_retry"));
    }
  }, [
    amountToApprove,
    isCorrectNetwork,
    isRevenueDeployed,
    stakingTokenERC20,
    stakingTokenERC223,
    amount,
    isStaking,
    selectedStandard,
    redErc20Balance,
    redErc223Balance,
    canUnstake,
    userStaked,
    userStakedErc20,
    userStakedErc223,
    approve,
    stake,
    stakeERC223,
    unstake,
    refetchUserData,
    setStatus,
    setErrorType,
    setErrorMessage,
    setApproveHash,
    setStakeHash,
    gasPriceSettings,
    gasToUse,
    connectedAddress,
    setWalletConnectOpened,
    describeTxError,
  ]);

  useEffect(() => {
    if ((isSuccessStake || isRevertedStake || isRevertedApprove) && !isOpen) {
      setTimeout(() => {
        setStatus(StakeStatus.INITIAL);
      }, 400);
    }
  }, [isSuccessStake, isRevertedStake, isRevertedApprove, isOpen, setStatus]);

  const { price } = useUSDPrice(
    selectedStandard === Standard.ERC20 ? stakingTokenERC20 : stakingTokenERC223,
  );

  const calculateUSDValue = useMemo(() => {
    if (!amount || parseFloat(amount) === 0) return "0.00";
    const tokenPrice = price || 0;
    return (parseFloat(amount) * tokenPrice).toFixed(2);
  }, [amount, price]);

  function StakeActionButton() {
    if (!amount || parseFloat(amount) === 0) {
      return (
        <Button fullWidth disabled size={ButtonSize.LARGE} colorScheme={ButtonColor.GREEN}>
          {tSwap("enter_amount")}
        </Button>
      );
    }

    if (isPendingApprove) {
      return (
        <Rows>
          <ApproveRow isPending />
          <StakeRow isDisabled isStaking={isStaking} />
        </Rows>
      );
    }

    if (isLoadingApprove) {
      return (
        <Rows>
          <ApproveRow hash={approveHash} isLoading />
          <StakeRow isDisabled isStaking={isStaking} />
        </Rows>
      );
    }

    if (isRevertedApprove) {
      return (
        <>
          <Rows>
            <ApproveRow hash={approveHash} isReverted />
            <StakeRow isDisabled isStaking={isStaking} />
          </Rows>
          <div className="flex flex-col gap-4 mt-4 md:mt-5">
            <div className="bg-red-light/10 border border-red-light/30 rounded-3 p-3 md:p-4">
              <p className="text-12 md:text-14 text-secondary-text break-words">
                {errorType === StakeError.OUT_OF_GAS || !errorMessage ? (
                  <>
                    {t("gas_too_low_hint")}{" "}
                    {t.rich("still_have_issues_discord", {
                      discord: (chunks) => (
                        <a
                          href="https://discord.gg/t5bdeGC5Jk"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-secondary-text underline"
                        >
                          {chunks}
                        </a>
                      ),
                    })}
                  </>
                ) : (
                  errorMessage
                )}
              </p>
            </div>
            <Button
              fullWidth
              size={ButtonSize.LARGE}
              colorScheme={ButtonColor.GREEN}
              onClick={() => {
                setStatus(StakeStatus.INITIAL);
              }}
            >
              {tLiq("try_again")}
            </Button>
          </div>
        </>
      );
    }

    if (isPendingStake) {
      return (
        <Rows>
          {isStaking && selectedStandard === Standard.ERC20 && (
            <ApproveRow hash={approveHash} isSuccess />
          )}
          <StakeRow isPending isStaking={isStaking} />
        </Rows>
      );
    }

    if (isLoadingStake) {
      return (
        <Rows>
          {isStaking && selectedStandard === Standard.ERC20 && (
            <ApproveRow hash={approveHash} isSuccess />
          )}
          <StakeRow hash={stakeHash} isLoading isStaking={isStaking} />
        </Rows>
      );
    }

    if (isSuccessStake) {
      return (
        <Rows>
          {isStaking && selectedStandard === Standard.ERC20 && (
            <ApproveRow hash={approveHash} isSuccessStake />
          )}
          <StakeRow hash={stakeHash} isSettled isSuccess isStaking={isStaking} />
        </Rows>
      );
    }

    if (isRevertedStake) {
      return (
        <>
          <Rows>
            {isStaking && selectedStandard === Standard.ERC20 && (
              <ApproveRow hash={approveHash} isSuccess />
            )}
            <StakeRow hash={stakeHash} isSettled isReverted isStaking={isStaking} />
          </Rows>
          <div className="flex flex-col gap-4 mt-4 md:mt-5">
            <div className="bg-red-light/10 border border-red-light/30 rounded-3 p-3 md:p-4 overflow-hidden">
              <p className="text-12 md:text-14 text-secondary-text break-words overflow-wrap break-all">
                {errorMessage || t("gas_too_low_hint")}
                {(!errorMessage || errorType === StakeError.OUT_OF_GAS) && (
                  <>
                    {" "}
                    {t.rich("still_have_issues_discord", {
                      discord: (chunks) => (
                        <a
                          href="https://discord.gg/t5bdeGC5Jk"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-secondary-text underline"
                        >
                          {chunks}
                        </a>
                      ),
                    })}
                  </>
                )}
              </p>
            </div>
            <Button
              fullWidth
              size={ButtonSize.LARGE}
              colorScheme={ButtonColor.GREEN}
              onClick={() => {
                setStatus(StakeStatus.INITIAL);
              }}
            >
              {tLiq("try_again")}
            </Button>
          </div>
        </>
      );
    }

    if (isSplitBelowMinimum) {
      return (
        <Button
          fullWidth
          size={ButtonSize.LARGE}
          colorScheme={ButtonColor.GREEN}
          onClick={handleUnstakeAll}
          disabled={!canUnstake}
        >
          {t("unstake_all", { amount: stakedTotalDisplay })}
        </Button>
      );
    }

    const mainButton = (
      <Button
        fullWidth
        size={ButtonSize.LARGE}
        colorScheme={ButtonColor.GREEN}
        onClick={handleStakeUnstake}
        disabled={
          !amount ||
          parseFloat(amount) === 0 ||
          (!isStaking && !canUnstake) ||
          isInsufficientBalance ||
          isEditApproveActive ||
          minStakeError !== null
        }
      >
        {title}
      </Button>
    );

    if (minStakeError === "remainder") {
      return (
        <div className="flex gap-3">
          <Button
            fullWidth
            size={ButtonSize.LARGE}
            colorScheme={ButtonColor.LIGHT_GREEN}
            onClick={handleUnstakeAll}
            disabled={!canUnstake}
          >
            {t("unstake_all", { amount: stakedTotalDisplay })}
          </Button>
          {mainButton}
        </div>
      );
    }

    return mainButton;
  }

  const renderInitialState = () => {
    return (
      <div className="space-y-4">
        {isStaking && lockDuration && (
          <Alert
            type="warning"
            text={
              <div className="flex items-start gap-2">
                <span className="text-14">
                  {t.rich("lock_notice", {
                    time: lockDuration,
                    b: (chunks) => <span className="font-medium">{chunks}</span>,
                  })}
                  {hasStaked && ` ${t("restake_restarts")}`}
                </span>
              </div>
            }
          />
        )}

        {isSplitBelowMinimum && (
          <Alert
            type="info"
            text={
              <span className="text-14">
                {t("split_position_notice", {
                  total: stakedTotalDisplay,
                  erc20: formatUnits(userStakedErc20 ?? 0n, 18),
                  erc223: formatUnits(userStakedErc223 ?? 0n, 18),
                })}
              </span>
            }
          />
        )}

        {/* Stake amount section */}
        <div className="p-5 bg-secondary-bg rounded-3 relative">
          <div className="flex justify-between items-center mb-5 h-[22px]">
            <span className="text-14 block text-secondary-text">
              {isStaking ? t("stake_amount") : t("unstake_amount")}
            </span>
          </div>

          <div className="flex items-center mb-5 justify-between">
            <div>
              <NumericFormat
                allowedDecimalSeparators={[","]}
                decimalScale={18}
                inputMode="decimal"
                placeholder="0"
                className={clsx(
                  "h-12 bg-transparent outline-0 border-0 text-32 w-full peer placeholder:text-tertiary-text",
                )}
                type="text"
                value={amount}
                onValueChange={(values) => {
                  setAmount(values.value);
                }}
                allowNegative={false}
              />
              <span className="text-12 block -mt-1 text-tertiary-text">${calculateUSDValue}</span>
              <div
                className={clsxMerge(
                  "duration-200 rounded-3 pointer-events-none absolute w-full h-full border border-transparent peer-hocus:shadow peer-focus:shadow top-0 left-0",
                  "peer-hocus:shadow-green/60 peer-focus:shadow-green/60 peer-focus:border-green",
                  isInsufficientBalance &&
                    "shadow-red-light/60 border-red-light shadow peer-hocus:shadow-red-light/60 peer-focus:shadow peer-focus:shadow-red-light/60 peer-focus:border-red-light",
                )}
              />
            </div>
            <div className="group flex items-center gap-2 duration-200 text-base text-primary-text bg-primary-bg rounded-[80px] border border-transparent px-3 py-2 min-h-12 flex-shrink-0">
              <Image
                src="/images/logo-short.svg"
                width={32}
                height={32}
                alt="D223"
                className="w-8 h-8 flex-shrink-0"
              />
              <span className="text-16 font-medium whitespace-nowrap">D223</span>
            </div>
          </div>

          <TokenStandardSelector
            selectedStandard={selectedStandard}
            handleStandardSelect={setSelectedStandard}
            disabled={false}
            symbol="D223"
            balance0={balance0}
            balance1={balance1}
            gasERC20={gasERC20Display}
            gasERC223={gasERC223Display}
            colorScheme={ThemeColors.GREEN}
            allowedErc223={true}
          />
        </div>
        {isInsufficientBalance && (
          <div className="mt-3">
            <HelperText error={tSwap("insufficient_balance")} />
          </div>
        )}
        {!isInsufficientBalance && minStakeError === "stake" && (
          <p className="text-12 text-red-light">{t("min_stake_error", { min: minStakeDisplay })}</p>
        )}
        {!isInsufficientBalance && minStakeError === "remainder" && (
          <p className="text-12 text-red-light">
            {t("unstake_remainder_error", {
              remaining: formatUnits(stakedTotal - amountWei, 18),
              min: minStakeDisplay,
            })}
          </p>
        )}
        {isStaking &&
          !minStakeError &&
          !isInsufficientBalance &&
          (!amount || parseFloat(amount) === 0) && (
            <p className="text-12 text-secondary-text">
              {t("min_stake_hint", { min: minStakeDisplay })}
            </p>
          )}

        {/* Approve amount section - only show for ERC-20 staking */}
        {isStaking && selectedStandard === Standard.ERC20 && (
          <div
            className={clsx(
              "bg-tertiary-bg rounded-3 flex items-center px-4 md:px-5 py-2 min-h-12 gap-2 md:gap-3",
              +amountToApprove < +amount && "md:pb-[26px]",
            )}
          >
            <div className="md:items-center md:justify-between md:gap-5 flex-grow flex flex-col gap-1 md:flex-row">
              <div className="flex items-center gap-1 md:gap-1.5 text-secondary-text whitespace-nowrap md:flex-row-reverse">
                <span className="text-12 md:text-14">{t("approve_amount")}</span>
                <Tooltip iconSize={16} text={t("approve_tooltip")} />
              </div>

              {!isEditApproveActive ? (
                <span className="text-12 md:text-14">{amountToApprove || "0"} D223</span>
              ) : (
                <div className="flex-grow">
                  <div className="relative w-full flex-grow">
                    <NumericFormat
                      inputMode="decimal"
                      allowedDecimalSeparators={[","]}
                      className={clsx(
                        "h-8 pl-3 pr-14 text-14",
                        +amountToApprove < +amount && "border-red-light focus:border-red-light",
                      )}
                      value={amountToApprove}
                      onValueChange={(values) => {
                        setAmountToApprove(values.value);
                      }}
                      customInput={Input}
                      allowNegative={false}
                      type="text"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-tertiary-text text-14">
                      D223
                    </span>
                  </div>
                  {+amountToApprove < +amount && (
                    <span className="text-red-light md:absolute text-12 md:translate-y-0.5">
                      {tLiq("must_be_at_least", { val: amount })}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center flex-shrink-0">
              {!isEditApproveActive ? (
                <Button
                  size={ButtonSize.EXTRA_SMALL}
                  colorScheme={ButtonColor.LIGHT_GREEN}
                  onClick={() => setIsEditApproveActive(true)}
                  className="!rounded-20"
                >
                  {t("edit")}
                </Button>
              ) : (
                <Button
                  disabled={+amountToApprove < +amount}
                  size={ButtonSize.EXTRA_SMALL}
                  colorScheme={ButtonColor.LIGHT_GREEN}
                  onClick={() => setIsEditApproveActive(false)}
                  className="!rounded-20 disabled:bg-quaternary-bg"
                >
                  {t("save")}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Gas price and network fee section */}
        <GasSettingsBlock
          customGasLimit={customGasLimit}
          estimatedGas={estimatedGas}
          formattedGasPrice={formattedGasPrice}
          handleClick={() => setIsOpenedFee(true)}
        />
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <DrawerDialog isOpen={isOpen} setIsOpen={closeDialog}>
        <div className="bg-primary-bg rounded-5 w-full md:w-[600px] max-md:rounded-t-5 max-md:rounded-b-none">
          <DialogHeader onClose={closeDialog} title={title} />
          <div className="card-spacing max-md:px-4 max-md:pb-6">
            {!isSettledStake && !isRevertedApprove && !isProcessing && renderInitialState()}

            {isProcessing && !isSettledStake && !isRevertedApprove && (
              <>
                <div className="flex flex-col gap-3">
                  <div className="rounded-3 bg-tertiary-bg py-4 px-4 md:px-5 flex flex-col gap-1">
                    <p className="text-secondary-text text-14">
                      {isStaking ? t("stake_amount") : t("unstake_amount")}
                    </p>
                    <div className="flex justify-between items-start md:items-center gap-2">
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-24 md:text-32 text-primary-text break-words">
                          {amount || "0"}
                        </span>
                        <p className="text-secondary-text text-12 md:text-14">
                          ${calculateUSDValue}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
                        <div className="w-7 h-7 md:w-8 md:h-8 bg-primary-bg rounded-full flex items-center justify-center flex-shrink-0">
                          <Image
                            src="/images/logo-short.svg"
                            alt="D223"
                            width={14}
                            height={14}
                            className="md:w-4 md:h-4"
                          />
                        </div>
                        <span className="text-14 md:text-16 font-medium text-primary-text whitespace-nowrap">
                          D223
                        </span>
                        <Image
                          src={
                            selectedStandard === Standard.ERC20
                              ? "/images/badges/erc-20-green-small.svg"
                              : "/images/badges/erc-223-green-small.svg"
                          }
                          alt={tSwap("standard")}
                          width={40}
                          height={40}
                          className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="h-px w-full bg-secondary-border mb-4 mt-5" />
              </>
            )}

            {(isSettledStake || isRevertedApprove) && (
              <div>
                <div className="flex flex-col items-center py-3 md:py-4">
                  {/* Success Icon */}
                  {isSuccessStake && (
                    <div className="mx-auto w-[64px] h-[64px] md:w-[80px] md:h-[80px] flex items-center justify-center relative mb-4 md:mb-5">
                      <div className="w-[40px] h-[40px] md:w-[54px] md:h-[54px] rounded-full border-[5px] md:border-[7px] blur-[6px] md:blur-[8px] opacity-80 border-green" />
                      <Svg
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-green"
                        iconName="success"
                        size={52}
                      />
                    </div>
                  )}

                  {/* Error Icon */}
                  {(isRevertedStake || isRevertedApprove) && (
                    <div className="flex items-center justify-center mb-4 md:mb-5">
                      <Svg className="text-red-light" iconName="warning" size={52} />
                    </div>
                  )}

                  {/* Status Text */}
                  <h3
                    className={clsx(
                      "text-16 md:text-18 xl:text-20 font-bold mb-2 text-center px-2",
                      isSuccessStake && "text-primary-text",
                      (isRevertedStake || isRevertedApprove) && "text-red-light",
                    )}
                  >
                    {isSuccessStake && (isStaking ? t("success_staked") : t("success_unstaked"))}
                    {isRevertedStake && (isStaking ? t("failed_stake") : t("failed_unstake"))}
                    {isRevertedApprove && t("approve_failed")}
                  </h3>

                  {/* Amount */}
                  <p className="text-14 md:text-16 text-primary-text mb-4 md:mb-6">{amount} D223</p>
                </div>

                <div className="h-px w-full bg-secondary-border" />
              </div>
            )}
            <div className="mt-4 md:mt-5">
              <StakeActionButton />
            </div>
          </div>
        </div>
      </DrawerDialog>
      <NetworkFeeConfigDialog
        isAdvanced={isAdvanced}
        setIsAdvanced={setIsAdvanced}
        estimatedGas={estimatedGas > BigInt(0) ? estimatedGas : gasToUse}
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
    </>
  );
};

export default StakeDialog;
