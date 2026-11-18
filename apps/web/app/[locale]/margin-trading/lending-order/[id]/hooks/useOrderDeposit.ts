import { useCallback, useMemo } from "react";
import { Address, getAbiItem, parseUnits } from "viem";
import { useAccount, usePublicClient } from "wagmi";

import { useMarginWriteGas } from "@/app/[locale]/margin-trading/components/MarginGasSettings";
import useMarginGasEstimate from "@/app/[locale]/margin-trading/hooks/useMarginGasEstimate";
import useMarginWalletClient from "@/app/[locale]/margin-trading/hooks/useMarginWalletClient";
import {
  OrderDepositStatus,
  useDepositOrderStatusStore,
} from "@/app/[locale]/margin-trading/lending-order/[id]/stores/useDepositOrderStatusStore";
import { ERC223_ABI } from "@/config/abis/erc223";
import { MARGIN_MODULE_ABI } from "@/config/abis/marginModule";
import { isMarginDeployed } from "@/config/modules";
import { getTransactionWithRetries } from "@/functions/getTransactionWithRetries";
import { useStoreAllowance } from "@/hooks/useAllowance";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { MARGIN_TRADING_ADDRESS } from "@/sdk_bi/addresses";
import { DexChainId } from "@/sdk_bi/chains";
import { Currency } from "@/sdk_bi/entities/currency";
import { Standard } from "@/sdk_bi/standard";
import {
  GasFeeModel,
  RecentTransactionTitleTemplate,
  stringifyObject,
  useRecentTransactionsStore,
} from "@/stores/useRecentTransactionsStore";

export function safeParseDepositUnits(value: string, decimals = 18): bigint | null {
  try {
    return value.trim() ? parseUnits(value, decimals) : null;
  } catch {
    return null;
  }
}

export function resolveOrderDepositCall({
  orderId,
  currency,
  standard,
  amount,
}: {
  orderId: number;
  currency: Currency;
  standard: Standard;
  amount: string;
}) {
  const parsedAmount = safeParseDepositUnits(amount, currency?.decimals ?? 18);
  if (!parsedAmount || parsedAmount <= 0n) {
    return null;
  }

  if (currency.isNative) {
    return {
      isNative: true as const,
      functionName: "orderDepositEth" as const,
      args: [BigInt(orderId)] as const,
      value: parsedAmount,
      parsedAmount,
    };
  }

  return {
    isNative: false as const,
    standard,
    functionName: "orderDepositToken" as const,
    args: [BigInt(orderId), parsedAmount] as const,
    erc223TransferAddress: currency.wrapped.address1 as Address,
    erc223TransferAmount: parsedAmount,
    parsedAmount,
  };
}

