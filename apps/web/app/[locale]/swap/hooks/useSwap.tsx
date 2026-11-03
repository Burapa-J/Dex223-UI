import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import {
  Address,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  getAbiItem,
  parseUnits,
} from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";

import { useTrade } from "@/app/[locale]/swap/hooks/useTrade";
import { readSwapReceipt, swapOutcomeFromReceipt } from "@/app/[locale]/swap/lib/readSwapReceipt";
import { useSwapAmountsStore } from "@/app/[locale]/swap/stores/useSwapAmountsStore";
import {
  useSwapGasLimitStore,
  useSwapGasPriceStore,
} from "@/app/[locale]/swap/stores/useSwapGasSettingsStore";
import { useSwapSettingsStore } from "@/app/[locale]/swap/stores/useSwapSettingsStore";
import {
  SwapError,
  SwapStatus,
  useSwapStatusStore,
} from "@/app/[locale]/swap/stores/useSwapStatusStore";
import { useSwapTokensStore } from "@/app/[locale]/swap/stores/useSwapTokensStore";
import { ERC223_ABI } from "@/config/abis/erc223";
import { POOL_ABI } from "@/config/abis/pool";
import { ROUTER_ABI } from "@/config/abis/router";
import { TOKEN_CONVERTER_ABI } from "@/config/abis/tokenConverter";
import { formatFloat } from "@/functions/formatFloat";
import { getGasSettings } from "@/functions/gasSettings";
import { getTransactionWithRetries } from "@/functions/getTransactionWithRetries";
import { IIFE } from "@/functions/iife";
import { slippageToPercent } from "@/functions/slippageToPercent";
import { useStoreAllowance } from "@/hooks/useAllowance";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import useDeepEffect from "@/hooks/useDeepEffect";
import useTransactionDeadline from "@/hooks/useTransactionDeadline";
import addToast from "@/other/toast";
import { CONVERTER_ADDRESS, ROUTER_ADDRESS } from "@/sdk_bi/addresses";
import { DEX_SUPPORTED_CHAINS, DexChainId } from "@/sdk_bi/chains";
import { ADDRESS_ZERO, FeeAmount } from "@/sdk_bi/constants";
import { Currency } from "@/sdk_bi/entities/currency";
import { CurrencyAmount } from "@/sdk_bi/entities/fractions/currencyAmount";
import { Percent } from "@/sdk_bi/entities/fractions/percent";
import { Trade } from "@/sdk_bi/entities/trade";
import { ONE } from "@/sdk_bi/internalConstants";
import { getTokenAddressForStandard, Standard } from "@/sdk_bi/standard";
import { useComputePoolAddressDex } from "@/sdk_bi/utils/computePoolAddress";
import { TickMath } from "@/sdk_bi/utils/tickMath";
import { useGlobalFees } from "@/shared/hooks/useGlobalFees";
import { useConfirmInWalletAlertStore } from "@/stores/useConfirmInWalletAlertStore";
import {
  RecentTransactionTitleTemplate,
  stringifyObject,
  useRecentTransactionsStore,
} from "@/stores/useRecentTransactionsStore";

export function useSwapStatus() {
  const { status: swapStatus } = useSwapStatusStore();

  return {
    isPendingApprove: swapStatus === SwapStatus.PENDING_APPROVE,
    isLoadingApprove: swapStatus === SwapStatus.LOADING_APPROVE,
    isPendingSwap: swapStatus === SwapStatus.PENDING,
    isLoadingSwap: swapStatus === SwapStatus.LOADING,
    isSuccessSwap: swapStatus === SwapStatus.SUCCESS,
    isRevertedSwap: swapStatus === SwapStatus.ERROR,
    isSettledSwap: swapStatus === SwapStatus.SUCCESS || swapStatus === SwapStatus.ERROR,
    isRevertedApprove: swapStatus === SwapStatus.APPROVE_ERROR,
  };
}

function encodePath(address0: Address, address1: Address, fee: FeeAmount): Address {
  return `${address0}${fee.toString(16).padStart(6, "0")}${address1.slice(2)}`;
}

