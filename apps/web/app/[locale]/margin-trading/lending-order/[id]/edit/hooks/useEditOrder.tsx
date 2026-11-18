import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo } from "react";
import {
  Address,
  encodeAbiParameters,
  encodeFunctionData,
  getAbiItem,
  Hash,
  keccak256,
  parseUnits,
} from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";

import { useEditOrderConfigStore } from "@/app/[locale]/margin-trading/lending-order/[id]/edit/stores/useEditOrderConfigStore";
import {
  EditOrderStatus,
  useEditOrderStatusStore,
} from "@/app/[locale]/margin-trading/lending-order/[id]/edit/stores/useEditOrderStatusStore";
import { OrderDepositStatus } from "@/app/[locale]/margin-trading/lending-order/[id]/stores/useDepositOrderStatusStore";
import {
  LendingOrderTradingTokens,
  TradingTokensInputMode,
} from "@/app/[locale]/margin-trading/lending-order/create/steps/types";
import {
  useCreateOrderGasLimitStore,
  useCreateOrderGasPriceStore,
} from "@/app/[locale]/margin-trading/lending-order/create/stores/useSwapGasSettingsStore";
import { LendingOrder } from "@/app/[locale]/margin-trading/types";
import { MARGIN_MODULE_ABI } from "@/config/abis/marginModule";
import { isMarginDeployed } from "@/config/modules";
import { getGasSettings } from "@/functions/gasSettings";
import { getTransactionWithRetries } from "@/functions/getTransactionWithRetries";
import { useStoreAllowance } from "@/hooks/useAllowance";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import addToast from "@/other/toast";
import { MARGIN_TRADING_ADDRESS, ORACLE_ADDRESS, ZERO_ADDRESS } from "@/sdk_bi/addresses";
import { useGlobalFees } from "@/shared/hooks/useGlobalFees";
import {
  GasFeeModel,
  RecentTransactionTitleTemplate,
  stringifyObject,
  useRecentTransactionsStore,
} from "@/stores/useRecentTransactionsStore";

export function useEditOrderParams() {
  const { firstStepValues, secondStepValues, thirdStepValues } = useEditOrderConfigStore();

  return {
    ...firstStepValues,
    ...secondStepValues,
    ...thirdStepValues,
  };
}

export function sortAddresses(addresses: string[]): string[] {
  return addresses.sort((a, b) => (a.toLowerCase() > b.toLowerCase() ? 1 : -1));
}

/**
 * The trading whitelist the edit would send: the autolisting contract, or the sorted token
 * addresses (ERC-223 forms included when ERC-223 trading is on). Shared by the transaction and the
 * review's "changed" check, so the review only reports a change the transaction would make.
 */
export function buildTradingWhitelist(tradingTokens: LendingOrderTradingTokens): {
  addresses: Address[];
  isAutolisting: boolean;
} {
  if (tradingTokens.inputMode === TradingTokensInputMode.AUTOLISTING) {
    return {
      addresses: tradingTokens.tradingTokensAutoListing
        ? [tradingTokens.tradingTokensAutoListing.id as Address]
        : [],
      isAutolisting: true,
    };
  }
  return {
    addresses: sortAddresses(
      tradingTokens.allowedTokens.flatMap((token) =>
        tradingTokens.includeERC223Trading
          ? [token.wrapped.address0, token.wrapped.address1]
          : [token.wrapped.address0],
      ),
    ) as Address[],
    isAutolisting: false,
  };
}

/** True when the order's current whitelist differs from the one the edit would send. */
export function tradingWhitelistChanged(
  order: Pick<LendingOrder, "allowedTradingAddresses" | "whitelistAutoListing">,
  tradingTokens: LendingOrderTradingTokens,
): boolean {
  const next = buildTradingWhitelist(tradingTokens);
  const orderAutolisting =
    order.whitelistAutoListing && order.whitelistAutoListing.toLowerCase() !== ZERO_ADDRESS
      ? order.whitelistAutoListing.toLowerCase()
      : undefined;
  if (next.isAutolisting || orderAutolisting) {
    return !next.isAutolisting || next.addresses[0]?.toLowerCase() !== orderAutolisting;
  }
  const current = new Set((order.allowedTradingAddresses ?? []).map((a) => a.toLowerCase()));
  const wanted = new Set(next.addresses.map((a) => a.toLowerCase()));
  return current.size !== wanted.size || [...wanted].some((a) => !current.has(a));
}