export default function useOrderDeposit({
  orderId,
  amount,
  currency,
  standard,
}: {
  orderId: number;
  currency: Currency;
  amount: string;
  standard: Standard;
}) {
  const { setStatus, setDepositHash, setApproveHash, setTransferHash } =
    useDepositOrderStatusStore();
  const chainId = useCurrentChainId();
  const gasOverrides = useMarginWriteGas("depositOrder");
  const { data: walletClient } = useMarginWalletClient("depositOrder");

  const { address } = useAccount();
  const publicClient = usePublicClient();

  const { addRecentTransaction } = useRecentTransactionsStore();
  const parsedAmount = useMemo(
    () => safeParseDepositUnits(amount, currency?.decimals ?? 18),
    [amount, currency?.decimals],
  );

  const { isAllowed: isAllowedA, writeTokenApprove: approveA } = useStoreAllowance({
    token: standard === Standard.ERC20 && !currency.isNative ? currency : undefined,
    contractAddress: MARGIN_TRADING_ADDRESS[chainId],
    amountToCheck: parsedAmount,
  });

  useMarginGasEstimate("depositOrder", () => {
    const resolved = resolveOrderDepositCall({ orderId, currency, standard, amount });
    if (!resolved) return;
    return {
      abi: MARGIN_MODULE_ABI,
      address: MARGIN_TRADING_ADDRESS[chainId],
      functionName: resolved.functionName,
      args: resolved.args,
      value: resolved.isNative ? resolved.value : undefined,
    };
  });

  const handleOrderDeposit = useCallback(
    async (amountToApprove: string) => {
      // Never build a transaction against the zero address on chains without a margin deployment.
      if (!isMarginDeployed(chainId)) {
        return;
      }

      if (!walletClient || !publicClient || !address) {
        return;
      }

      const resolved = resolveOrderDepositCall({
        orderId,
        currency,
        standard,
        amount,
      });

      if (!resolved) {
        setStatus(OrderDepositStatus.ERROR_DEPOSIT);
        return;
      }

      if (resolved.isNative) {
        setStatus(OrderDepositStatus.PENDING_DEPOSIT);

        const nativeParams = {
          abi: MARGIN_MODULE_ABI,
          address: MARGIN_TRADING_ADDRESS[chainId],
          functionName: resolved.functionName,
          args: resolved.args,
          value: resolved.value,
        };

        try {
          const depositOrderHash = await walletClient.writeContract({
            ...nativeParams,
            ...gasOverrides,
            account: undefined,
          });

          setStatus(OrderDepositStatus.LOADING_DEPOSIT);
          setDepositHash(depositOrderHash);

          const transaction = await getTransactionWithRetries({
            hash: depositOrderHash,
            publicClient,
          });

          const nonce = transaction.nonce;

          addRecentTransaction(
            {
              hash: depositOrderHash,
              nonce,
              chainId,
              gas: {
                model: GasFeeModel.EIP1559,
                gas: "0",
                maxFeePerGas: undefined,
                maxPriorityFeePerGas: undefined,
              },
              params: {
                ...stringifyObject(nativeParams),
                abi: [getAbiItem({ name: "orderDepositEth", abi: MARGIN_MODULE_ABI })],
              },
              title: {
                symbol: currency.symbol!,
                template: RecentTransactionTitleTemplate.DEPOSIT,
                amount: amount,
                logoURI: currency?.logoURI || "/images/tokens/placeholder.svg",
              },
            },
            address,
          );

          const receipt = await publicClient.waitForTransactionReceipt({ hash: depositOrderHash });

          if (receipt.status === "success") {
            setStatus(OrderDepositStatus.SUCCESS);
          } else {
            setStatus(OrderDepositStatus.ERROR_DEPOSIT);
          }
        } catch (e) {
          console.error(e);
          setStatus(OrderDepositStatus.ERROR_DEPOSIT);
        }
      } else {
        if (standard === Standard.ERC20) {
          if (!isAllowedA) {
            try {
              const approvalAmount = safeParseDepositUnits(
                amountToApprove || amount,
                currency.decimals ?? 18,
              );
              if (!approvalAmount || approvalAmount < resolved.parsedAmount) {
                setStatus(OrderDepositStatus.ERROR_APPROVE);
                return;
              }
              setStatus(OrderDepositStatus.PENDING_APPROVE);
              const approveResult = await approveA({
                customAmount: approvalAmount,
                customGasSettings: gasOverrides,
              });

              if (!approveResult?.success) {
                setStatus(OrderDepositStatus.ERROR_APPROVE);
                return;
              }

              setApproveHash(approveResult.hash);
              setStatus(OrderDepositStatus.LOADING_APPROVE);

              const approveReceipt = await publicClient.waitForTransactionReceipt({
                hash: approveResult.hash,
              });

              if (approveReceipt.status !== "success") {
                setStatus(OrderDepositStatus.ERROR_APPROVE);
                return;
              }
            } catch (e) {
              console.error(e);
              setStatus(OrderDepositStatus.ERROR_APPROVE);
              return;
            }
          }
        } else {
          setStatus(OrderDepositStatus.PENDING_TRANSFER);
          const _params = {
            account: address as Address,
            abi: ERC223_ABI,
            functionName: "transfer" as const,
            address: resolved.erc223TransferAddress,
            args: [
              MARGIN_TRADING_ADDRESS[chainId as DexChainId],
              resolved.erc223TransferAmount,
            ] as const,
          };

          try {
            const _firstDepositHash = await walletClient.writeContract({
              ..._params,
              ...gasOverrides,
              account: undefined,
            });
            setStatus(OrderDepositStatus.LOADING_TRANSFER);
            setTransferHash(_firstDepositHash);

            const transaction = await getTransactionWithRetries({
              hash: _firstDepositHash,
              publicClient,
            });

            const nonce = transaction.nonce;

            addRecentTransaction(
              {
                hash: _firstDepositHash,
                nonce,
                chainId,
                gas: {
                  model: GasFeeModel.EIP1559,
                  gas: "0",
                  maxFeePerGas: undefined,
                  maxPriorityFeePerGas: undefined,
                },
                params: {
                  ...stringifyObject(_params),
                  abi: [getAbiItem({ name: "transfer", abi: ERC223_ABI })],
                },
                title: {
                  symbol: currency.symbol!,
                  template: RecentTransactionTitleTemplate.TRANSFER,
                  amount: amount,
                  logoURI: currency?.logoURI || "/images/tokens/placeholder.svg",
                },
              },
              address,
            );

            const receipt = await publicClient.waitForTransactionReceipt({
              hash: _firstDepositHash,
            });

            if (receipt.status !== "success") {
              setStatus(OrderDepositStatus.ERROR_TRANSFER);
              return;
            }
          } catch (e) {
            console.error(e);
            setStatus(OrderDepositStatus.ERROR_TRANSFER);
            return;
          }
        }

        setStatus(OrderDepositStatus.PENDING_DEPOSIT);

        const params = {
          abi: MARGIN_MODULE_ABI,
          address: MARGIN_TRADING_ADDRESS[chainId],
          functionName: resolved.functionName,
          args: resolved.args,
        };

        try {
          const depositOrderHash = await walletClient.writeContract({
            ...params,
            ...gasOverrides,
            account: undefined,
          });
          setStatus(OrderDepositStatus.LOADING_DEPOSIT);

          setDepositHash(depositOrderHash);

          const transaction = await getTransactionWithRetries({
            hash: depositOrderHash,
            publicClient,
          });

          const nonce = transaction.nonce;

          addRecentTransaction(
            {
              hash: depositOrderHash,
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
                abi: [getAbiItem({ name: "orderDepositToken", abi: MARGIN_MODULE_ABI })],
              },
              title: {
                symbol: currency.symbol!,
                template: RecentTransactionTitleTemplate.DEPOSIT,
                amount: amount,
                logoURI: currency?.logoURI || "/images/tokens/placeholder.svg",
              },
            },
            address,
          );
          const receipt = await publicClient.waitForTransactionReceipt({ hash: depositOrderHash });
          if (receipt.status === "success") {
            setStatus(OrderDepositStatus.SUCCESS);
          } else {
            setStatus(OrderDepositStatus.ERROR_DEPOSIT);
          }
        } catch (e) {
          setStatus(OrderDepositStatus.ERROR_DEPOSIT);
        }
      }

      return;
    },
    [
      addRecentTransaction,
      address,
      amount,
      approveA,
      chainId,
      gasOverrides,
      currency,
      isAllowedA,
      orderId,
      publicClient,
      setApproveHash,
      setDepositHash,
      setStatus,
      setTransferHash,
      standard,
      walletClient,
    ],
  );

  return { handleOrderDeposit };
}
