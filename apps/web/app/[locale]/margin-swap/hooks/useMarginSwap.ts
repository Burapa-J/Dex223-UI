import { useCallback, useEffect, useMemo } from "react";
import { Address, parseUnits } from "viem";
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
import { ONE } from "@/sdk_bi/internalConstants";
import { getTokenAddressForStandard, Standard } from "@/sdk_bi/standard";
import { TickMath } from "@/sdk_bi/utils/tickMath";
import { useGlobalBlockNumber } from "@/shared/hooks/useGlobalBlockNumber";
import { _usePoolsStore } from "@/stores/usePoolsStore";
import { useRecentTransactionsStore } from "@/stores/useRecentTransactionsStore";

export function buildMarginSwapCallParams({
  positionId,
  positionAssets,
  allowedTradingAddresses,
  tokenA,
  tokenB,
  tokenAStandard,
  tokenBStandard,
  amountIn,
  fee,
  minimumAmountOut,
  sqrtPriceLimitX96,
  marginModuleAddress,
}: {
  positionId: number | bigint;
  positionAssets: readonly Address[];
  allowedTradingAddresses: readonly Address[];
  tokenA: Currency;
  tokenB: Currency;
  tokenAStandard: Standard;
  tokenBStandard: Standard;
  amountIn: bigint;
  fee: number;
  minimumAmountOut: bigint;
  sqrtPriceLimitX96: bigint;
  marginModuleAddress: Address;
}) {
  const assetInAddress = getTokenAddressForStandard(tokenA, tokenAStandard);
  const assetOutAddress = getTokenAddressForStandard(tokenB, tokenBStandard);

  const assetId1 = positionAssets.findIndex(
    (_asset) => _asset.toLowerCase() === assetInAddress.toLowerCase(),
  );
  if (assetId1 < 0) {
    throw new Error("Input asset is not held in this position");
  }

  // On-chain _validateAsset checks:
  //   whitelist.tokens[idInWhitelist] == asset || order.baseAsset == asset || positionInitialCollateral[positionId] == asset
  // (or IDex223Autolisting.isListed(asset) when whitelist.isContract == true).
  // When `asset` is order.baseAsset, initial collateral, or listed via Autolisting, `findIndex`
  // returns -1; clamping to 0 keeps the uint256 argument valid and within whitelist.tokens bounds.
  const whitelistIdx1 = allowedTradingAddresses.findIndex(
    (_asset) => _asset.toLowerCase() === assetInAddress.toLowerCase(),
  );
  const whitelistIdx2 = allowedTradingAddresses.findIndex(
    (_asset) => _asset.toLowerCase() === assetOutAddress.toLowerCase(),
  );
  const whitelistId1 = BigInt(Math.max(0, whitelistIdx1));
  const whitelistId2 = BigInt(Math.max(0, whitelistIdx2));

  if (tokenAStandard === Standard.ERC223) {
    return {
      abi: MARGIN_MODULE_ABI,
      functionName: "marginSwap223" as const,
      address: marginModuleAddress,
      args: [
        BigInt(positionId),
        BigInt(assetId1),
        whitelistId1,
        whitelistId2,
        amountIn,
        assetOutAddress,
        fee,
      ] as const,
    };
  }

  return {
    abi: MARGIN_MODULE_ABI,
    functionName: "marginSwap" as const,
    address: marginModuleAddress,
    args: [
      BigInt(positionId),
      BigInt(assetId1),
      whitelistId1,
      whitelistId2,
      amountIn,
      assetOutAddress,
      fee,
      minimumAmountOut,
      sqrtPriceLimitX96,
    ] as const,
  };
}

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
  const { tokenA, tokenB, tokenAStandard, tokenBStandard } = useMarginSwapTokensStore();
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

      const params = buildMarginSwapCallParams({
        positionId: marginSwapPosition.id,
        positionAssets,
        allowedTradingAddresses: marginSwapPosition.order.allowedTradingAddresses,
        tokenA,
        tokenB,
        tokenAStandard,
        tokenBStandard,
        amountIn: parseUnits(typedValue, tokenA.decimals),
        fee: trade.swaps[0].route.pools[0].fee,
        minimumAmountOut,
        sqrtPriceLimitX96,
        marginModuleAddress: MARGIN_TRADING_ADDRESS[chainId],
      });

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

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        _usePoolsStore.getState().invalidateAll();
        refreshMarginQueries(chainId);
        setStatus(MarginSwapStatus.SUCCESS);
      }

      if (receipt.status === "reverted") {
        setStatus(MarginSwapStatus.ERROR_SWAP);
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
    tokenAStandard,
    tokenB,
    tokenBStandard,
    trade,
    typedValue,
    walletClient,
  ]);

  return { handleMarginSwap };
}
