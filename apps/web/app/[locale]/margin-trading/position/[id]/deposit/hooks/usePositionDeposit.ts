import { useCallback, useMemo } from "react";
import { Address, getAbiItem, parseUnits } from "viem";
import { useAccount, usePublicClient } from "wagmi";

import { useMarginWriteGas } from "@/app/[locale]/margin-trading/components/MarginGasSettings";
import { getMarginAssetAddress } from "@/app/[locale]/margin-trading/helpers/assetFunding";
import useMarginGasEstimate from "@/app/[locale]/margin-trading/hooks/useMarginGasEstimate";
import useMarginWalletClient from "@/app/[locale]/margin-trading/hooks/useMarginWalletClient";
import {
  PositionDepositStatus,
  SwapError,
  useDepositPositionStatusStore,
} from "@/app/[locale]/margin-trading/position/[id]/stores/usePositionDepositStatusStore";
import { LendingOrder, MarginPosition } from "@/app/[locale]/margin-trading/types";
import { ERC223_ABI } from "@/config/abis/erc223";
import { MARGIN_MODULE_ABI } from "@/config/abis/marginModule";
import { ORACLE_ABI } from "@/config/abis/oracle";
import { isMarginDeployed } from "@/config/modules";
import { getTransactionWithRetries } from "@/functions/getTransactionWithRetries";
import { useStoreAllowance } from "@/hooks/useAllowance";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { MARGIN_TRADING_ADDRESS, ORACLE_ADDRESS, ZERO_ADDRESS } from "@/sdk_bi/addresses";
import { Currency } from "@/sdk_bi/entities/currency";
import { Standard } from "@/sdk_bi/standard";
import {
  GasFeeModel,
  RecentTransactionTitleTemplate,
  stringifyObject,
  useRecentTransactionsStore,
} from "@/stores/useRecentTransactionsStore";

export function isAutolistedOrder(order: Omit<LendingOrder, "positions">): boolean {
  return Boolean(
    order.whitelistAutoListing && order.whitelistAutoListing.toLowerCase() !== ZERO_ADDRESS,
  );
}

export function getPositionDepositAllowedAddresses(position: MarginPosition): Set<string> {
  const allowed = new Set<string>();
  const addIfNonZero = (addr?: string) => {
    if (addr && addr.toLowerCase() !== ZERO_ADDRESS) {
      allowed.add(addr.toLowerCase());
    }
  };

  for (const addr of position.order.allowedTradingAddresses ?? []) {
    addIfNonZero(addr);
  }

  for (const asset of position.assetAddresses ?? []) {
    addIfNonZero(asset.address);
  }

  if (!position.order.baseAsset.isNative) {
    const baseAddress =
      position.order.baseAssetAddress ??
      getMarginAssetAddress(position.order.baseAsset, position.order.baseAssetStandard);
    addIfNonZero(baseAddress);
  }

  if (position.collateralAsset && !position.collateralAsset.isNative) {
    const colAddr0 = position.collateralAsset.wrapped.address0.toLowerCase();
    const colAddr1 = position.collateralAsset.wrapped.address1.toLowerCase();
    const matchedCollateral = (position.order.collateralAddresses ?? []).filter((addr) => {
      const lower = addr.toLowerCase();
      return lower === colAddr0 || lower === colAddr1;
    });
    if (matchedCollateral.length > 0) {
      for (const addr of matchedCollateral) {
        addIfNonZero(addr);
      }
    } else {
      addIfNonZero(colAddr0);
      addIfNonZero(colAddr1);
    }
  }

  return allowed;
}

export function getPositionDepositAllowedStandards(
  position: MarginPosition,
  currency: Currency | undefined,
): { allowErc20: boolean; allowErc223: boolean } {
  if (!currency || currency.isNative) {
    return { allowErc20: false, allowErc223: false };
  }

  const addr0 = currency.wrapped.address0.toLowerCase();
  const addr1 = currency.wrapped.address1.toLowerCase();
  const hasValidErc223 = Boolean(addr1 && addr1 !== ZERO_ADDRESS);

  if (isAutolistedOrder(position.order)) {
    return { allowErc20: true, allowErc223: hasValidErc223 };
  }

  const allowedSet = getPositionDepositAllowedAddresses(position);
  return {
    allowErc20: allowedSet.has(addr0),
    allowErc223: hasValidErc223 && allowedSet.has(addr1),
  };
}

export function getPositionDepositableTokens(
  position: MarginPosition,
  allTokens?: Currency[],
): Currency[] {
  const candidates = [
    position.loanAsset,
    position.collateralAsset,
    ...(position.assets ?? []),
    ...(position.order.allowedCollateralAssets ?? []),
    ...(position.order.allowedTradingAssets ?? []),
    ...(isAutolistedOrder(position.order) && allTokens ? allTokens : []),
  ];

  const seen = new Set<string>();
  const result: Currency[] = [];

  for (const token of candidates) {
    if (!token || token.isNative) continue;
    const key = token.wrapped.address0.toLowerCase();
    if (seen.has(key)) continue;
    const { allowErc20, allowErc223 } = getPositionDepositAllowedStandards(position, token);
    if (!allowErc20 && !allowErc223) continue;
    seen.add(key);
    result.push(token);
  }

  return result;
}

