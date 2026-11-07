import { useCallback, useEffect, useMemo } from "react";
import { getAbiItem, parseUnits } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";

import { useMarginSwapAmountsStore } from "@/app/[locale]/margin-swap/stores/useMarginSwapAmountsStore";
import { useMarginSwapPositionStore } from "@/app/[locale]/margin-swap/stores/useMarginSwapPositionStore";
import { useMarginSwapSettingsStore } from "@/app/[locale]/margin-swap/stores/useMarginSwapSettingsStore";
import {
  MarginSwapStatus,
  useMarginSwapStatusStore,
} from "@/app/[locale]/margin-swap/stores/useMarginSwapStatusStore";
import { useMarginSwapTokensStore } from "@/app/[locale]/margin-swap/stores/useMarginSwapTokensStore";
import useMarginPositionById from "@/app/[locale]/margin-trading/hooks/useMarginPosition";
import { useMarginTrade } from "@/app/[locale]/swap/hooks/useTrade";
import { MARGIN_MODULE_ABI } from "@/config/abis/marginModule";
import { isMarginDeployed } from "@/config/modules";
import { getTransactionWithRetries } from "@/functions/getTransactionWithRetries";
import { slippageToPercent } from "@/functions/slippageToPercent";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { refreshMarginQueries } from "@/hooks/useMarginModuleApolloClient";
import { MARGIN_TRADING_ADDRESS } from "@/sdk_bi/addresses";
import { Currency } from "@/sdk_bi/entities/currency";
import { CurrencyAmount } from "@/sdk_bi/entities/fractions/currencyAmount";
import { Percent } from "@/sdk_bi/entities/fractions/percent";
import { ONE } from "@/sdk_bi/internalConstants";
import { TickMath } from "@/sdk_bi/utils/tickMath";
import { useGlobalBlockNumber } from "@/shared/hooks/useGlobalBlockNumber";
import { _usePoolsStore } from "@/stores/usePoolsStore";
import { useRecentTransactionsStore } from "@/stores/useRecentTransactionsStore";

export default function useMarginSwap() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const chainId = useCurrentChainId();
  const { marginSwapPositionId } = useMarginSwapPositionStore();

  const {
    loading,
    position: marginSwapPosition,
    refetch,
  } = useMarginPositionById({
    id: marginSwapPositionId?.toString(),
  });

  const { blockNumber } = useGlobalBlockNumber();

  useEffect(() => {
    refetch();
  }, [blockNumber, refetch]);
  const { tokenA, tokenB, tokenAStandard } = useMarginSwapTokensStore();
  const { typedValue } = useMarginSwapAmountsStore();
  const { trade } = useMarginTrade();
  const { slippage, deadline: _deadline } = useMarginSwapSettingsStore();
  const { setStatus, setMarginSwapHash } = useMarginSwapStatusStore();

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

  const { address } = useAccount();
  const { addRecentTransaction } = useRecentTransactionsStore();

  const handleMarginSwap = useCallback(async () => {
    // Never build a transaction against the zero address on chains without a margin deployment.
    if (!isMarginDeployed(chainId)) {
      return;
    }

    if (
      !walletClient ||
      !marginSwapPosition ||
      !tokenA ||
      !tokenB ||
      !trade ||
      !publicClient ||
      !address
    ) {
      return;
    }
    try {
      const positionAssets = await publicClient.readContract({
        abi: MARGIN_MODULE_ABI,
        address: MARGIN_TRADING_ADDRESS[chainId],
        functionName: "getPositionAssets",
        args: [BigInt(marginSwapPosition.id)],
      });

      // Same order as the pool's token0/token1. A plain string compare of checksummed addresses
      // gets it wrong when letter case differs (WETH 0xb16F… vs USDC 0xFC86…).
      const zeroForOne =
        !tokenA.wrapped.equals(tokenB.wrapped) && tokenA.wrapped.sortsBefore(tokenB.wrapped);

      const sqrtPriceLimitX96 = zeroForOne
        ? TickMath.MIN_SQRT_RATIO + ONE
        : TickMath.MAX_SQRT_RATIO - ONE;

      const params = {
        abi: MARGIN_MODULE_ABI,
        functionName: "marginSwap" as const,
        address: MARGIN_TRADING_ADDRESS[chainId],
        args: [
          BigInt(marginSwapPosition.id), // positionId
          BigInt(
            positionAssets.findIndex(
              (_asset) => _asset.toLowerCase() === tokenA.wrapped.address0.toLowerCase(),
            ),
          ), // assetId_1
          BigInt(
            marginSwapPosition.order.allowedTradingAddresses.findIndex(
              (_asset) => _asset.toLowerCase() === tokenA.wrapped.address0.toLowerCase(),
            ),
          ), //whitelistId_1
          BigInt(
            marginSwapPosition.order.allowedTradingAddresses.findIndex(
              (_asset) => _asset.toLowerCase() === tokenB.wrapped.address0.toLowerCase(),
            ), //whitelistId_1
          ),
          parseUnits(typedValue, tokenA.decimals),
          tokenB?.wrapped.address0,
          trade.swaps[0].route.pools[0].fee,
          minimumAmountOut,
          sqrtPriceLimitX96,
        ] as const,
      };

      setStatus(MarginSwapStatus.PENDING_SWAP);
      const hash = await walletClient.writeContract({
        ...params,
      });

      setMarginSwapHash(hash);

      setStatus(MarginSwapStatus.LOADING_SWAP);

      const transaction = await getTransactionWithRetries({
        hash,
        publicClient,
      });

      const nonce = transaction.nonce;

      // addRecentTransaction(
      //   {
      //     hash,
      //     nonce,
      //     chainId,
      //     gas: {
      //       model: GasFeeModel.EIP1559,
      //       gas: "0",
      //       maxFeePerGas: undefined,
      //       maxPriorityFeePerGas: undefined,
      //     },
      //     params: {
      //       ...stringifyObject(params),
      //       abi: [getAbiItem({ name: "setOrderStatus", abi: MARGIN_MODULE_ABI })],
      //     },
      //     title: {
      //       symbol: order.baseAsset.symbol!,
      //       orderId,
      //       template: RecentTransactionTitleTemplate.MARGIN_SWAP,
      //       logoURI: order.baseAsset?.logoURI || "/images/tokens/placeholder.svg",
      //     },
      //   },
      //   address,
      // );

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        _usePoolsStore.getState().invalidateAll();
        refreshMarginQueries(chainId);
        setStatus(MarginSwapStatus.SUCCESS);
      }

      if (receipt.status === "reverted") {
        setStatus(MarginSwapStatus.ERROR_SWAP);
        // setErrorType(SwapError.UNKNOWN);
      }
    } catch (e) {
      setStatus(MarginSwapStatus.ERROR_SWAP);
    }
  }, [
    addRecentTransaction,
    address,
    chainId,
    marginSwapPosition,
    minimumAmountOut,
    publicClient,
    setMarginSwapHash,
    setStatus,
    tokenA,
    tokenB,
    trade,
    typedValue,
    walletClient,
  ]);

  return { handleMarginSwap };
}
