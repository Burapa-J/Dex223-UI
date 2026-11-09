"use client";

import "react-loading-skeleton/dist/skeleton.css";

import Checkbox from "@repo/ui/checkbox";
import Preloader from "@repo/ui/preloader";
import clsx from "clsx";
import Image from "next/image";
import { useTranslations } from "next-intl";
import React, { useEffect, useMemo, useState } from "react";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";

import Svg from "@/components/atoms/Svg";
import Button from "@/components/buttons/Button";
import {
  ButtonColor,
  ButtonSize,
  ButtonVariant as ButtonVariantType,
} from "@/components/buttons/Button";
import IconButton, { IconButtonSize, IconButtonVariant } from "@/components/buttons/IconButton";
import NetworkFeeConfigDialog from "@/components/dialogs/NetworkFeeConfigDialog";
import { formatFloat } from "@/functions/formatFloat";
import { getFormattedGasPrice } from "@/functions/gasSettings";
import getExplorerLink, { ExplorerLinkType } from "@/functions/getExplorerLink";
import truncateMiddle from "@/functions/truncateMiddle";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { useGlobalFees } from "@/shared/hooks/useGlobalFees";

import ForwardIcon from "../../../../../../../packages/ui/src/icons/ForwardIcon";
import MultipleClaimDialog from "../../dialogs/MultipleClaimDialog";
import SingleClaimDialog from "../../dialogs/SingleClaimDialog";
import useRevenueContract from "../../hooks/useRevenueContract";
import { useClaimDialogStore } from "../../stores/useClaimDialogStore";
import {
  useClaimGasLimitStore,
  useClaimGasModeStore,
  useClaimGasPriceStore,
} from "../../stores/useClaimGasSettingsStore";

// "-" when the token has no known price.
const usdOf = (item: { amountUSD: string }) => {
  const usd = parseFloat(item.amountUSD.replace(/[$,]/g, ""));
  return Number.isFinite(usd) ? usd : 0;
};

