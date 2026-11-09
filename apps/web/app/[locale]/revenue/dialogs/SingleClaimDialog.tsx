"use client";

import Preloader from "@repo/ui/preloader";
import Image from "next/image";
import { useTranslations } from "next-intl";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Address, isAddress } from "viem";
import { useAccount } from "wagmi";

import DialogHeader from "@/components/atoms/DialogHeader";
import DrawerDialog from "@/components/atoms/DrawerDialog";
import Svg from "@/components/atoms/Svg";
import Badge, { BadgeVariant } from "@/components/badges/Badge";
import Button, { ButtonColor, ButtonSize, ButtonVariant } from "@/components/buttons/Button";
import IconButton from "@/components/buttons/IconButton";
import Erc223ReceiveWarning from "@/components/common/Erc223ReceiveWarning";
import GasSettingsBlock from "@/components/common/GasSettingsBlock";
import NetworkFeeConfigDialog from "@/components/dialogs/NetworkFeeConfigDialog";
import { useTransactionSpeedUpDialogStore } from "@/components/dialogs/stores/useTransactionSpeedUpDialogStore";
import { getFormattedGasPrice } from "@/functions/gasSettings";
import getExplorerLink, { ExplorerLinkType } from "@/functions/getExplorerLink";
import useCanReceiveERC223 from "@/hooks/useCanReceiveERC223";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { addNotification } from "@/other/notification";
import { Standard } from "@/sdk_bi/standard";
import { useGlobalFees } from "@/shared/hooks/useGlobalFees";
import { useConfirmInWalletAlertStore } from "@/stores/useConfirmInWalletAlertStore";
import {
  RecentTransactionStatus,
  RecentTransactionTitleTemplate,
} from "@/stores/useRecentTransactionsStore";

import useRecentTransactionByHash from "../hooks/useRecentTransactionByHash";
import useRevenueContract from "../hooks/useRevenueContract";
import { useClaimDialogStore } from "../stores/useClaimDialogStore";
import {
  useClaimGasLimitStore,
  useClaimGasModeStore,
  useClaimGasPriceStore,
} from "../stores/useClaimGasSettingsStore";

