import { useCallback, useMemo } from "react";
import { Address, formatUnits, getAbiItem } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";

import { useRefreshDepositsDataStore } from "@/app/[locale]/portfolio/components/stores/useRefreshTableStore";
import { ERC20_ABI } from "@/config/abis/erc20";
import { NONFUNGIBLE_POSITION_MANAGER_ABI } from "@/config/abis/nonfungiblePositionManager";
import { getTransactionWithRetries } from "@/functions/getTransactionWithRetries";
import { IIFE } from "@/functions/iife";
import { slippageToPercent } from "@/functions/slippageToPercent";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import useDeepEffect from "@/hooks/useDeepEffect";
import useTransactionDeadline from "@/hooks/useTransactionDeadline";
import { NONFUNGIBLE_POSITION_MANAGER_ADDRESS } from "@/sdk_bi/addresses";
import { DexChainId } from "@/sdk_bi/chains";
import { Percent } from "@/sdk_bi/entities/fractions/percent";
import { Position } from "@/sdk_bi/entities/position";
import { toHex } from "@/sdk_bi/utils/calldata";
import {
  RecentTransactionTitleTemplate,
  stringifyObject,
  useRecentTransactionsStore,
} from "@/stores/useRecentTransactionsStore";
import { useTransactionSettingsStore } from "@/stores/useTransactionSettingsStore";

import {
  useRemoveLiquidityGasLimitStore,
  useRemoveLiquidityGasSettings,
} from "../stores/useRemoveLiquidityGasSettings";
import {
  RemoveLiquidityStatus,
  useRemoveLiquidityStatusStore,
} from "../stores/useRemoveLiquidityStatusStore";
import { useRemoveLiquidityStore } from "../stores/useRemoveLiquidityStore";

const useRemoveLiquidityParams = () => {
  const { percentage, tokenId, position } = useRemoveLiquidityStore();
  const { slippage, deadline: _deadline } = useTransactionSettingsStore();
  const deadline = useTransactionDeadline(_deadline);
  const chainId = useCurrentChainId();
  const { address: accountAddress } = useAccount();

  return useMemo(() => {
    if (!position || !tokenId) return {};

    const percent = new Percent(percentage, 100);
    const partialPosition = new Position({
      pool: position.pool,
      liquidity: percent.multiply(position.liquidity).quotient,
      tickLower: position.tickLower,
      tickUpper: position.tickUpper,
    });

    // adjust for slippage
    const minimumAmounts = partialPosition.burnAmountsWithSlippage(slippageToPercent(slippage));
    const amount0Min = toHex(minimumAmounts.amount0);
    const amount1Min = toHex(minimumAmounts.amount1);

    const decreaseParams: {
      tokenId: any;
      liquidity: any;
      amount0Min: any;
      amount1Min: any;
      deadline: bigint;
    } = {
      tokenId: toHex(tokenId.toString()) as any,
      liquidity: toHex(partialPosition.liquidity) as any,
      amount0Min: amount0Min as any,
      amount1Min: amount1Min as any,
      deadline,
    };

    const removeLiquidityParams = {
      account: accountAddress as Address,
      abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
      functionName: "decreaseLiquidity" as const,
      address: NONFUNGIBLE_POSITION_MANAGER_ADDRESS[chainId as DexChainId],
      args: [decreaseParams] as [typeof decreaseParams],
    };

    return {
      removeLiquidityParams,
      minimumAmounts,
    };
  }, [accountAddress, chainId, deadline, percentage, tokenId, position, slippage]);
};