export function resolvePositionDepositParams(
  position: MarginPosition,
  currency: Currency,
  standard: Standard,
): {
  depositAddress: Address;
  whitelistId: bigint;
  isAllowedAsset: boolean;
  existingAsset: boolean;
} {
  const depositAddress = getMarginAssetAddress(currency, standard);
  const { allowErc20, allowErc223 } = getPositionDepositAllowedStandards(position, currency);
  const isStandardAllowed = standard === Standard.ERC223 ? allowErc223 : allowErc20;
  const assetIndex = (position.order.allowedTradingAddresses ?? []).findIndex(
    (asset) => asset.toLowerCase() === depositAddress.toLowerCase(),
  );
  const whitelistId = assetIndex >= 0 ? BigInt(assetIndex) : 0n;
  const existingAsset = (position.assetAddresses ?? []).some(
    (asset) => asset.address.toLowerCase() === depositAddress.toLowerCase(),
  );
  const isAllowedAsset =
    !currency.isNative &&
    isStandardAllowed &&
    (assetIndex >= 0 ||
      isAutolistedOrder(position.order) ||
      getPositionDepositAllowedAddresses(position).has(depositAddress.toLowerCase()));

  return {
    depositAddress,
    whitelistId,
    isAllowedAsset,
    existingAsset,
  };
}

export function usePositionDepositGasEstimate({
  position,
  amount,
  currency,
  standard,
}: {
  position: MarginPosition;
  amount: string;
  currency: Currency | undefined;
  standard: Standard;
}) {
  const chainId = useCurrentChainId();
  useMarginGasEstimate("depositPosition", () => {
    if (
      !currency ||
      currency.isNative ||
      !amount.trim() ||
      position.isClosed ||
      position.isLiquidated
    ) {
      return;
    }
    let parsedAmount: bigint;
    try {
      parsedAmount = parseUnits(amount, currency.decimals);
    } catch {
      return;
    }
    if (parsedAmount <= 0n) return;
    const { depositAddress, whitelistId, isAllowedAsset } = resolvePositionDepositParams(
      position,
      currency,
      standard,
    );
    if (!isAllowedAsset) return;
    return {
      abi: MARGIN_MODULE_ABI,
      address: MARGIN_TRADING_ADDRESS[chainId],
      functionName: "positionDeposit" as const,
      args: [BigInt(position.id), depositAddress, whitelistId, parsedAmount] as const,
    };
  });
}

