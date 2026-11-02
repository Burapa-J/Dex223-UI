"use client";

import "react-loading-skeleton/dist/skeleton.css";

import Preloader from "@repo/ui/preloader";
import Tooltip from "@repo/ui/tooltip";
import clsx from "clsx";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import { Address, formatUnits, isAddress } from "viem";
import { useAccount, useSwitchChain } from "wagmi";

import { useRevenueStore } from "@/app/[locale]/revenue/stores/useRevenueStore";
import Container from "@/components/atoms/Container";
import { SearchInput } from "@/components/atoms/Input";
import Button, { ButtonColor, ButtonSize } from "@/components/buttons/Button";
import { useConnectWalletDialogStateStore } from "@/components/dialogs/stores/useConnectWalletStore";
import { TokenListId } from "@/db/db";
import { durationMessageKey, formatDuration } from "@/functions/formatDuration";
import { formatFloat } from "@/functions/formatFloat";
import truncateMiddle from "@/functions/truncateMiddle";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { useTokens } from "@/hooks/useTokenLists";
import { Token } from "@/sdk_bi/entities/token";
import { useUSDPriceStore } from "@/stores/useUSDPriceStore";

import { Claims } from "./components/Claims";
import StakeDialog from "./dialogs/StakeDialog";
import TokenListDropdown from "./dialogs/TokenListDropdown";
import usePendingProtocolFees, { COLLECT_BATCH_SIZE } from "./hooks/usePendingProtocolFees";
import useRevenueContract from "./hooks/useRevenueContract";
import { StakeStatus, useStakeDialogStore } from "./stores/useStakeDialogStore";

const WalletSearchInput = ({
  searchValue,
  setSearchValue,
}: {
  searchValue: string;
  setSearchValue: (value: string) => void;
}) => {
  const t = useTranslations("Revenue");
  const error = Boolean(searchValue) && !isAddress(searchValue) ? t("invalid_address") : "";

  const { hasRevenue, hasSearchRevenue } = useRevenueStore();

  useEffect(() => {
    if (searchValue) {
      hasRevenue(searchValue as Address);
    }
  }, [hasRevenue, searchValue]);

  return (
    <div className="relative w-full">
      <SearchInput
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        placeholder={t("search_by_address")}
        isError={!!error}
        style={
          searchValue && !hasSearchRevenue ? { paddingRight: "100px" } : { paddingRight: "60px" }
        }
        className={clsx(
          "bg-primary-bg w-full xl:w-[540px] h-[40px] md:h-[48px]",
          searchValue && "pr-[100px]",
        )}
      />
      {error && <p className="text-12 text-red-light mt-1 h-4">{error}</p>}
    </div>
  );
};