// Shown when estimation fails (no wallet, RPC error). decreaseLiquidity on this position
// manager can exceed 200k, so this matches the 250k collect-fees fallback in useCollectFees.
// Submission re-estimates gas, so this only drives the displayed fee and gas field.
const REMOVE_LIQUIDITY_DEFAULT_GAS_LIMIT = BigInt(250000);
export function useRemoveLiquidityEstimatedGas() {
  const { address } = useAccount();
  const { removeLiquidityParams } = useRemoveLiquidityParams();
  const publicClient = usePublicClient();
  const { setEstimatedGas } = useRemoveLiquidityGasLimitStore();

  useDeepEffect(() => {
    IIFE(async () => {
      if (!removeLiquidityParams || !address) {
        setEstimatedGas(REMOVE_LIQUIDITY_DEFAULT_GAS_LIMIT);
        console.log("Can't estimate gas");
        return;
      }

      try {
        const estimated = await publicClient?.estimateContractGas(removeLiquidityParams as any);
        if (estimated) {
          setEstimatedGas(estimated + BigInt(10000));
        } else {
          setEstimatedGas(REMOVE_LIQUIDITY_DEFAULT_GAS_LIMIT);
        }
      } catch (e) {
        console.log(e);
        setEstimatedGas(REMOVE_LIQUIDITY_DEFAULT_GAS_LIMIT);
      }
    });
  }, [publicClient, address, removeLiquidityParams]);
}

export default function useRemoveLiquidity() {
  const { tokenA, tokenB } = useRemoveLiquidityStore();
  const { setStatus, setHash } = useRemoveLiquidityStatusStore();
  const { setRefreshDepositsTrigger } = useRefreshDepositsDataStore();
  const { address: accountAddress } = useAccount();

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const { addRecentTransaction } = useRecentTransactionsStore();
  const chainId = useCurrentChainId();

  const { removeLiquidityParams, minimumAmounts } = useRemoveLiquidityParams();

  const { gasSettings, customGasLimit, gasModel } = useRemoveLiquidityGasSettings();

  const handleRemoveLiquidity = useCallback(async () => {
    setHash(undefined);
    if (
      !publicClient ||
      !walletClient ||
      !accountAddress ||
      !tokenA ||
      !tokenB ||
      !chainId ||
      !removeLiquidityParams
    ) {
      return;
    }
    setStatus(RemoveLiquidityStatus.PENDING);

    try {
      const params = removeLiquidityParams;

      const estimatedGas = await publicClient.estimateContractGas(params);
      const gasToUse = customGasLimit ? customGasLimit : estimatedGas + BigInt(30000); // set custom gas here if user changed it

      const { request } = await publicClient.simulateContract({
        ...params,
        ...gasSettings,
        gas: gasToUse,
      });

      const hash = await walletClient.writeContract({ ...request, account: undefined });
      setHash(hash);

      const transaction = await getTransactionWithRetries({
        hash,
        publicClient,
      });

      const nonce = transaction.nonce;

      addRecentTransaction(
        {
          hash,
          nonce,
          chainId,
          gas: {
            ...stringifyObject({ ...gasSettings, model: gasModel }),
            gas: gasToUse.toString(),
          },
          params: {
            ...stringifyObject(params),
            abi: [getAbiItem({ name: "approve", abi: ERC20_ABI })],
          },
          title: {
            symbol0: tokenA.symbol!,
            symbol1: tokenB.symbol!,
            template: RecentTransactionTitleTemplate.REMOVE,
            amount0: formatUnits(BigInt(minimumAmounts.amount0.toString()), tokenA.decimals),
            amount1: formatUnits(BigInt(minimumAmounts.amount1.toString()), tokenB.decimals),
            logoURI0: tokenA.logoURI || "",
            logoURI1: tokenB.logoURI || "",
          },
        },
        accountAddress,
      );
      if (hash) {
        setStatus(RemoveLiquidityStatus.LOADING);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        // A reverted transaction still produces a receipt, so the status has to be
        // inspected. Without this a failed removal was reported as successful and the
        // deposits refresh was triggered against unchanged state.
        if (receipt.status !== "success") {
          setStatus(RemoveLiquidityStatus.ERROR);
          return { success: false };
        }

        setStatus(RemoveLiquidityStatus.SUCCESS);
        setRefreshDepositsTrigger(true);
        return { success: true };
      }
    } catch (e) {
      console.log(e);
      setStatus(RemoveLiquidityStatus.ERROR);
    }
  }, [
    setHash,
    publicClient,
    walletClient,
    accountAddress,
    tokenA,
    tokenB,
    chainId,
    removeLiquidityParams,
    setStatus,
    customGasLimit,
    gasSettings,
    addRecentTransaction,
    gasModel,
    minimumAmounts,
    setRefreshDepositsTrigger,
  ]);

  return { handleRemoveLiquidity };
}