export function useSwapParams({ trade }: { trade: Trade<any, any, any> | null }) {
  const { tokenA, tokenB, tokenAStandard, tokenBStandard } = useSwapTokensStore();
  const chainId = useCurrentChainId();
  const { address } = useAccount();

  const { typedValue } = useSwapAmountsStore();

  const { slippage, deadline: _deadline } = useSwapSettingsStore();
  const deadline = useTransactionDeadline(_deadline);

  const poolAddress = useComputePoolAddressDex({
    tokenA,
    tokenB,
    tier: trade?.swaps[0].route.pools[0].fee || FeeAmount.MEDIUM,
  });

  const dependentAmount: CurrencyAmount<Currency> | undefined = useMemo(() => {
    return trade?.outputAmount;
  }, [trade?.outputAmount]);

  const minimumAmountOut = useMemo(() => {
    if (!trade) {
      return BigInt(0);
    }

    return BigInt(
      trade.minimumAmountOut(slippageToPercent(slippage), dependentAmount).quotient.toString(),
    );
  }, [dependentAmount, slippage, trade]);

  const swapParams = useMemo(() => {
    if (
      !tokenA ||
      !tokenB ||
      !chainId ||
      !DEX_SUPPORTED_CHAINS.includes(chainId) ||
      !typedValue ||
      !address
    ) {
      return null;
    }

    // Same order as the pool's token0/token1. A plain string compare of checksummed addresses
    // gets it wrong when letter case differs (WETH 0xb16F… vs USDC 0xFC86…).
    const zeroForOne =
      !tokenA.wrapped.equals(tokenB.wrapped) && tokenA.wrapped.sortsBefore(tokenB.wrapped);

    const sqrtPriceLimitX96 = zeroForOne
      ? TickMath.MIN_SQRT_RATIO + ONE
      : TickMath.MAX_SQRT_RATIO - ONE;

    const routerParams = {
      tokenIn: tokenA.wrapped.address0,
      tokenOut: tokenB.wrapped.address0,
      fee: trade?.swaps[0].route.pools[0].fee || FeeAmount.MEDIUM,
      recipient: address as Address,
      deadline,
      amountIn: parseUnits(typedValue, tokenA.decimals),
      amountOutMinimum: minimumAmountOut,
      sqrtPriceLimitX96: sqrtPriceLimitX96,
      prefer223Out: tokenBStandard === Standard.ERC223,
    };

    if (tokenA.equals(tokenB)) {
      if (tokenAStandard === Standard.ERC223) {
        return {
          address: getTokenAddressForStandard(tokenA, tokenAStandard),
          abi: ERC223_ABI,
          functionName: "transfer" as "transfer",
          args: [
            CONVERTER_ADDRESS[chainId as DexChainId],
            parseUnits(typedValue, tokenA.decimals),
            encodeFunctionData({
              abi: TOKEN_CONVERTER_ABI,
              functionName: "convertERC20" as "convertERC20",
              args: [tokenA.wrapped.address0, parseUnits(typedValue, tokenA.decimals)],
            }),
          ],
        };
      }

      if (tokenAStandard === Standard.ERC20) {
        return {
          address: CONVERTER_ADDRESS[chainId as DexChainId],
          abi: TOKEN_CONVERTER_ABI,
          functionName: "convertERC20" as "convertERC20",
          args: [tokenA.wrapped.address0, parseUnits(typedValue, tokenA.decimals)],
        };
      }
    }

    if (!poolAddress || !trade) {
      return null;
    }

    if (tokenA.isNative) {
      return {
        address: ROUTER_ADDRESS[chainId as DexChainId],
        abi: ROUTER_ABI,
        functionName: "exactInputSingle" as "exactInputSingle",
        args: [routerParams],
        value: parseUnits(typedValue, tokenA.decimals),
      };
    }

    if (tokenAStandard === Standard.ERC20) {
      const _params = {
        abi: ROUTER_ABI,
        functionName: "exactInputSingle" as "exactInputSingle",
        args: [routerParams],
      };

      if (tokenB.isNative) {
        const encodedSwapParams = encodeFunctionData({
          abi: ROUTER_ABI,
          functionName: "exactInput" as "exactInput",
          args: [
            {
              path: encodePath(
                tokenA.address0,
                tokenB.wrapped.address0,
                trade?.swaps[0].route.pools[0].fee || FeeAmount.MEDIUM,
              ),
              deadline,
              recipient: ROUTER_ADDRESS[chainId],
              amountOutMinimum: minimumAmountOut,
              amountIn: parseUnits(typedValue, tokenA.decimals),
              prefer223Out: false,
            },
          ],
        });
        const encodedUnwrapParams = encodeFunctionData({
          abi: ROUTER_ABI,
          functionName: "unwrapWETH9" as const,
          args: [minimumAmountOut, address],
        });

        return {
          address: ROUTER_ADDRESS[chainId],
          abi: ROUTER_ABI,
          functionName: "multicall" as "multicall",
          args: [[encodedSwapParams, encodedUnwrapParams]],
        };
      } else {
        return { ..._params, address: ROUTER_ADDRESS[chainId as DexChainId] };
      }
    }

    if (tokenAStandard === Standard.ERC223) {
      return {
        address: getTokenAddressForStandard(tokenA, tokenAStandard),
        abi: ERC223_ABI,
        functionName: "transfer" as "transfer",
        args: [
          poolAddress.poolAddress,
          parseUnits(typedValue, tokenA.decimals), // amountSpecified
          encodeFunctionData({
            abi: POOL_ABI,
            functionName: "swapExactInput",
            args: [
              (address as Address) || poolAddress.poolAddress, // recipient
              zeroForOne, //zeroForOne
              parseUnits(typedValue, tokenA.decimals), // amountSpecified
              minimumAmountOut, //amountOutMinimum
              BigInt(sqrtPriceLimitX96.toString()), //sqrtPriceLimitX96
              tokenBStandard === Standard.ERC223, // prefer223Out
              encodeAbiParameters(
                [
                  { name: "path", type: "bytes" },
                  { name: "payer", type: "address" },
                ],
                [
                  encodePacked(
                    ["address", "uint24", "address"],
                    [
                      tokenA.address0,
                      trade?.swaps[0].route.pools[0].fee || FeeAmount.MEDIUM,
                      tokenB.wrapped.address0,
                    ],
                  ),
                  ADDRESS_ZERO,
                ],
              ),
              deadline,
              tokenB.isNative,
            ],
          }),
        ],
      };
    }
  }, [
    address,
    chainId,
    deadline,
    minimumAmountOut,
    poolAddress,
    tokenA,
    tokenAStandard,
    tokenB,
    tokenBStandard,
    trade,
    typedValue,
  ]);

  return { swapParams };
}