export default function usePositionDeposit({
  position,
  amount,
  currency,
  standard,
}: {
  position: MarginPosition;
  currency: Currency;
  amount: string;
  standard: Standard;
}) {
  const { setStatus, setErrorType, setDepositHash, setApproveHash, setTransferHash } =
    useDepositPositionStatusStore();
  const chainId = useCurrentChainId();
  const gasOverrides = useMarginWriteGas("depositPosition");
  const { data: walletClient } = useMarginWalletClient("depositPosition");
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const { addRecentTransaction } = useRecentTransactionsStore();
  const parsedAmount = useMemo(() => {
    try {
      return amount.trim() ? parseUnits(amount, currency.decimals) : null;
    } catch {
      return null;
    }
  }, [amount, currency.decimals]);
  const { depositAddress, whitelistId, isAllowedAsset, existingAsset } = useMemo(
    () => resolvePositionDepositParams(position, currency, standard),
    [currency, position, standard],
  );
  const { isAllowed, writeTokenApprove } = useStoreAllowance({
    token: standard === Standard.ERC20 && !currency.isNative ? currency : undefined,
    contractAddress: MARGIN_TRADING_ADDRESS[chainId],
    amountToCheck: parsedAmount,
  });

  usePositionDepositGasEstimate({ position, amount, currency, standard });

  const handlePositionDeposit = useCallback(
    async (amountToApprove: string) => {
      if (!isMarginDeployed(chainId) || !walletClient || !publicClient || !address) return;
      setErrorType(SwapError.UNKNOWN);
      // positionDeposit is nonpayable and only the owner of an open position can call it.
      if (
        !parsedAmount ||
        parsedAmount <= 0n ||
        !isAllowedAsset ||
        position.isClosed ||
        position.isLiquidated ||
        position.owner.toLowerCase() !== address.toLowerCase() ||
        (!existingAsset && position.assetAddresses.length >= position.order.currencyLimit)
      ) {
        setStatus(PositionDepositStatus.ERROR_DEPOSIT);
        return;
      }

      // A deposit of anything but the base asset values the position through the oracle, which
      // reverts the deposit ("Oracle: no pool found") when it has no pool for the asset. Check
      // first, so nothing is approved or transferred for a deposit that cannot succeed.
      const baseAddress = position.assetAddresses[0]?.address;
      if (baseAddress && depositAddress.toLowerCase() !== baseAddress.toLowerCase()) {
        try {
          await publicClient.readContract({
            abi: ORACLE_ABI,
            address: ORACLE_ADDRESS[chainId],
            functionName: "findPoolWithHighestLiquidity",
            args: [depositAddress, baseAddress],
          });
        } catch (error) {
          if (/no pool found/i.test(String((error as Error)?.message ?? error))) {
            setErrorType(SwapError.NO_ORACLE_PRICE);
            setStatus(PositionDepositStatus.ERROR_DEPOSIT);
            return;
          }
          // Any other read failure (RPC hiccup): let the deposit itself decide.
        }
      }

      let failureStatus = PositionDepositStatus.ERROR_DEPOSIT;
      try {
        if (standard === Standard.ERC20 && !isAllowed) {
          const approvalAmount = parseUnits(amountToApprove, currency.decimals);
          if (approvalAmount < parsedAmount) throw new Error("Approval is too small");
          failureStatus = PositionDepositStatus.ERROR_APPROVE;
          setStatus(PositionDepositStatus.PENDING_APPROVE);
          const result = await writeTokenApprove({
            customAmount: approvalAmount,
            customGasSettings: gasOverrides,
          });
          if (!result?.success) throw new Error("Approval failed");
          setApproveHash(result.hash);
          setStatus(PositionDepositStatus.LOADING_APPROVE);
          if (
            (await publicClient.waitForTransactionReceipt({ hash: result.hash })).status !==
            "success"
          )
            throw new Error("Approval failed");
        }
        if (standard === Standard.ERC223) {
          failureStatus = PositionDepositStatus.ERROR_TRANSFER;
          setStatus(PositionDepositStatus.PENDING_TRANSFER);
          const hash = await walletClient.writeContract({
            abi: ERC223_ABI,
            address: depositAddress,
            functionName: "transfer",
            args: [MARGIN_TRADING_ADDRESS[chainId], parsedAmount],
            ...gasOverrides,
            account: undefined,
          });
          setTransferHash(hash);
          setStatus(PositionDepositStatus.LOADING_TRANSFER);
          const transaction = await getTransactionWithRetries({ hash, publicClient });
          addRecentTransaction(
            {
              hash,
              nonce: transaction.nonce,
              chainId,
              gas: {
                model: GasFeeModel.EIP1559,
                gas: "0",
                maxFeePerGas: undefined,
                maxPriorityFeePerGas: undefined,
              },
              params: {
                ...stringifyObject({
                  address: depositAddress,
                  functionName: "transfer",
                  args: [MARGIN_TRADING_ADDRESS[chainId], parsedAmount],
                }),
                abi: [getAbiItem({ name: "transfer", abi: ERC223_ABI })],
              },
              title: {
                symbol: currency.symbol!,
                template: RecentTransactionTitleTemplate.TRANSFER,
                amount,
                logoURI: currency.logoURI || "/images/tokens/placeholder.svg",
              },
            },
            address,
          );
          if ((await publicClient.waitForTransactionReceipt({ hash })).status !== "success")
            throw new Error("Transfer failed");
        }

        failureStatus = PositionDepositStatus.ERROR_DEPOSIT;
        setStatus(PositionDepositStatus.PENDING_DEPOSIT);
        const depositParams = {
          abi: MARGIN_MODULE_ABI,
          address: MARGIN_TRADING_ADDRESS[chainId],
          functionName: "positionDeposit" as const,
          args: [BigInt(position.id), depositAddress, whitelistId, parsedAmount] as const,
        };
        const hash = await walletClient.writeContract({
          ...depositParams,
          ...gasOverrides,
          account: undefined,
        });
        setDepositHash(hash);
        setStatus(PositionDepositStatus.LOADING_DEPOSIT);
        const transaction = await getTransactionWithRetries({ hash, publicClient });
        addRecentTransaction(
          {
            hash,
            nonce: transaction.nonce,
            chainId,
            gas: {
              model: GasFeeModel.EIP1559,
              gas: "0",
              maxFeePerGas: undefined,
              maxPriorityFeePerGas: undefined,
            },
            params: {
              ...stringifyObject(depositParams),
              abi: [getAbiItem({ name: "positionDeposit", abi: MARGIN_MODULE_ABI })],
            },
            title: {
              symbol: currency.symbol!,
              template: RecentTransactionTitleTemplate.DEPOSIT,
              amount,
              logoURI: currency.logoURI || "/images/tokens/placeholder.svg",
            },
          },
          address,
        );
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        setStatus(
          receipt.status === "success"
            ? PositionDepositStatus.SUCCESS
            : PositionDepositStatus.ERROR_DEPOSIT,
        );
      } catch (error) {
        console.error(error);
        setStatus(failureStatus);
      }
    },
    [
      addRecentTransaction,
      amount,
      currency,
      address,
      chainId,
      depositAddress,
      existingAsset,
      gasOverrides,
      isAllowed,
      isAllowedAsset,
      parsedAmount,
      position,
      publicClient,
      setApproveHash,
      setDepositHash,
      setErrorType,
      setStatus,
      setTransferHash,
      standard,
      walletClient,
      whitelistId,
      writeTokenApprove,
    ],
  );

  return { handlePositionDeposit };
}