export const Claims = ({
  tableData,
  selectedTokens,
  setSelectedTokens,
  isLoading = false,
  readOnly = false,
}: {
  tableData: any;
  selectedTokens: Set<string>;
  setSelectedTokens: (tokenId: string) => void;
  isLoading?: boolean;
  readOnly?: boolean;
}) => {
  const t = useTranslations("Revenue");
  const {
    openDialog,
    state: claimState,
    data: claimData,
    isOpen: isClaimDialogOpen,
    resetClaim,
  } = useClaimDialogStore();

  const chainId = useCurrentChainId();
  const { canUnstake, unstakeCountdown } = useRevenueContract();
  const claimLocked = readOnly || !canUnstake;
  const { estimatedGas, customGasLimit, setEstimatedGas, setCustomGasLimit } =
    useClaimGasLimitStore();
  const [isOpenedFee, setIsOpenedFee] = useState(false);

  const { gasPriceOption, gasPriceSettings, setGasPriceOption, setGasPriceSettings } =
    useClaimGasPriceStore();

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

  // Check if a specific token is being claimed
  const isTokenBeingClaimed = (tokenId: string) => {
    if (!claimData) return false;
    if (claimState !== "confirming-claim" && claimState !== "executing-claim") return false;
    if (isClaimDialogOpen) return false;
    return claimData.selectedTokens?.some((token) => token.id === tokenId) || false;
  };

  const hasClaimInProgress =
    (claimState === "confirming-claim" || claimState === "executing-claim") && !isClaimDialogOpen;

  useEffect(() => {
    if ((claimState === "success" || claimState === "error") && !isClaimDialogOpen) {
      const timer = setTimeout(() => {
        resetClaim();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [claimState, isClaimDialogOpen, resetClaim]);

  const handleTokenSelect = (tokenId: string) => {
    if (readOnly) return;
    setSelectedTokens(tokenId);
  };

  const handleUnselectAll = () => {
    setSelectedTokens("");
  };

  const handleClaimSingle = (token: any) => {
    if (readOnly || claimLocked) return;
    const selectedTokensData = [
      {
        id: token.id,
        name: token.name,
        symbol: token.symbol,
        logoURI: token.logoURI,
        amount: token.amount,
        amountUSD: token.amountUSD,
        erc20Address: token.erc20Address,
        erc223Address: token.erc223Address,
        fullErc20Address: token.fullErc20Address,
        fullErc223Address: token.fullErc223Address,
        claimAddresses: token.claimAddresses,
        amountERC20: token.amountERC20,
        amountERC223: token.amountERC223,
        chainId: token.chainId,
      },
    ];

    const totalReward = usdOf(token);

    openDialog({
      selectedTokens: selectedTokensData,
      totalReward,
      selectedStandard: "ERC-223",
      isMultiple: false,
    });
  };

  const handleClaimSelected = () => {
    if (readOnly || claimLocked) return;
    const selectedTokensData = tableData
      .filter((item: any) => selectedTokens.has(item.id))
      .map((item: any) => ({
        id: item.id,
        name: item.name,
        symbol: item.symbol,
        logoURI: item.logoURI,
        amount: item.amount,
        amountUSD: item.amountUSD,
        erc20Address: item.erc20Address,
        erc223Address: item.erc223Address,
        fullErc20Address: item.fullErc20Address,
        fullErc223Address: item.fullErc223Address,
        claimAddresses: item.claimAddresses,
        amountERC20: item.amountERC20,
        amountERC223: item.amountERC223,
        chainId: item.chainId,
      }));

    const totalReward = tableData.reduce((sum: number, item: any) => {
      return selectedTokens.has(item.id) ? sum + usdOf(item) : sum;
    }, 0);

    if (selectedTokens.size === 1) {
      const token = selectedTokensData[0];
      openDialog({
        selectedTokens: selectedTokensData,
        totalReward,
        selectedStandard: "ERC-223",
        isMultiple: false,
      });
    } else {
      const tokenStandards: Record<string, "ERC-20" | "ERC-223"> = {};
      selectedTokensData.forEach((token: any) => {
        tokenStandards[token.id] = "ERC-223";
      });

      openDialog({
        selectedTokens: selectedTokensData,
        totalReward,
        isMultiple: true,
        tokenStandards,
      });
    }
  };

  const selectedCount = selectedTokens.size;
  const totalReward = tableData.reduce((sum: number, item: any) => {
    return selectedTokens.has(item.id) ? sum + usdOf(item) : sum;
  }, 0);
  const showClaimingOverlay = hasClaimInProgress && !isLoading;

  return (
    <>
      <SingleClaimDialog />
      <MultipleClaimDialog />
      {readOnly ? (
        <p className="text-14 text-secondary-text px-1 pb-3">{t("viewing_other_wallet_claims")}</p>
      ) : claimLocked && unstakeCountdown ? (
        <p className="text-14 text-secondary-text px-1 pb-3">
          {t("claims_locked_for", { time: unstakeCountdown })}
        </p>
      ) : null}

      {/* Desktop version */}
      <div className="hidden xl:flex xl:flex-col rounded-3 h-[640px] bg-table-gradient">
        <div className="grid grid-cols-[minmax(200px,2.5fr),_minmax(200px,2fr),_minmax(150px,1.2fr),_minmax(150px,1.2fr),_minmax(120px,1fr)] relative pr-5 pl-5 min-w-[1000px] flex-shrink-0">
          <div className="text-tertiary-text text-13 pl-5 h-[60px] flex items-center">
            {t("column_token")}
          </div>
          <div className="text-tertiary-text text-13 h-[60px] flex items-center">
            <div className="flex flex-col gap-1">
              <span>{t("column_address_erc20")}</span>
              <span>{t("column_address_erc223")}</span>
            </div>
          </div>
          <div className="text-tertiary-text text-13 h-[60px] flex items-center justify-end pr-4">
            {t("column_amount_tokens")}
          </div>
          <div className="text-tertiary-text text-13 h-[60px] flex items-center justify-end pr-4">
            {t("column_amount_usd")}
          </div>
          <div className="text-tertiary-text text-13 h-[60px] flex items-center justify-center">
            {t("column_action")}
          </div>
        </div>

        <div
          className="overflow-y-auto overflow-x-auto flex-1 relative"
          aria-busy={isLoading || showClaimingOverlay}
        >
          {isLoading ? (
            <SkeletonTheme
              baseColor="#272727"
              highlightColor="#2E2F2F"
              borderRadius="0.5rem"
              enableAnimation={false}
            >
              {[...Array(8)].map((_, index) => (
                <React.Fragment key={index}>
                  <div className="grid grid-cols-[minmax(200px,2.5fr),_minmax(200px,2fr),_minmax(150px,1.2fr),_minmax(150px,1.2fr),_minmax(120px,1fr)] relative">
                    <div className="min-h-[30px] flex items-center gap-3 pl-5 border-b border-quaternary-bg">
                      <Skeleton circle width={16} height={16} />
                      <Skeleton circle width={32} height={32} />
                      <div className="flex flex-col gap-1">
                        <Skeleton width={80} height={14} />
                        <Skeleton width={40} height={12} />
                      </div>
                    </div>
                    <div className="min-h-[30px] flex items-center border-b border-quaternary-bg">
                      <div className="flex flex-col gap-2 w-full">
                        <Skeleton width={100} height={14} />
                        <Skeleton width={100} height={14} />
                      </div>
                    </div>
                    <div className="min-h-[30px] flex items-center justify-end pr-4 border-b border-quaternary-bg">
                      <Skeleton width={60} height={14} />
                    </div>
                    <div className="min-h-[30px] flex items-center justify-end pr-4 border-b border-quaternary-bg">
                      <Skeleton width={80} height={14} />
                    </div>
                    <div className="min-h-[30px] flex items-center justify-center border-b border-quaternary-bg">
                      <Skeleton width={60} height={32} />
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </SkeletonTheme>
          ) : (
            tableData.map((o: any, index: number) => {
              const key = o.id || (o?.token?.address0 ? o.token.address0 : `item-${index}`);
              const isSelected = selectedTokens.has(o.id);

              return (
                <div
                  key={key}
                  className={clsx(
                    "grid grid-cols-[minmax(200px,2.5fr),_minmax(200px,2fr),_minmax(150px,1.2fr),_minmax(150px,1.2fr),_minmax(120px,1fr)] relative duration-200 rounded-2 pr-5 pl-5",
                    isTokenBeingClaimed(o.id)
                      ? "opacity-60 pointer-events-none"
                      : "hover:bg-tertiary-bg cursor-pointer",
                  )}
                >
                  <div
                    className={clsx(
                      "min-h-[72px] flex text-secondary-text items-center gap-3 pl-5",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        handleChange={() => handleTokenSelect(o.id)}
                        id={`claim-token-${o.id}`}
                        disabled={readOnly || hasClaimInProgress || isTokenBeingClaimed(o.id)}
                        label={t("select_claim_token", { symbol: o.symbol })}
                        labelClassName="sr-only"
                      />
                      <Image
                        src={o.logoURI || "/images/tokens/placeholder.svg"}
                        width={32}
                        height={32}
                        alt=""
                        className="flex-shrink-0"
                      />
                      <div className="flex min-w-0 justify-center gap-2 items-center">
                        <span className="truncate text-secondary-text text-16 font-medium">
                          {o.name}
                        </span>
                        <span className="text-13 text-tertiary-text">{o.symbol}</span>
                      </div>
                    </div>
                  </div>
                  <div className={clsx("min-h-[72px] flex items-center")}>
                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex items-center gap-2">
                        <a
                          target="_blank"
                          rel="noopener noreferrer"
                          href={getExplorerLink(
                            ExplorerLinkType.ADDRESS,
                            o.fullErc20Address || o.erc20Address,
                            o.chainId,
                          )}
                          className="flex items-center gap-1 text-green hocus:text-green-hover duration-200"
                        >
                          <span className="w-[80px] text-left">
                            {truncateMiddle(o.fullErc20Address || o.erc20Address || "", {
                              charsFromStart: 3,
                              charsFromEnd: 3,
                            })}
                          </span>
                          <ForwardIcon className="flex-shrink-0 w-6 h-6" size={24} />
                        </a>
                        <IconButton
                          variant={IconButtonVariant.COPY}
                          text={o.fullErc20Address}
                          buttonSize={IconButtonSize.EXTRA_SMALL}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          target="_blank"
                          rel="noopener noreferrer"
                          href={getExplorerLink(
                            ExplorerLinkType.ADDRESS,
                            o.fullErc223Address || o.erc223Address,
                            o.chainId,
                          )}
                          className="flex items-center gap-1 text-green hocus:text-green-hover duration-200"
                        >
                          <span className="w-[80px] text-left">
                            {truncateMiddle(o.fullErc223Address || o.erc223Address || "", {
                              charsFromStart: 3,
                              charsFromEnd: 3,
                            })}
                          </span>
                          <ForwardIcon className="flex-shrink-0 w-6 h-6" size={24} />
                        </a>
                        <IconButton
                          variant={IconButtonVariant.COPY}
                          text={o.fullErc223Address}
                          buttonSize={IconButtonSize.EXTRA_SMALL}
                        />
                      </div>
                    </div>
                  </div>
                  <div className={clsx("min-h-[72px] flex text-14 items-center justify-end pr-4")}>
                    <div className="flex items-center">
                      <span className="text-primary-text">{o.amount}</span>
                      <span className="text-secondary-text ml-1">{o.symbol}</span>
                    </div>
                  </div>
                  <div
                    className={clsx(
                      "min-h-[72px] flex text-secondary-text text-14 items-center justify-end pr-4",
                    )}
                  >
                    {o.amountUSD}
                  </div>
                  <div className={clsx("min-h-[72px] flex items-center justify-center ml-10")}>
                    {isTokenBeingClaimed(o.id) ? (
                      <div className="flex items-center gap-2">
                        <Preloader size={20} />
                        <span className="text-secondary-text text-14">{t("claiming")}</span>
                      </div>
                    ) : (
                      <Button
                        variant={ButtonVariantType.CONTAINED}
                        colorScheme={ButtonColor.GREEN}
                        size={ButtonSize.MEDIUM}
                        onClick={() => handleClaimSingle(o)}
                        disabled={
                          claimLocked ||
                          selectedTokens.size > 0 ||
                          hasClaimInProgress ||
                          !o.claimAddresses?.length
                        }
                      >
                        {t("claim_action")}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {showClaimingOverlay && (
            <div className="absolute inset-0 bg-[#0F0F0F]/60 backdrop-blur-[2px] flex items-center justify-center z-10">
              <div className="flex items-center gap-2 rounded-2 bg-primary-bg/90 border border-quaternary-bg px-4 py-2">
                <Preloader size={20} />
                <span className="text-secondary-text text-14">{t("claim_in_progress")}</span>
              </div>
            </div>
          )}
        </div>

        {selectedCount > 0 && !isLoading && !readOnly && (
          <div className="relative z-20 p-4 bg-tertiary-bg rounded-b-3 flex items-center justify-between gap-4 border border-quaternary-bg">
            <div className="flex items-center gap-4">
              <span className="text-tertiary-text text-14">
                {t("total_claim", { count: selectedCount })}
              </span>
              <button
                onClick={handleUnselectAll}
                className="text-secondary-text hover:text-primary-text transition-colors text-14 font-medium"
              >
                {t("unselect_all")}
              </button>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Svg iconName="gas-edit" size={20} className="text-tertiary-text" />
                <span className="text-tertiary-text text-14">
                  {t("gas_price")}{" "}
                  {formattedGasPrice
                    ? `${formatFloat((Number(formattedGasPrice) / 1e9).toString())} GWEI`
                    : "—"}
                </span>
                <Button
                  variant={ButtonVariantType.CONTAINED}
                  colorScheme={ButtonColor.LIGHT_GREEN}
                  size={ButtonSize.EXTRA_SMALL}
                  onClick={() => setIsOpenedFee(true)}
                >
                  {t("edit")}
                </Button>
              </div>
              <div className="h-[20px] w-[2px] bg-secondary-border"></div>
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2">
                  <Svg iconName="collect" size={20} className="text-tertiary-text" />
                  <span className="text-tertiary-text text-14 font-light">
                    {t("total_reward", { amount: totalReward.toFixed(2) })}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Button
                    variant={ButtonVariantType.CONTAINED}
                    colorScheme={ButtonColor.GREEN}
                    size={ButtonSize.SMALL}
                    onClick={handleClaimSelected}
                    className="!rounded-[8px]"
                    disabled={claimLocked || hasClaimInProgress || selectedCount > 15}
                  >
                    {hasClaimInProgress ? (
                      <div className="flex items-center gap-2">
                        <Preloader size={16} />
                        {t("claiming")}
                      </div>
                    ) : (
                      t("claim_selected")
                    )}
                  </Button>
                  {selectedCount > 15 && (
                    <span className="text-10 text-red-light">{t("max_tokens")}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile and Tablet version */}
      <div
        className="xl:hidden grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 overflow-x-hidden w-full relative"
        aria-busy={isLoading || showClaimingOverlay}
      >
        {isLoading ? (
          <SkeletonTheme
            baseColor="#272727"
            highlightColor="#2E2F2F"
            borderRadius="0.75rem"
            enableAnimation={false}
          >
            {[...Array(6)].map((_, index) => (
              <div key={index} className="bg-primary-bg rounded-3 p-4">
                <div className="flex items-start gap-3 mb-3">
                  <Skeleton circle width={16} height={16} className="mt-1" />
                  <Skeleton circle width={32} height={32} />
                  <div className="flex flex-col gap-1 flex-1">
                    <div className="flex items-center justify-between">
                      <Skeleton width={120} height={14} />
                      <Skeleton width={60} height={14} />
                    </div>
                    <Skeleton width={80} height={13} />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 mb-3">
                  <Skeleton width={100} height={12} />
                  <Skeleton width={100} height={12} />
                </div>

                <Skeleton width="100%" height={40} />
              </div>
            ))}
          </SkeletonTheme>
        ) : (
          <>
            {selectedCount > 0 && !isLoading && !readOnly && (
              <div className="bg-tertiary-bg rounded-3 p-4 xl:col-span-2">
                <div className="flex items-center mb-3 gap-2">
                  <div className="flex items-center gap-1.5">
                    <Svg iconName="gas-edit" size={16} className="text-tertiary-text" />
                    <span className="text-secondary-text text-14">
                      {t("gas_price")}{" "}
                      {formattedGasPrice
                        ? `${formatFloat((Number(formattedGasPrice) / 1e9).toString())} GWEI`
                        : "—"}
                    </span>
                  </div>
                  <Button
                    variant={ButtonVariantType.OUTLINED}
                    colorScheme={ButtonColor.LIGHT_GREEN}
                    size={ButtonSize.EXTRA_SMALL}
                    onClick={() => setIsOpenedFee(true)}
                    className="!h-6 !px-2 !text-12"
                  >
                    {t("edit")}
                  </Button>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <Svg iconName="collect" size={16} className="text-tertiary-text" />
                    <span className="text-secondary-text text-14">
                      {t("total_reward", { amount: totalReward.toFixed(2) })}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant={ButtonVariantType.OUTLINED}
                    colorScheme={ButtonColor.LIGHT_GREEN}
                    size={ButtonSize.MEDIUM}
                    onClick={handleUnselectAll}
                    className="flex-1 h-10 !px-0"
                  >
                    {t("unselect_all")}
                  </Button>
                  <div className="flex flex-col flex-1 gap-1">
                    <Button
                      variant={ButtonVariantType.CONTAINED}
                      colorScheme={ButtonColor.GREEN}
                      size={ButtonSize.MEDIUM}
                      onClick={handleClaimSelected}
                      disabled={claimLocked || hasClaimInProgress || selectedCount > 15}
                      className="w-full h-10 !px-0"
                    >
                      {hasClaimInProgress ? (
                        <div className="flex items-center gap-2">
                          <Preloader size={16} />
                          {t("claiming")}
                        </div>
                      ) : (
                        t("claim_count", { count: selectedCount })
                      )}
                    </Button>
                    {selectedCount > 15 && (
                      <span className="text-10 text-red-light text-center">{t("max_tokens")}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
            {tableData.map((o: any, index: number) => {
              const key = o.id || (o?.token?.address0 ? o.token.address0 : `item-${index}`);
              const isSelected = selectedTokens.has(o.id);

              return (
                <div
                  key={key}
                  className={clsx(
                    "bg-primary-bg rounded-3 p-4 flex flex-col overflow-hidden w-full",
                    isTokenBeingClaimed(o.id) && "opacity-60 pointer-events-none",
                  )}
                >
                  {/* Header with token info */}
                  <div className="flex items-center gap-3 mb-2 overflow-hidden w-full">
                    <Checkbox
                      checked={isSelected}
                      handleChange={() => handleTokenSelect(o.id)}
                      id={`claim-token-mobile-${o.id}`}
                      disabled={readOnly || hasClaimInProgress || isTokenBeingClaimed(o.id)}
                      label={t("select_claim_token", { symbol: o.symbol })}
                      labelClassName="sr-only"
                    />
                    <Image
                      src={o.logoURI || "/images/tokens/placeholder.svg"}
                      width={32}
                      height={32}
                      alt=""
                      className="flex-shrink-0"
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-primary-text text-14 font-medium truncate">
                          {o.name}
                        </span>
                        <span className="text-primary-text text-14 font-medium flex-shrink-0">
                          {o.amountUSD}
                        </span>
                      </div>
                      <div className="text-13 text-secondary-text">
                        {o.amount} {o.symbol}
                      </div>
                    </div>
                  </div>

                  {/* Addresses section */}
                  <div className="flex flex-row justify-between gap-2 md:gap-3 mb-3 overflow-hidden w-full">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                      <span className="text-tertiary-text text-13 flex-shrink-0">ERC-20</span>
                      <a
                        target="_blank"
                        rel="noopener noreferrer"
                        href={getExplorerLink(
                          ExplorerLinkType.ADDRESS,
                          o.fullErc20Address || o.erc20Address,
                          o.chainId,
                        )}
                        className="flex items-center gap-0.5 text-green hocus:text-green-hover duration-200 min-w-0 overflow-hidden"
                      >
                        <span className="text-13 truncate">
                          {truncateMiddle(o.fullErc20Address || o.erc20Address || "", {
                            charsFromStart: 3,
                            charsFromEnd: 3,
                          })}
                        </span>
                        <Svg iconName="forward" size={16} className="flex-shrink-0" />
                      </a>
                    </div>

                    <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                      <span className="text-tertiary-text text-13 flex-shrink-0">ERC-223</span>
                      <a
                        target="_blank"
                        rel="noopener noreferrer"
                        href={getExplorerLink(
                          ExplorerLinkType.ADDRESS,
                          o.fullErc223Address || o.erc223Address,
                          o.chainId,
                        )}
                        className="flex items-center gap-0.5 text-green hocus:text-green-hover duration-200 min-w-0 overflow-hidden"
                      >
                        <span className="text-13 truncate">
                          {truncateMiddle(o.fullErc223Address || o.erc223Address || "", {
                            charsFromStart: 3,
                            charsFromEnd: 3,
                          })}
                        </span>
                        <Svg iconName="forward" size={16} className="flex-shrink-0" />
                      </a>
                    </div>
                  </div>

                  {isTokenBeingClaimed(o.id) ? (
                    <div className="flex items-center justify-center gap-2 h-10 bg-quaternary-bg rounded-2">
                      <Preloader size={16} />
                      <span className="text-secondary-text text-14">{t("claiming")}</span>
                    </div>
                  ) : (
                    <Button
                      className="w-full h-10"
                      variant={ButtonVariantType.CONTAINED}
                      colorScheme={ButtonColor.GREEN}
                      size={ButtonSize.MEDIUM}
                      disabled={
                        claimLocked ||
                        selectedTokens.size > 0 ||
                        hasClaimInProgress ||
                        !o.claimAddresses?.length
                      }
                      onClick={() => handleClaimSingle(o)}
                    >
                      {t("claim_action")}
                    </Button>
                  )}
                </div>
              );
            })}
          </>
        )}
        {showClaimingOverlay && (
          <div className="absolute inset-0 bg-[#0F0F0F]/60 backdrop-blur-[2px] flex items-center justify-center z-10">
            <div className="flex items-center gap-2 rounded-2 bg-primary-bg/90 border border-quaternary-bg px-4 py-2">
              <Preloader size={18} />
              <span className="text-secondary-text text-14">{t("claim_in_progress")}</span>
            </div>
          </div>
        )}
      </div>

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

export default Claims;