export function useSwapEstimatedGas({ trade }: { trade: Trade<any, any, any> | null }) {
  const { address } = useAccount();
  const { swapParams } = useSwapParams({ trade });
  const publicClient = usePublicClient();
  const { setEstimatedGas } = useSwapGasLimitStore();
  const { tokenA, tokenB, tokenAStandard } = useSwapTokensStore();
  const chainId = useCurrentChainId();
  const { typedValue } = useSwapAmountsStore();

  const { isAllowed: isAllowedA } = useStoreAllowance({
    token: tokenA,
    contractAddress: ROUTER_ADDRESS[chainId],
    amountToCheck: parseUnits(typedValue, tokenA?.decimals ?? 18),
  });

  useDeepEffect(() => {
    IIFE(async () => {
      if (!swapParams || !address || (!isAllowedA && tokenAStandard === Standard.ERC20)) {
        setEstimatedGas(BigInt(195000));
        return;
      }

      try {
        const estimated = await publicClient?.estimateContractGas({
          account: address,
          ...swapParams,
        } as any);

        if (estimated) {
          setEstimatedGas(estimated + BigInt(10000));
        } else {
          setEstimatedGas(BigInt(195000));
        }
      } catch (e) {
        setEstimatedGas(BigInt(195000));
      }
    });
  }, [publicClient, address, swapParams, isAllowedA]);
}