export function getWhitelistId(addresses: Address[], isContract: boolean): Hash {
  const encoded = encodeAbiParameters(
    [
      { type: "bool", name: "isContract" },
      { type: "address[]", name: "tokens" },
    ],
    [isContract, addresses],
  );

  return keccak256(encoded);
}

/**
 * Calculate the on‐chain interestRate parameter.
 *
 * The contract expects:
 *   – interestRate = (30-day rate × 100) prorated to position duration
 *   – e.g. 11.5% for 30 days ⇒ 1150, half that for 15 days ⇒ 575
 *
 * @param monthlyPct    30-day interest rate in percent (e.g. 11.5 for 11.5%)
 * @param durationDays  Actual position length in days
 * @returns             Integer interestRate for your contract
 */
export function calculateInterestRate(monthlyPct: number, _durationDays: number): bigint {
  if (!Number.isFinite(monthlyPct) || monthlyPct < 0) throw new Error("Invalid interest rate");
  return BigInt(Math.round(monthlyPct * 100));
}

export default function useEditOrder() {
  const t = useTranslations("Swap");
  const { data: walletClient } = useWalletClient();
  const params = useEditOrderParams();
  const publicClient = usePublicClient();
  const chainId = useCurrentChainId();

  const { setStatus, setModifyOrderHash } = useEditOrderStatusStore();

  const {
    isAllowed: isAllowedA,
    writeTokenApprove: approveA,
    updateAllowance,
  } = useStoreAllowance({
    token: params.loanToken,
    contractAddress: MARGIN_TRADING_ADDRESS[chainId],
    amountToCheck: parseUnits(params.loanAmount, params.loanToken?.decimals ?? 18),
  });

  const { addRecentTransaction } = useRecentTransactionsStore();

  const { customGasLimit } = useCreateOrderGasLimitStore();
  const { gasPriceOption, gasPriceSettings } = useCreateOrderGasPriceStore();
  const { baseFee, priorityFee, gasPrice } = useGlobalFees();
  const {
    tradingTokens,
    loanToken,
    loanTokenStandard,
    collateralTokens,
    loanAmount,
    liquidationFeeToken,
    liquidationFeeForLiquidator,
    liquidationMode,
    minimumBorrowingAmount,
    orderCurrencyLimit,
    period,
    interestRatePerMonth,
    leverage,
    priceSource,
  } = useEditOrderParams();

  const gasSettings = useMemo(() => {
    return getGasSettings({
      baseFee,
      chainId,
      gasPrice,
      priorityFee,
      gasPriceOption,
      gasPriceSettings,
    });
  }, [baseFee, chainId, gasPrice, priorityFee, gasPriceOption, gasPriceSettings]);

  const { address } = useAccount();
  useEffect(() => {
    setStatus(EditOrderStatus.INITIAL);
  }, [setStatus]);

  const handleEditOrder = useCallback(
    async (order: LendingOrder, recreateTokenList: boolean) => {
      // Never build a transaction against the zero address on chains without a margin deployment.
      if (!isMarginDeployed(chainId)) {
        return;
      }

      setStatus(EditOrderStatus.PENDING_MODIFY);

      if (
        !params.loanToken ||
        !publicClient ||
        !walletClient ||
        !loanToken ||
        !liquidationFeeToken ||
        (tradingTokens.inputMode === TradingTokensInputMode.AUTOLISTING &&
          !tradingTokens.tradingTokensAutoListing) ||
        !address
      ) {
        return;
      }

      const { addresses: sortedAddresses, isAutolisting } = buildTradingWhitelist(tradingTokens);

      const encodedAddTokenListParams = encodeFunctionData({
        abi: MARGIN_MODULE_ABI,
        functionName: "addTokenlist",
        args: [sortedAddresses, isAutolisting],
      });

      const whitelistId = getWhitelistId(sortedAddresses, isAutolisting);

      const encodedModifyOrderParams = encodeFunctionData({
        abi: MARGIN_MODULE_ABI,
        functionName: "modifyOrder",
        args: [
          BigInt(order.id), // _orderId
          whitelistId, // _whitelist
          calculateInterestRate(Number(interestRatePerMonth), Number(period.positionDuration)), // _interestRate
          BigInt(Math.round(Number(period.positionDuration) * 24 * 60 * 60)), // _duration
          parseUnits(minimumBorrowingAmount.toString(), loanToken.decimals), // _minLoan
          Number(orderCurrencyLimit), // _currencyLimit
          leverage, // _leverage
          ORACLE_ADDRESS[chainId], // _oracle
          parseUnits(liquidationFeeForLiquidator, liquidationFeeToken.decimals), // _liquidationRewardAmount
          liquidationFeeToken.isNative ? ZERO_ADDRESS : liquidationFeeToken.wrapped.address0, // _liquidationRewardAsset
          Math.floor(new Date(period.lendingOrderDeadline).getTime() / 1000), // _deadline
        ],
      });

      const encodedCollateralTokens = encodeFunctionData({
        abi: MARGIN_MODULE_ABI,
        functionName: "orderSetCollaterals",
        args: [
          BigInt(order.id),
          collateralTokens.flatMap((token) => {
            if (tradingTokens.includeERC223Trading) {
              return [token.wrapped.address0, token.wrapped.address1];
            }
            return [token.wrapped.address0];
          }),
        ],
      });

      const actionsToUpdate = recreateTokenList
        ? [encodedAddTokenListParams, encodedModifyOrderParams, encodedCollateralTokens]
        : [encodedModifyOrderParams, encodedCollateralTokens];

      try {
        const modifyOrderHash = await walletClient.writeContract({
          abi: MARGIN_MODULE_ABI,
          address: MARGIN_TRADING_ADDRESS[chainId],
          functionName: "multicall",
          args: [actionsToUpdate],
          account: undefined,
        });
        setStatus(EditOrderStatus.LOADING_MODIFY);
        setModifyOrderHash(modifyOrderHash);

        const transaction = await getTransactionWithRetries({
          hash: modifyOrderHash,
          publicClient,
        });

        const nonce = transaction.nonce;

        addRecentTransaction(
          {
            hash: modifyOrderHash,
            nonce,
            chainId,
            gas: {
              model: GasFeeModel.EIP1559,
              gas: "0",
              maxFeePerGas: undefined,
              maxPriorityFeePerGas: undefined,
            },
            params: {
              ...stringifyObject(params),
              abi: [getAbiItem({ name: "setOrderStatus", abi: MARGIN_MODULE_ABI })],
            },
            title: {
              symbol: order.baseAsset.symbol!,
              orderId: order.id,
              template: RecentTransactionTitleTemplate.EDIT_LENDING_ORDER,
              logoURI: order.baseAsset?.logoURI || "/images/tokens/placeholder.svg",
            },
          },
          address,
        );

        const createOrderReceipt = await publicClient.waitForTransactionReceipt({
          hash: modifyOrderHash,
        });

        if (createOrderReceipt.status === "success") {
          setStatus(EditOrderStatus.SUCCESS);
        } else {
          setStatus(EditOrderStatus.ERROR_MODIFY);
        }

        // console.log("Receipt", receipt);
      } catch (e) {
        console.error(e);
        addToast("Unexpected error", "error");
        setStatus(EditOrderStatus.INITIAL);
      }
    },
    [
      addRecentTransaction,
      address,
      chainId,
      interestRatePerMonth,
      leverage,
      liquidationFeeForLiquidator,
      liquidationFeeToken,
      loanToken,
      minimumBorrowingAmount,
      orderCurrencyLimit,
      params,
      period.lendingOrderDeadline,
      period.positionDuration,
      publicClient,
      setModifyOrderHash,
      setStatus,
      tradingTokens,
      collateralTokens,
      walletClient,
    ],
  );

  return { handleEditOrder };
}