export function Revenue() {
  const t = useTranslations("Revenue");
  const [searchValue, setSearchValue] = useState("");
  const [claimRewardsSearchValue, setClaimRewardsSearchValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { address } = useAccount();
  const [selectedTokens, setSelectedTokens] = useState<Set<number>>(new Set());
  const chainId = useCurrentChainId();
  const [selectedTokenLists, setSelectedTokenLists] = useState<Set<TokenListId>>(
    new Set([`default-${chainId}` as TokenListId]),
  );
  const {
    openDialog,
    reopenDialog: reopenStakeDialog,
    status: stakeStatus,
    isOpen: isStakeDialogOpen,
    dialogType,
  } = useStakeDialogStore();
  const { switchChain } = useSwitchChain();
  const { setIsOpened: setWalletConnectOpened } = useConnectWalletDialogStateStore();

  const allAvailableTokens = useTokens();
  const usdPrices = useUSDPriceStore((state) => state.prices);

  const tokensFromSelectedLists = useMemo(() => {
    return allAvailableTokens.filter((token) => {
      if (!token.isToken) return false; // Filter out native coins

      // Check if token is in any of the selected lists
      return token.lists?.some((listId) => selectedTokenLists.has(listId));
    });
  }, [allAvailableTokens, selectedTokenLists]);

  const searchAddress =
    searchValue && isAddress(searchValue) ? (searchValue as Address) : undefined;
  const {
    userStaked,
    userStakingTimestamp,
    stakingPercentage,
    isLoadingUserData,
    totalStaked,
    claimableRewards,
    setRewardTokens,
    canUnstake,
    unstakeCountdown,
    hasStaked,
    erc223Deposit,
    stakingTokenERC223,
    stakingTokenSymbol,
    recoverDeposit,
    collectProtocolFees,
    refetchUserData,
    isTransactionPending,
    rewardDuration,
  } = useRevenueContract({ searchAddress });
  const { feeCollectorAddress, pendingPools, refetchPendingPools } =
    usePendingProtocolFees(chainId);

  useEffect(() => {
    if (tokensFromSelectedLists.length > 0) {
      setRewardTokens(tokensFromSelectedLists as unknown as Token[]);
    }
  }, [tokensFromSelectedLists, setRewardTokens]);

  // Rows are the tokens the Revenue contract on this chain actually holds, with the
  // amounts claim() would pay right now.
  const mappedClaimsData = useMemo(() => {
    return claimableRewards
      .filter((reward) => reward.heldERC20 > 0n || reward.heldERC223 > 0n)
      .map((reward, index) => {
        const price = usdPrices[reward.token.address0.toLowerCase()];
        const amount = Number(reward.amountFormatted);
        return {
          id: index + 1,
          name: reward.token.name || "Unknown",
          symbol: reward.token.symbol || "???",
          logoURI: reward.token.logoURI || "/images/tokens/placeholder.svg",
          erc20Address: truncateMiddle(reward.token.address0, {
            charsFromStart: 3,
            charsFromEnd: 3,
          }),
          erc223Address: truncateMiddle(reward.token.address1, {
            charsFromStart: 3,
            charsFromEnd: 3,
          }),
          amount: formatFloat(amount),
          amountERC20: formatFloat(Number(formatUnits(reward.amountERC20, reward.token.decimals))),
          amountERC223: formatFloat(
            Number(formatUnits(reward.amountERC223, reward.token.decimals)),
          ),
          amountUSD: price !== undefined ? `$${(amount * Number(price)).toFixed(2)}` : "-",
          fullErc20Address: reward.token.address0,
          fullErc223Address: reward.token.address1,
          claimAddresses: reward.claimAddresses,
          chainId: reward.token.chainId,
          token: reward.token,
        };
      });
  }, [claimableRewards, usdPrices]);

  const totalClaimableUSD = useMemo(
    () =>
      mappedClaimsData.reduce((sum, row) => {
        const usd = parseFloat(row.amountUSD.replace(/[$,]/g, ""));
        return Number.isFinite(usd) ? sum + usd : sum;
      }, 0),
    [mappedClaimsData],
  );

  const handleSelectedTokens = (tokenId: number) => {
    if (tokenId === 0) {
      setSelectedTokens(new Set());
    } else {
      setSelectedTokens((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(tokenId)) {
          newSet.delete(tokenId);
        } else {
          newSet.add(tokenId);
        }
        return newSet;
      });
    }
  };

  const isStakeActionLocked = useMemo(() => {
    const isStakeTxInFlight = [
      StakeStatus.PENDING_APPROVE,
      StakeStatus.LOADING_APPROVE,
      StakeStatus.PENDING,
      StakeStatus.LOADING,
    ].includes(stakeStatus);

    return !isStakeDialogOpen && dialogType === "stake" && isStakeTxInFlight;
  }, [dialogType, isStakeDialogOpen, stakeStatus]);

  const handleStakeClick = () => {
    if (isStakeActionLocked) return;
    if (!address) {
      setWalletConnectOpened(true);
      return;
    }
    openDialog("stake", "", "ERC-20");
  };

  const handleUnstakeClick = () => {
    if (!address) {
      setWalletConnectOpened(true);
      return;
    }
    openDialog("unstake", "", "ERC-20");
  };

  useEffect(() => {
    setError(null);
  }, [searchValue, claimRewardsSearchValue]);

  useEffect(() => {
    if (searchAddress) {
      setSelectedTokens(new Set());
    }
  }, [searchAddress]);

  const formatStakedAmount = (amount: unknown) => {
    if (!amount || typeof amount !== "bigint") return "0";
    const divisor = BigInt(10 ** 18);
    const quotient = amount / divisor;
    const remainder = amount % divisor;

    if (remainder === 0n) {
      return quotient.toString();
    }

    const decimalPart = (remainder * BigInt(100)) / divisor;
    return `${quotient.toString()}.${decimalPart.toString().padStart(2, "0")}`;
  };

  const formatTotalStaked = (amount: bigint) =>
    new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 }).format(
      Number(formatUnits(amount, 18)),
    );

  const lastStakedDate =
    hasStaked && typeof userStakingTimestamp === "bigint" && userStakingTimestamp > 0n
      ? new Date(Number(userStakingTimestamp) * 1000)
          .toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
          .replace(/\//g, ".")
      : null;

  const handleRecoverDeposit = async () => {
    try {
      await recoverDeposit(stakingTokenERC223);
      refetchUserData();
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || t("recover_failed"));
    }
  };

  const handleCollectProtocolFees = async () => {
    try {
      await collectProtocolFees(pendingPools.slice(0, COLLECT_BATCH_SIZE));
      refetchPendingPools();
      refetchUserData();
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || t("collect_failed"));
    }
  };

  // Use mapped claims data or fallback to hardcoded data for demo
  const dataToUse = mappedClaimsData.length > 0 ? mappedClaimsData : [];

  const filteredClaimsData = dataToUse.filter((claim) => {
    const searchLower = claimRewardsSearchValue.toLowerCase();
    return (
      claim.name.toLowerCase().includes(searchLower) ||
      claim.symbol.toLowerCase().includes(searchLower) ||
      claim.fullErc20Address.toLowerCase().includes(searchLower) ||
      claim.fullErc223Address.toLowerCase().includes(searchLower)
    );
  });

  // Determine which empty state to show
  const hasFilteredResults = filteredClaimsData.length > 0;

  return (
    <Container className="overflow-x-hidden">
      <div className="p-4 md:p-6 xl:p-10 flex flex-col overflow-x-hidden w-full">
        <div className="flex flex-col xl:flex-row w-full justify-between items-start xl:items-center gap-4 xl:gap-0 xl:mb-0 overflow-x-hidden">
          <h1 className="text-24 md:text-32 xl:text-40 font-medium">{t("title")}</h1>
          <div className="flex flex-col w-full xl:flex-row xl:w-auto gap-y-2 xl:gap-x-3 overflow-x-hidden">
            <WalletSearchInput searchValue={searchValue} setSearchValue={setSearchValue} />
          </div>
        </div>

        <div className="mt-4 md:mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4 md:gap-5 w-full overflow-x-hidden">
          {isLoadingUserData ? (
            <>
              <div className="relative flex flex-col bg-gradient-card-green-light-fill rounded-3 px-4 md:px-5 py-3 md:py-4 w-full md:col-span-2 xl:col-span-7 overflow-hidden min-h-[140px] md:h-[120px] min-w-0 max-w-full">
                <SkeletonTheme
                  baseColor="#1D1E1E"
                  highlightColor="#272727"
                  borderRadius="20px"
                  enableAnimation={false}
                >
                  <div className="flex items-center gap-1 z-10">
                    <Skeleton width={90} height={20} />
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 z-10 mt-2">
                    <div className="flex flex-col">
                      <Skeleton width={200} height={32} className="mb-1" />
                      <Skeleton width={50} height={14} />
                    </div>

                    <div className="flex gap-2 justify-start md:justify-end mt-2 md:mt-0">
                      <Skeleton width={73} height={40} className="md:h-[48px]" />
                      <Skeleton width={90} height={40} className="md:h-[48px]" />
                    </div>
                  </div>
                </SkeletonTheme>
                <Image
                  src="/images/revenue-image.svg"
                  alt="Side Icon"
                  width={180}
                  height={120}
                  className="absolute right-0 bottom-0 w-auto h-full max-h-full object-contain object-right-bottom pointer-events-none select-none opacity-50 md:opacity-100"
                />
              </div>

              <div className="relative flex flex-col bg-primary-bg rounded-3 px-4 md:px-5 py-3 md:py-4 w-full md:col-span-2 xl:col-span-5 overflow-hidden min-h-[140px] md:h-[120px] min-w-0 max-w-full">
                <SkeletonTheme
                  baseColor="#1D1E1E"
                  highlightColor="#272727"
                  borderRadius="20px"
                  enableAnimation={false}
                >
                  <div className="flex items-center gap-1 z-10">
                    <Skeleton width={100} height={20} />
                  </div>

                  <div className="flex flex-col z-10 mt-2">
                    <Skeleton width={120} height={32} className="mb-1" />
                    <Skeleton width={110} height={16} />
                  </div>
                </SkeletonTheme>
                <Image
                  src="/images/revenue-reward.svg"
                  alt="Side Icon"
                  width={220}
                  height={140}
                  className="absolute right-0 bottom-0 w-auto h-full max-h-full object-contain object-right-bottom pointer-events-none select-none opacity-50 md:opacity-100"
                />
              </div>
            </>
          ) : (
            <>
              <div className="relative flex flex-col bg-gradient-card-green-light-fill rounded-3 px-4 md:px-5 py-3 md:py-4 w-full md:col-span-2 xl:col-span-7 overflow-hidden min-h-[140px] md:h-[120px] min-w-0 max-w-full">
                <div className="flex items-center justify-between z-10">
                  <div className="flex items-center gap-1">
                    <span className="text-14 md:text-16 text-secondary-text">
                      {t("staked_label")}
                    </span>
                    <Tooltip iconSize={16} text={t("staked_tooltip")} />
                  </div>
                  {unstakeCountdown && (
                    <div className="flex items-center gap-1 ml-4">
                      <span className="text-14 md:text-16 text-secondary-text">
                        {t("time_to_unstake")}
                      </span>
                      <Tooltip iconSize={16} text={t("time_to_unstake_tooltip")} />
                    </div>
                  )}
                </div>

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 z-10 mt-2">
                  <div className="flex flex-col">
                    <span className="text-24 md:text-28 xl:text-32 font-medium">
                      {formatStakedAmount(userStaked)} / {formatTotalStaked(totalStaked)}
                    </span>
                    <span className="text-12 md:text-13 xl:text-14 text-secondary-text">
                      {t("share_of_staked", { percent: stakingPercentage.toFixed(2) })}
                    </span>
                  </div>

                  <div className="flex gap-2 justify-start md:justify-end mt-2 md:mt-0 w-full md:w-auto">
                    <button
                      type="button"
                      onClick={handleStakeClick}
                      disabled={isStakeActionLocked || !!searchAddress}
                      className={clsx(
                        "border px-3 md:px-4 h-[40px] md:h-[48px] flex-1 md:flex-none md:min-w-[100px] rounded-3 text-12 md:text-14 font-medium transition-colors active:scale-95",
                        hasStaked
                          ? "border-yellow-light bg-[#4C483C] text-white cursor-pointer"
                          : "border-secondary-border bg-green text-black cursor-pointer hover:bg-green",
                        (isStakeActionLocked || searchAddress) &&
                          "opacity-50 cursor-not-allowed hover:bg-tertiary-bg",
                      )}
                    >
                      {t("stake_action")}
                    </button>

                    {unstakeCountdown ? (
                      <div className="flex flex-col items-end gap-1 min-w-[100px]">
                        <div className="border border-yellow-light bg-primary-bg text-secondary-text px-3 md:px-4 h-[40px] md:h-[48px] min-w-[100px] rounded-3 text-12 md:text-14 font-medium flex items-center justify-center">
                          <span className="text-10 md:text-12">{unstakeCountdown}</span>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleUnstakeClick}
                        disabled={!canUnstake || !hasStaked || !!searchAddress}
                        className={clsx(
                          "border px-3 md:px-4 h-[40px] md:h-[48px] flex-1 md:flex-none md:min-w-[100px] rounded-3 text-12 md:text-14 font-medium transition-colors active:scale-95",
                          hasStaked
                            ? "border-yellow-light bg-[#4C483C] text-white"
                            : "border border-green bg-transparent-bg text-secondary-text",
                          !canUnstake || !hasStaked || searchAddress
                            ? "opacity-50 cursor-not-allowed"
                            : "cursor-pointer",
                        )}
                      >
                        {t("unstake_action")}
                      </button>
                    )}
                  </div>
                </div>

                <Image
                  src="/images/revenue-image.svg"
                  alt="Side Icon"
                  width={180}
                  height={120}
                  className="absolute right-0 bottom-0 w-auto h-full max-h-full object-contain object-right-bottom pointer-events-none select-none opacity-50 md:opacity-100"
                />
              </div>

              <div className="relative flex flex-col bg-primary-bg rounded-3 px-4 md:px-5 py-3 md:py-4 w-full md:col-span-2 xl:col-span-5 overflow-hidden min-h-[140px] md:h-[120px] min-w-0 max-w-full">
                <div className="flex items-center z-10 gap-1">
                  <span className="text-14 md:text-16 text-secondary-text">
                    {t("claimable_reward")}
                  </span>
                  <Tooltip
                    iconSize={16}
                    text={t("claimable_tooltip", {
                      period: formatDuration(Number(rewardDuration), (unit, count) =>
                        t(durationMessageKey[unit], { count }),
                      ),
                    })}
                  />
                </div>

                <div className="flex flex-col z-10 mt-2">
                  <span className="text-20 md:text-24 xl:text-32 font-medium">
                    ${totalClaimableUSD.toFixed(2)}
                  </span>
                  <span className="text-12 md:text-14 xl:text-16 text-secondary-text mt-1">
                    {lastStakedDate
                      ? t("last_staked", { date: lastStakedDate })
                      : t("not_staked_yet_short")}
                  </span>
                </div>

                <Image
                  src="/images/revenue-reward.svg"
                  alt="Side Icon"
                  width={220}
                  height={140}
                  className="absolute right-0 bottom-0 w-auto h-full max-h-full object-contain object-right-bottom pointer-events-none select-none opacity-50 md:opacity-100"
                />
              </div>
            </>
          )}
        </div>
        {!searchAddress && typeof erc223Deposit === "bigint" && erc223Deposit > BigInt(0) && (
          <div className="mt-4 md:mt-5 w-full rounded-3 bg-primary-bg border border-quaternary-bg px-4 md:px-5 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <span className="text-secondary-text text-12 md:text-14">
              {t("deposit_reached", {
                amount: formatUnits(erc223Deposit, 18),
                symbol: stakingTokenSymbol,
              })}
            </span>
            <Button
              size={ButtonSize.EXTRA_SMALL}
              colorScheme={ButtonColor.LIGHT_GREEN}
              onClick={handleRecoverDeposit}
              disabled={isTransactionPending}
            >
              {t("recover_deposit")}
            </Button>
          </div>
        )}
        {feeCollectorAddress && pendingPools.length > 0 && (
          <div className="mt-4 md:mt-5 w-full rounded-3 bg-primary-bg border border-quaternary-bg px-4 md:px-5 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <span className="text-secondary-text text-12 md:text-14">
              {pendingPools.length === 1
                ? t("pools_hold_one")
                : t("pools_hold_many", { count: pendingPools.length })}
            </span>
            <Button
              size={ButtonSize.EXTRA_SMALL}
              colorScheme={ButtonColor.LIGHT_GREEN}
              onClick={handleCollectProtocolFees}
              disabled={!address || isTransactionPending}
            >
              {t("collect_pool_fees")}
            </Button>
          </div>
        )}
        {error && <p className="mt-2 text-12 md:text-14 text-red-light">{error}</p>}

        {isStakeActionLocked && (
          <div className="mt-4 md:mt-5 w-full rounded-3 bg-primary-bg/90 border border-quaternary-bg px-4 md:px-5 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Preloader size={16} />
              <span className="text-secondary-text text-12 md:text-14">
                {t("staking_in_progress")}
              </span>
            </div>
            <Button
              size={ButtonSize.EXTRA_SMALL}
              colorScheme={ButtonColor.LIGHT_GREEN}
              onClick={reopenStakeDialog}
            >
              {t("details")}
            </Button>
          </div>
        )}

        <div className="mt-6 md:mt-8 xl:mt-10 flex flex-col xl:flex-row w-full justify-between items-start xl:items-center gap-4 xl:gap-0 overflow-x-hidden">
          <h2 className="text-20 md:text-24 xl:text-32 font-medium">{t("claim_title")}</h2>
          <div className="flex flex-col md:flex-row xl:flex-row gap-3 w-full xl:w-auto overflow-x-hidden">
            <div className="w-full xl:w-auto min-w-0">
              <TokenListDropdown
                selectedOptions={selectedTokenLists}
                onSelectionChange={setSelectedTokenLists}
                placeholder={t("select_token_lists")}
                searchPlaceholder={t("search_list_name")}
                className="w-full xl:w-auto"
              />
            </div>
            <div className="w-full xl:w-auto min-w-0">
              <SearchInput
                value={claimRewardsSearchValue}
                onChange={(e) => setClaimRewardsSearchValue(e.target.value)}
                placeholder={t("search_name_or_address")}
                className="h-[40px] md:h-[48px] bg-primary-bg w-full xl:w-[540px]"
              />
            </div>
          </div>
        </div>
        <div className="mt-4 md:mt-6 min-h-[340px] w-full overflow-x-hidden">
          {!address ? (
            <div className="flex flex-col items-center justify-center min-h-[280px] md:min-h-[340px] w-full bg-[#1A1A1A] rounded-3 p-6 md:p-8 relative overflow-hidden">
              <p className="text-12 md:text-14 xl:text-16 text-gray-400 text-center z-10 mb-4">
                {t("connect_wallet_rewards")}
              </p>
              <div className="absolute top-0 right-0 flex items-end justify-end p-2 md:p-4 pointer-events-none">
                <Image
                  src="/images/empty-large/wallet.svg"
                  alt="Account"
                  width={300}
                  height={200}
                  className="w-[200px] md:w-full h-auto object-contain object-right-bottom opacity-50 md:opacity-100"
                />
              </div>
            </div>
          ) : !hasFilteredResults ? (
            <div className="flex flex-col items-center justify-center min-h-[280px] md:min-h-[340px] w-full bg-[#1A1A1A] rounded-3 p-6 md:p-8 relative overflow-hidden">
              <p className="text-12 md:text-14 xl:text-16 text-secondary-text text-center z-10 mb-4">
                {t("reward_not_found")}
              </p>
              <div className="absolute top-0 right-0 flex items-center justify-center pointer-events-none">
                <Image
                  src="/images/empty-large/not-found-token.svg"
                  alt="Search"
                  width={340}
                  height={340}
                  className="w-[200px] md:w-[340px] h-[200px] md:h-[340px] object-contain opacity-20 md:opacity-30"
                />
              </div>
            </div>
          ) : (
            <Claims
              tableData={filteredClaimsData}
              selectedTokens={selectedTokens}
              setSelectedTokens={handleSelectedTokens}
              isLoading={isLoadingUserData}
              readOnly={Boolean(searchAddress)}
            />
          )}
        </div>
      </div>
      <StakeDialog />
    </Container>
  );
}