const SingleClaimDialog = () => {
  const t = useTranslations("Revenue");
  const tSwap = useTranslations("Swap");
  const tLiq = useTranslations("Liquidity");
  const { isOpen, state, data, closeDialog, setState, setError, setData, setClaimTransactionHash } =
    useClaimDialogStore();
  const chainId = useCurrentChainId();
  const { openConfirmInWalletAlert, closeConfirmInWalletAlert } = useConfirmInWalletAlertStore();
  const { claim, refetchUserData, canUnstake, unstakeCountdown } = useRevenueContract();
  const claimRecentTransaction = useRecentTransactionByHash(data?.claimTransactionHash);
  const { handleSpeedUp } = useTransactionSpeedUpDialogStore();

  const [isOpenedFee, setIsOpenedFee] = useState(false);

  const {
    gasPriceOption,
    gasPriceSettings,
    setGasPriceOption,
    setGasPriceSettings,
    updateDefaultState,
  } = useClaimGasPriceStore();

  const { estimatedGas, customGasLimit, setEstimatedGas, setCustomGasLimit } =
    useClaimGasLimitStore();

  const { isAdvanced, setIsAdvanced } = useClaimGasModeStore();

  const { baseFee, gasPrice } = useGlobalFees();

  const formattedGasPrice = useMemo(() => {
    return getFormattedGasPrice({
      baseFee,
      chainId,
      gasPrice,
      gasPriceOption,
      gasPriceSettings,
    });
  }, [baseFee, chainId, gasPrice, gasPriceOption, gasPriceSettings]);

  const notificationShownRef = useRef<string | null>(null);

  // Get token from data
  const token = data?.selectedTokens[0];
  const claimAddresses = (token?.claimAddresses ?? []).filter((a) => isAddress(a)) as Address[];
  const { address: connectedAddress } = useAccount();
  const canReceiveERC223 = useCanReceiveERC223(connectedAddress);
  // Revenue pays each token in the version it holds; any ERC-223 part arrives as ERC-223, which a
  // smart account (EIP-7702) can't receive.
  const deliversErc223 = claimAddresses.some(
    (a) => a.toLowerCase() !== token?.fullErc20Address?.toLowerCase(),
  );
  const cannotReceive = deliversErc223 && !canReceiveERC223;
  const selectedStandard =
    claimAddresses.length === 1 &&
    claimAddresses[0].toLowerCase() === token?.fullErc20Address?.toLowerCase()
      ? Standard.ERC20
      : Standard.ERC223;

  useEffect(() => {
    if (isOpen) {
      updateDefaultState(chainId);
    }
  }, [chainId, isOpen, updateDefaultState]);

  // Show/hide bottom alert for confirming states
  useEffect(() => {
    if (state === "confirming-claim" && isOpen) {
      openConfirmInWalletAlert(t("confirm_wallet"));
    } else {
      closeConfirmInWalletAlert();
    }

    return () => {
      closeConfirmInWalletAlert();
    };
  }, [state, isOpen, openConfirmInWalletAlert, closeConfirmInWalletAlert]);

  // Show notifications for success/error states
  useEffect(() => {
    if (!data || data.isMultiple || (state !== "success" && state !== "error")) {
      notificationShownRef.current = null;
      return;
    }

    const token = data.selectedTokens?.[0];
    if (!token) return;

    // Prevent duplicate notifications
    const notificationKey = `${state}-${token.symbol}-${token.amount}`;
    if (notificationShownRef.current === notificationKey) return;
    notificationShownRef.current = notificationKey;

    const notificationTitle: {
      template: RecentTransactionTitleTemplate.WITHDRAW;
      standard: Standard;
      symbol: string;
      amount: string;
      logoURI: string;
    } = {
      template: RecentTransactionTitleTemplate.WITHDRAW,
      standard: data.selectedStandard === "ERC-20" ? Standard.ERC20 : Standard.ERC223,
      symbol: token.symbol,
      amount: token.amount,
      logoURI: token.logoURI || "/images/tokens/placeholder.svg",
    };

    if (state === "success") {
      addNotification(notificationTitle, RecentTransactionStatus.SUCCESS);
    } else if (state === "error") {
      addNotification(notificationTitle, RecentTransactionStatus.ERROR);
    }
  }, [state, data]);

  // Only show this dialog for single token claims
  if (!isOpen || !data || data.isMultiple) return null;

  if (!token) return null;

  const handleClaim = async () => {
    if (!token) {
      setError(t("token_missing"));
      return;
    }

    try {
      if (!canUnstake) {
        setError(
          unstakeCountdown
            ? `Rewards stay locked for ${unstakeCountdown} after the last stake.`
            : t("rewards_locked"),
        );
        return;
      }

      if (claimAddresses.length === 0) {
        setError(t("nothing_claimable"));
        return;
      }

      setData({ selectedStandard: selectedStandard === Standard.ERC20 ? "ERC-20" : "ERC-223" });

      // Fees reach the contract through the factory owner's collectProtocol call, so there
      // is no delivery step here: RevenueV1.delivery() reverts unless Revenue owns the factory.
      setState("confirming-claim");

      const claimResult = await claim(
        claimAddresses,
        gasPriceSettings,
        customGasLimit || estimatedGas,
        selectedStandard,
        (hash) => {
          setClaimTransactionHash(hash);
          setState("executing-claim");
        },
      );

      if (claimResult?.hash) {
        setClaimTransactionHash(claimResult.hash);
      }

      // Success!
      setState("success");

      // Refetch user data to update balances
      await refetchUserData();
    } catch (error: any) {
      console.error("Claim error:", error);
      const errorMessage = error?.message || t("unexpected_error");
      setError(errorMessage);
    }
  };

  const handleTryAgain = () => {
    setState("initial");
  };

  const renderInitialState = () => {
    return (
      <div className="space-y-4">
        <div className="bg-tertiary-bg rounded-3 px-4 py-3 md:h-12 md:py-0 flex items-center min-h-[48px]">
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <span className="text-tertiary-text text-14 whitespace-nowrap">
              {t("rewards_to_receive")}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <Image
                src={token.logoURI || "/images/tokens/placeholder.svg"}
                width={24}
                height={24}
                alt={token.symbol}
                className="w-6 h-6 flex-shrink-0"
              />
              <span className="text-primary-text text-16 font-medium whitespace-nowrap">
                {token.amount} {token.symbol}
              </span>
              <span className="text-secondary-text text-14 whitespace-nowrap">
                {token.amountUSD !== "-" && `(${token.amountUSD})`}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-tertiary-bg rounded-3 p-4">
          <p className="text-secondary-text text-14 mb-3">
            {t("paid_in_standard_single", { symbol: token.symbol })}
          </p>
          <div className="flex gap-2">
            {[
              [Standard.ERC20, token.amountERC20],
              [Standard.ERC223, token.amountERC223],
            ].map(([standard, amount]) => (
              <div
                key={standard}
                className="flex-1 h-10 px-4 rounded-2 text-14 bg-quaternary-bg border border-secondary-border text-secondary-text flex items-center justify-between gap-2"
              >
                <span>{standard}</span>
                <span className="text-primary-text">{amount ?? "0"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* <GasSettingsBlock
          gasPrice={gasPrice}
          gasLimit={gasToUse}
          gasPriceOption={gasPriceOption}
          onEditClick={() => setIsGasSettingsOpen(true)}
        /> */}

        <GasSettingsBlock
          customGasLimit={customGasLimit}
          estimatedGas={estimatedGas}
          formattedGasPrice={formattedGasPrice}
          handleClick={() => setIsOpenedFee(true)}
        />

        {cannotReceive && <Erc223ReceiveWarning />}

        <Button
          fullWidth
          size={ButtonSize.LARGE}
          colorScheme={ButtonColor.GREEN}
          onClick={handleClaim}
          disabled={!canUnstake || cannotReceive}
        >
          {cannotReceive
            ? tSwap("wallet_cannot_receive_erc223")
            : canUnstake
              ? t("claim_action")
              : t("claim_locked")}
        </Button>
      </div>
    );
  };

  const renderClaimConfirmingState = () => (
    <div className="space-y-5">
      <div className="rounded-3 bg-tertiary-bg py-4 px-4 md:px-5 flex flex-col gap-1 min-h-[88px] justify-center">
        <p className="text-secondary-text text-14 mb-2">{t("claiming_rewards")}</p>
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 md:gap-0">
          <div className="flex flex-col">
            <span className="text-20 font-normal text-primary-text">{token.amount}</span>
            <p className="text-secondary-text text-14">{token.amountUSD}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Image
              src={token.logoURI || "/images/tokens/placeholder.svg"}
              width={32}
              height={32}
              alt={token.symbol}
              className="w-8 h-8 flex-shrink-0"
            />
            <span className="text-primary-text text-16 font-medium whitespace-nowrap">
              {token.symbol}
            </span>
            <Badge variant={BadgeVariant.STANDARD} standard={selectedStandard} size="small" />
          </div>
        </div>
      </div>

      <div className="h-px w-full bg-secondary-border" />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-quaternary-bg rounded-full flex items-center justify-center flex-shrink-0">
            <Svg iconName="collect" size={20} className="text-green" />
          </div>
          <span className="text-primary-text text-14 md:text-16 whitespace-nowrap">
            {t("confirm_claim")}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="max-md:hidden">
            <Preloader type="linear" />
          </div>
          <span className="text-secondary-text text-12 md:text-14 whitespace-nowrap max-md:hidden">
            {tSwap("proceed_in_your_wallet")}
          </span>
          <div className="md:hidden">
            <Preloader size={16} />
          </div>
        </div>
      </div>
    </div>
  );

  const renderClaimExecutingState = () => (
    <div className="space-y-5">
      <div className="rounded-3 bg-tertiary-bg py-4 px-4 md:px-5 flex flex-col gap-1 min-h-[88px] justify-center">
        <p className="text-secondary-text text-14 mb-2">{t("claiming_rewards")}</p>
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 md:gap-0">
          <div className="flex flex-col">
            <span className="text-20 font-normal text-primary-text">{token.amount}</span>
            <p className="text-secondary-text text-14">{token.amountUSD}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Image
              src={token.logoURI || "/images/tokens/placeholder.svg"}
              width={32}
              height={32}
              alt={token.symbol}
              className="w-8 h-8 flex-shrink-0"
            />
            <div className="flex flex-row items-center gap-2">
              <span className="text-primary-text text-16 font-medium whitespace-nowrap">
                {token.symbol}
              </span>
              <Badge variant={BadgeVariant.STANDARD} standard={selectedStandard} size="small" />
            </div>
          </div>
        </div>
      </div>

      <div className="h-px w-full bg-secondary-border" />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-quaternary-bg rounded-full flex items-center justify-center flex-shrink-0">
            <Svg iconName="collect" size={20} className="text-green" />
          </div>
          <span className="text-primary-text text-14 md:text-16 whitespace-nowrap">
            {t("executing_claim")}
          </span>
        </div>
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          {claimRecentTransaction && (
            <Button
              size={ButtonSize.EXTRA_SMALL}
              colorScheme={ButtonColor.LIGHT_GREEN}
              className="max-md:text-10 max-md:px-2 max-md:py-1"
              onClick={() => handleSpeedUp(claimRecentTransaction)}
            >
              {tLiq("speed_up")}
            </Button>
          )}
          <a
            target="_blank"
            rel="noopener noreferrer"
            href={
              data?.claimTransactionHash
                ? getExplorerLink(ExplorerLinkType.TRANSACTION, data.claimTransactionHash, chainId)
                : "#"
            }
          >
            <IconButton iconName="forward" />
          </a>
          <Preloader size={20} />
        </div>
      </div>
    </div>
  );

  const renderSuccessState = () => (
    <div className="space-y-5">
      <div className="flex flex-col items-center py-3 md:py-4">
        <div className="mx-auto w-[64px] h-[64px] md:w-[80px] md:h-[80px] flex items-center justify-center relative mb-4 md:mb-5">
          <div className="w-[40px] h-[40px] md:w-[54px] md:h-[54px] rounded-full border-[5px] md:border-[7px] blur-[6px] md:blur-[8px] opacity-80 border-green" />
          <Svg
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-green"
            iconName="success"
            size={52}
          />
        </div>
        <h3 className="text-16 md:text-20 font-bold text-primary-text mb-2">
          {t("success_claimed")}
        </h3>
        <p className="text-14 md:text-16 text-primary-text mb-4 md:mb-6">
          {token.amount} {token.symbol}
        </p>
      </div>

      <div className="h-px w-full bg-secondary-border" />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-green-bg rounded-full flex items-center justify-center flex-shrink-0">
            <Svg iconName="collect" size={20} className="text-green" />
          </div>
          <span className="text-primary-text text-14 md:text-16 whitespace-nowrap">
            {t("success_claimed")}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            target="_blank"
            rel="noopener noreferrer"
            href={
              data?.claimTransactionHash
                ? getExplorerLink(ExplorerLinkType.TRANSACTION, data.claimTransactionHash, chainId)
                : "#"
            }
          >
            <IconButton iconName="forward" />
          </a>
          <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-green flex items-center justify-center flex-shrink-0">
            <Svg className="text-primary-bg" iconName="check" size={12} />
          </div>
        </div>
      </div>
    </div>
  );

  const renderErrorState = () => (
    <div className="space-y-4 md:space-y-5">
      <div className="flex flex-col items-center py-3 md:py-4">
        <div className="flex items-center justify-center mx-auto mb-4 md:mb-5">
          <Svg className="text-red-light" iconName="warning" size={52} />
        </div>
        <h3 className="text-16 md:text-20 font-bold text-red-light mb-2">{t("claim_failed")}</h3>
        <p className="text-14 md:text-16 text-primary-text mb-4 md:mb-6">
          {token.amount} {token.symbol}
        </p>
      </div>

      <div className="h-px w-full bg-secondary-border" />

      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-red-light/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Svg iconName="collect" size={20} className="text-red-light" />
          </div>
          <span className="text-primary-text text-14 md:text-16 whitespace-nowrap">
            {t("claim_failed")}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <IconButton iconName="forward" />
          <Svg className="text-red-light" iconName="warning" size={18} />
        </div>
      </div>

      <div className="bg-red-light/10 border border-red-light/30 rounded-3 p-3 md:p-4 mb-4">
        <p className="text-12 md:text-14 text-secondary-text break-words">
          {data?.errorMessage || (
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
          )}
        </p>
      </div>

      <Button
        fullWidth
        size={ButtonSize.LARGE}
        colorScheme={ButtonColor.GREEN}
        onClick={handleTryAgain}
      >
        {tLiq("try_again")}
      </Button>
    </div>
  );

  const renderContent = () => {
    switch (state) {
      case "initial":
        return renderInitialState();
      case "confirming-claim":
        return renderClaimConfirmingState();
      case "executing-claim":
        return renderClaimExecutingState();
      case "success":
        return renderSuccessState();
      case "error":
        return renderErrorState();
      default:
        return renderInitialState();
    }
  };

  return (
    <>
      <DrawerDialog isOpen={isOpen} setIsOpen={closeDialog}>
        <div className="bg-primary-bg rounded-5 w-full md:w-[600px] max-md:rounded-t-5 max-md:rounded-b-none">
          <DialogHeader onClose={closeDialog} title={t("claim_action")} />
          <div className="card-spacing max-md:px-4 max-md:pb-6">{renderContent()}</div>
        </div>
      </DrawerDialog>
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
    </>
  );
};

export default SingleClaimDialog;