export default function useSwap() {
  const t = useTranslations("Swap");
  const { data: walletClient } = useWalletClient();
  const { tokenA, tokenB, tokenAStandard, tokenBStandard } = useSwapTokensStore();
  const { trade } = useTrade();
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const chainId = useCurrentChainId();

  const { customGasLimit } = useSwapGasLimitStore();
  const { gasPriceOption, gasPriceSettings } = useSwapGasPriceStore();

  const { baseFee, priorityFee, gasPrice } = useGlobalFees();

  const { typedValue } = useSwapAmountsStore();
  const { addRecentTransaction } = useRecentTransactionsStore();

  const {
    status: swapStatus,
    setStatus: setSwapStatus,
    setSwapHash,
    setApproveHash,
    setErrorType,
    setIsReceiptUnavailable,
  } = useSwapStatusStore();

  const { openConfirmInWalletAlert, closeConfirmInWalletAlert } = useConfirmInWalletAlertStore();

  const isConversion = useMemo(() => tokenB && tokenA?.equals(tokenB), [tokenA, tokenB]);

  const contractAddress = useMemo(() => {
    return isConversion ? CONVERTER_ADDRESS : ROUTER_ADDRESS;
  }, [isConversion]);

  const {
    isAllowed: isAllowedA,
    writeTokenApprove: approveA,
    updateAllowance,
  } = useStoreAllowance({
    token: tokenA,
    contractAddress: contractAddress[chainId],
    amountToCheck: parseUnits(typedValue, tokenA?.decimals ?? 18),
  });

  const output = useMemo(() => {
    if (isConversion) {
      return typedValue;
    }

    if (!trade) {
      return "";
    }

    return formatFloat(trade.outputAmount.toSignificant(), { significantDigits: 2 });
  }, [isConversion, trade, typedValue]);

  const { swapParams } = useSwapParams({ trade });

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

  const handleSwap = useCallback(
    async (amountToApprove: string) => {
      const currentStatus = useSwapStatusStore.getState().status;
      if (
        currentStatus === SwapStatus.PENDING_APPROVE ||
        currentStatus === SwapStatus.LOADING_APPROVE ||
        currentStatus === SwapStatus.PENDING ||
        currentStatus === SwapStatus.LOADING
      )
        return;

      if (!publicClient || !tokenA) {
        return;
      }

      if (!isAllowedA && tokenAStandard === Standard.ERC20 && tokenA.isToken) {
        openConfirmInWalletAlert(t("confirm_action_in_your_wallet_alert"));

        setSwapStatus(SwapStatus.PENDING_APPROVE);
        const result = await approveA({
          customAmount: parseUnits(amountToApprove, tokenA?.decimals ?? 18),
          customGasSettings: gasSettings,
        });

        if (!result?.success) {
          setSwapStatus(SwapStatus.INITIAL);
          closeConfirmInWalletAlert();
          return;
        } else {
          setApproveHash(result.hash);
          setSwapStatus(SwapStatus.LOADING_APPROVE);
          closeConfirmInWalletAlert();

          let approveReceipt;
          try {
            approveReceipt = await readSwapReceipt(publicClient, result.hash);
          } catch (e) {
            console.error(e);
            approveReceipt = null;
          }

          if (!approveReceipt) {
            setIsReceiptUnavailable(true);
            setSwapStatus(SwapStatus.APPROVE_ERROR);
            return;
          }

          if (approveReceipt.status === "reverted") {
            setSwapStatus(SwapStatus.APPROVE_ERROR);
            return;
          }
        }
      }

      if (
        !walletClient ||
        !address ||
        !tokenA ||
        !tokenB ||
        (!tokenA.equals(tokenB) && (!trade || !chainId)) ||
        !swapParams ||
        typeof output == null
        // !estimatedGas
      ) {
        return;
      }

      setSwapStatus(SwapStatus.PENDING);
      openConfirmInWalletAlert(t("confirm_action_in_your_wallet_alert"));

      let hash;
      let gasToUse: bigint | undefined;

      const applyReceiptOutcome = (receipt: Awaited<ReturnType<typeof readSwapReceipt>>) => {
        const outcome = swapOutcomeFromReceipt(receipt, gasToUse);
        if (outcome === "pending") {
          setIsReceiptUnavailable(true);
        } else if (outcome === "success") {
          updateAllowance();
          setSwapStatus(SwapStatus.SUCCESS);
        } else {
          setSwapStatus(SwapStatus.ERROR);
          setErrorType(outcome === "out_of_gas" ? SwapError.OUT_OF_GAS : SwapError.UNKNOWN);
        }
      };

      try {
        const estimatedGas = await publicClient.estimateContractGas({
          account: address,
          ...swapParams,
        } as any);

        gasToUse = customGasLimit ? customGasLimit : estimatedGas + BigInt(30000); // set custom gas here if user changed it

        let _request;
        try {
          const { request } = await publicClient.simulateContract({
            ...swapParams,
            account: address,
            ...gasSettings,
            gas: gasToUse,
          } as any);
          _request = request;
        } catch (e) {
          _request = {
            ...swapParams,
            ...gasSettings,
            gas: gasToUse,
            account: undefined,
          } as any;
        }

        hash = await walletClient.writeContract({
          ..._request,
          account: undefined,
        });

        closeConfirmInWalletAlert();

        if (hash) {
          setSwapHash(hash);
          setSwapStatus(SwapStatus.LOADING);

          // Record the broadcast even if the RPC cannot return transaction metadata yet.
          let transaction;
          try {
            transaction = await getTransactionWithRetries({ hash, publicClient });
          } catch (error) {
            console.error(error);
          }
          const nonce = transaction?.nonce;

          addRecentTransaction(
            {
              hash,
              nonce,
              chainId,
              gas: {
                ...stringifyObject({ ...gasSettings, model: gasPriceSettings.model }),
                gas: gasToUse.toString(),
              },
              params: {
                ...stringifyObject(swapParams),
                abi: [
                  getAbiItem({
                    name: swapParams.functionName,
                    abi: swapParams.abi,
                    args: swapParams.args as any,
                  }),
                ],
              },
              title: isConversion
                ? {
                    symbol: tokenA.symbol!,
                    template: RecentTransactionTitleTemplate.CONVERT,
                    amount: typedValue,
                    logoURI: tokenA?.logoURI || "/images/tokens/placeholder.svg",
                    standard: tokenBStandard,
                  }
                : {
                    symbol0: tokenA.symbol!,
                    symbol1: tokenB.symbol!,
                    template: RecentTransactionTitleTemplate.SWAP,
                    amount0: typedValue,
                    amount1: output,
                    logoURI0: tokenA?.logoURI || "/images/tokens/placeholder.svg",
                    logoURI1: tokenB?.logoURI || "/images/tokens/placeholder.svg",
                  },
            },
            address,
          );

          applyReceiptOutcome(await readSwapReceipt(publicClient, hash));
        } else {
          setSwapStatus(SwapStatus.INITIAL);
        }
      } catch (e) {
        console.error(e);
        closeConfirmInWalletAlert();
        if (hash) {
          setSwapHash(hash);
          setSwapStatus(SwapStatus.LOADING);
          applyReceiptOutcome(await readSwapReceipt(publicClient, hash, e));
          return;
        }
        addToast("Error while executing contract", "error");
        setSwapStatus(SwapStatus.INITIAL);
      }
    },
    [
      publicClient,
      tokenA,
      isAllowedA,
      tokenAStandard,
      walletClient,
      address,
      tokenB,
      trade,
      chainId,
      swapParams,
      output,
      setSwapStatus,
      openConfirmInWalletAlert,
      t,
      approveA,
      gasSettings,
      closeConfirmInWalletAlert,
      setApproveHash,
      customGasLimit,
      setSwapHash,
      addRecentTransaction,
      gasPriceSettings.model,
      isConversion,
      typedValue,
      tokenBStandard,
      updateAllowance,
      setErrorType,
      setIsReceiptUnavailable,
    ],
  );

  return {
    handleSwap,
    isAllowedA: isAllowedA,
    isConversion,
    handleApprove: () => null,
  };
}
