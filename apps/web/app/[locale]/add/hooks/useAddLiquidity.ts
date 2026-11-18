import { useCallback, useMemo } from "react";
import { Abi, Address, encodeFunctionData, formatUnits, getAbiItem } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";

import useERC20WrapperExists from "@/app/[locale]/add/hooks/useERC20WrapperExists";
import { useLiquidityAmountsStore } from "@/app/[locale]/add/stores/useAddLiquidityAmountsStore";
import { useAddLiquidityTokensStore } from "@/app/[locale]/add/stores/useAddLiquidityTokensStore";
import { CreateTokenStatus } from "@/app/[locale]/create-token/stores/useCreateTokenStatusStore";
import { NONFUNGIBLE_POSITION_MANAGER_ABI } from "@/config/abis/nonfungiblePositionManager";
import { TOKEN_CONVERTER_ABI } from "@/config/abis/tokenConverter";
import { getTransactionWithRetries } from "@/functions/getTransactionWithRetries";
import { IIFE } from "@/functions/iife";
import { slippageToPercent } from "@/functions/slippageToPercent";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import useDeepEffect from "@/hooks/useDeepEffect";
import useTransactionDeadline from "@/hooks/useTransactionDeadline";
import addToast from "@/other/toast";
import { CONVERTER_ADDRESS, NONFUNGIBLE_POSITION_MANAGER_ADDRESS } from "@/sdk_bi/addresses";
import { DexChainId } from "@/sdk_bi/chains";
import { FeeAmount } from "@/sdk_bi/constants";
import { Position } from "@/sdk_bi/entities/position";
import { toHex } from "@/sdk_bi/utils/calldata";
import { useGlobalBlockNumber } from "@/shared/hooks/useGlobalBlockNumber";
import {
  RecentTransactionTitleTemplate,
  stringifyObject,
  useRecentTransactionsStore,
} from "@/stores/useRecentTransactionsStore";
import { useTransactionSettingsStore } from "@/stores/useTransactionSettingsStore";

import {
  useAddLiquidityGasLimitStore,
  useAddLiquidityGasSettings,
} from "../stores/useAddLiquidityGasSettings";
import {
  AddLiquidityStatus,
  useAddLiquidityStatusStore,
} from "../stores/useAddLiquidityStatusStore";
import { useSortedTokens } from "./useSortedTokens";

enum ADD_LIQUIDITY_TYPE {
  CREATE_AND_MINT,
  MINT,
  INCREASE,
}

export function useAddLiquidityParams({
  position,
  increase,
  createPool,
  tokenId,
}: {
  position?: Position;
  increase?: boolean;
  createPool?: boolean;
  tokenId?: string;
}) {
  const { slippage, deadline: _deadline } = useTransactionSettingsStore();
  const deadline = useTransactionDeadline(_deadline);
  const { tokenA, tokenB } = useAddLiquidityTokensStore();
  const { token0, token1 } = useSortedTokens({
    tokenA,
    tokenB,
  });

  const chainId = useCurrentChainId();
  const { address: accountAddress } = useAccount();

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const addLiquidityType = useMemo(() => {
    if (createPool) return ADD_LIQUIDITY_TYPE.CREATE_AND_MINT;
    if (increase && tokenId) return ADD_LIQUIDITY_TYPE.INCREASE;
    return ADD_LIQUIDITY_TYPE.MINT;
  }, [createPool, increase, tokenId]);

  const addLiquidityParams = useMemo(() => {
    if (
      !position ||
      !publicClient ||
      !walletClient ||
      !accountAddress ||
      !token0 ||
      !token1 ||
      !chainId
    ) {
      return null;
    }

    // get amounts
    const { amount0: amount0Desired, amount1: amount1Desired } = position.mintAmounts;

    const minimumAmounts = position.mintAmountsWithSlippage(slippageToPercent(slippage));
    const amount0Min = toHex(minimumAmounts.amount0);
    const amount1Min = toHex(minimumAmounts.amount1);

    const value = token0.isNative
      ? BigInt(amount0Desired.toString())
      : token1.isNative
        ? BigInt(amount1Desired.toString())
        : undefined;

    if (addLiquidityType === ADD_LIQUIDITY_TYPE.CREATE_AND_MINT) {
      // CREATE + MINT
      const createParams = [
        position.pool.token0.wrapped.address0,
        position.pool.token1.wrapped.address0,
        position.pool.token0.wrapped.address1,
        position.pool.token1.wrapped.address1,
        position.pool.fee,
        toHex(position.pool.sqrtRatioX96) as any,
      ] as [Address, Address, Address, Address, FeeAmount, bigint];

      const mintParams = {
        token0: position.pool.token0.wrapped.address0,
        token1: position.pool.token1.wrapped.address0,
        fee: position.pool.fee,
        tickLower: position.tickLower,
        tickUpper: position.tickUpper,
        amount0Desired: toHex(amount0Desired) as any,
        amount1Desired: toHex(amount1Desired) as any,
        amount0Min: amount0Min as any,
        amount1Min: amount1Min as any,
        recipient: accountAddress,
        deadline,
      };

      const encodedCreateParams = encodeFunctionData({
        abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
        functionName: "createAndInitializePoolIfNecessary",
        args: createParams,
      });

      const encodedMintParams = encodeFunctionData({
        abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
        functionName: "mint",
        args: [mintParams],
      });

      const params: {
        address: Address;
        account: Address;
        abi: Abi;
        functionName: "multicall";
        args: [`0x${string}`[]];
        value?: bigint;
      } = {
        address: NONFUNGIBLE_POSITION_MANAGER_ADDRESS[chainId as DexChainId],
        account: accountAddress,
        abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
        functionName: "multicall" as const,
        args: [[encodedCreateParams, encodedMintParams]],
        value,
      };
      return params;
    } else if (addLiquidityType === ADD_LIQUIDITY_TYPE.INCREASE) {
      if (!tokenId) return null;
      // INCREASE LIQUIDITY
      const increaseParams = {
        tokenId: toHex(tokenId) as any,
        amount0Desired: toHex(amount0Desired) as any,
        amount1Desired: toHex(amount1Desired) as any,
        amount0Min: amount0Min as any,
        amount1Min: amount1Min as any,
        recipient: accountAddress,
        deadline,
      };

      const params: {
        address: Address;
        account: Address;
        abi: Abi;
        functionName: "increaseLiquidity";
        args: [
          {
            tokenId: any;
            amount0Desired: any;
            amount1Desired: any;
            amount0Min: any;
            amount1Min: any;
            recipient: `0x${string}`;
            deadline: bigint;
          },
        ];
        value?: bigint;
      } = {
        address: NONFUNGIBLE_POSITION_MANAGER_ADDRESS[chainId as DexChainId],
        account: accountAddress,
        abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
        functionName: "increaseLiquidity" as const,
        args: [increaseParams],
        value,
      };
      return params;
    } else if (addLiquidityType === ADD_LIQUIDITY_TYPE.MINT) {
      //  MINT
      const mintParams = {
        token0: position.pool.token0.wrapped.address0,
        token1: position.pool.token1.wrapped.address0,
        fee: position.pool.fee,
        tickLower: position.tickLower,
        tickUpper: position.tickUpper,
        amount0Desired: toHex(amount0Desired) as any,
        amount1Desired: toHex(amount1Desired) as any,
        amount0Min: amount0Min as any,
        amount1Min: amount1Min as any,
        recipient: accountAddress,
        deadline,
      };

      const params: {
        address: Address;
        account: Address;
        abi: Abi;
        functionName: "mint";
        args: [any];
        value?: bigint;
      } = {
        address: NONFUNGIBLE_POSITION_MANAGER_ADDRESS[chainId as DexChainId],
        account: accountAddress,
        abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
        functionName: "mint" as const,
        args: [mintParams],
        value,
      };
      return params;
    }
    return null;
  }, [
    accountAddress,
    deadline,
    publicClient,
    token0,
    token1,
    walletClient,
    chainId,
    addLiquidityType,
    position,
    tokenId,
    slippage,
  ]);

  return { addLiquidityParams, addLiquidityType };
}

export function useAddLiquidityEstimatedGas({
  position,
  increase,
  createPool,
  tokenId,
}: {
  position?: Position;
  increase?: boolean;
  createPool?: boolean;
  tokenId?: string;
}) {
  const { addLiquidityParams } = useAddLiquidityParams({
    position,
    increase,
    createPool,
    tokenId,
  });

  const { setEstimatedGas } = useAddLiquidityGasLimitStore();
  const publicClient = usePublicClient();
  const { blockNumber } = useGlobalBlockNumber();

  useDeepEffect(() => {
    IIFE(async () => {
      if (!addLiquidityParams) {
        return;
      }

      try {
        // const estimated = await publicClient?.estimateContractGas(addLiquidityParams);
        // if (estimated) {
        //   setEstimatedGas({
        //     estimatedGasId: EstimatedGasId.mint,
        //     estimatedGas: estimated,
        //   });
        // }
        if (createPool) {
          setEstimatedGas(BigInt(530000));
        } else {
          setEstimatedGas(BigInt(330000));
        }
      } catch (error) {
        console.error("useAddLiquidityEstimatedGas ~ error:", error);
        setEstimatedGas(BigInt(530000));
      }
    });
  }, [publicClient, addLiquidityParams, blockNumber]);
}

export const useAddLiquidity = ({
  position,
  increase,
  createPool,
  tokenId,
}: {
  position?: Position;
  increase?: boolean;
  createPool?: boolean;
  tokenId?: string;
}) => {
  const { setLiquidityHash, setStatus: setLiquidityStatus } = useAddLiquidityStatusStore();
  const { address: accountAddress } = useAccount();
  const chainId = useCurrentChainId();

  const { addRecentTransaction } = useRecentTransactionsStore();

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const { tokenA, tokenB } = useAddLiquidityTokensStore();

  const { tokenAStandardRatio, tokenBStandardRatio } = useLiquidityAmountsStore();

  const { isErc20Exist: tokenAWrapperExists } = useERC20WrapperExists({
    address: tokenA?.wrapped.address1,
    enabled: !!tokenA && !tokenA.isNative && tokenAStandardRatio === 100,
  });
  const { isErc20Exist: tokenBWrapperExists } = useERC20WrapperExists({
    address: tokenB?.wrapped.address1,
    enabled: !!tokenB && !tokenB.isNative && tokenBStandardRatio === 100,
  });

  const { addLiquidityParams } = useAddLiquidityParams({
    position,
    increase,
    createPool,
    tokenId,
  });

  const { gasSettings, gasModel, customGasLimit } = useAddLiquidityGasSettings();

  const handleAddLiquidity = useCallback(
    async ({ updateAllowance }: { updateAllowance: () => Promise<void> }) => {
      if (
        !position ||
        !publicClient ||
        !walletClient ||
        !accountAddress ||
        !chainId ||
        !addLiquidityParams
      ) {
        return;
      }

      if (tokenA && !tokenAWrapperExists) {
        setLiquidityStatus(AddLiquidityStatus.MINT_PENDING);
        const deployTokenParams = {
          abi: TOKEN_CONVERTER_ABI,
          address: CONVERTER_ADDRESS[chainId],
          functionName: "createERC20Wrapper" as const,
          args: [tokenA?.wrapped.address1],
        } as const;

        let wrapperHash: `0x${string}`;
        try {
          wrapperHash = await walletClient.writeContract(deployTokenParams);
        } catch (error) {
          // Rejected or failed before broadcast: reset like the mint step does.
          console.error("useAddLiquidity ~ createERC20Wrapper error:", error);
          addToast((error as any).toString(), "error");
          setLiquidityStatus(AddLiquidityStatus.MINT);
          return;
        }

        setLiquidityStatus(AddLiquidityStatus.MINT_LOADING);
        try {
          const wrapperReceipt = await publicClient.waitForTransactionReceipt({
            hash: wrapperHash,
          });
          if (wrapperReceipt.status === "reverted") {
            setLiquidityStatus(AddLiquidityStatus.MINT_ERROR);
            return;
          }
        } catch (e) {
          // Wrapper tx was broadcast; keep MINT_LOADING rather than reporting a failure.
          console.error(e);
          return;
        }
      }

      if (tokenB && !tokenBWrapperExists) {
        setLiquidityStatus(AddLiquidityStatus.MINT_PENDING);

        const deployTokenParams = {
          abi: TOKEN_CONVERTER_ABI,
          address: CONVERTER_ADDRESS[chainId],
          functionName: "createERC20Wrapper" as const,
          args: [tokenB?.wrapped.address1],
        } as const;

        let wrapperHash: `0x${string}`;
        try {
          wrapperHash = await walletClient.writeContract(deployTokenParams);
        } catch (error) {
          // Rejected or failed before broadcast: reset like the mint step does.
          console.error("useAddLiquidity ~ createERC20Wrapper error:", error);
          addToast((error as any).toString(), "error");
          setLiquidityStatus(AddLiquidityStatus.MINT);
          return;
        }

        setLiquidityStatus(AddLiquidityStatus.MINT_LOADING);
        try {
          const wrapperReceipt = await publicClient.waitForTransactionReceipt({
            hash: wrapperHash,
          });
          if (wrapperReceipt.status === "reverted") {
            setLiquidityStatus(AddLiquidityStatus.MINT_ERROR);
            return;
          }
        } catch (e) {
          // Wrapper tx was broadcast; keep MINT_LOADING rather than reporting a failure.
          console.error(e);
          return;
        }
      }

      setLiquidityStatus(AddLiquidityStatus.MINT_PENDING);
      let hash: `0x${string}` | undefined;
      try {
        const estimatedGas = await publicClient.estimateContractGas(addLiquidityParams);

        const gasToUse = customGasLimit ? customGasLimit : estimatedGas + BigInt(30000); // set custom gas here if user changed it

        const { request } = await publicClient.simulateContract({
          ...addLiquidityParams,
          ...gasSettings,
          gas: gasToUse,
        });
        hash = await walletClient.writeContract({
          ...request,
          account: undefined,
        });

        setLiquidityHash(hash);

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
              ...stringifyObject(addLiquidityParams),
              abi: [
                getAbiItem({
                  name: addLiquidityParams.functionName,
                  abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
                }),
              ],
            },
            title: {
              template: RecentTransactionTitleTemplate.ADD,
              symbol0: position.pool.token0.symbol!,
              symbol1: position.pool.token1.symbol!,
              amount0: formatUnits(position.mintAmounts.amount0, position.pool.token0.decimals),
              amount1: formatUnits(position.mintAmounts.amount1, position.pool.token1.decimals),
              logoURI0: position.pool.token0?.logoURI || "/images/tokens/placeholder.svg",
              logoURI1: position.pool.token1?.logoURI || "/images/tokens/placeholder.svg",
            },
          },
          accountAddress,
        );
        if (hash) {
          setLiquidityStatus(AddLiquidityStatus.MINT_LOADING);
          let receipt;
          try {
            receipt = await publicClient.waitForTransactionReceipt({ hash });
          } catch (e) {
            // The tx was broadcast; a receipt-wait failure (RPC timeout, replacement) does not
            // mean it failed. Keep MINT_LOADING and let the recent-transaction tracker settle it.
            console.error(e);
            return;
          }
          updateAllowance();
          if (receipt.status === "success") {
            setLiquidityStatus(AddLiquidityStatus.SUCCESS);
          }

          if (receipt.status === "reverted") {
            setLiquidityStatus(AddLiquidityStatus.MINT_ERROR);
          }
        }
      } catch (error) {
        console.error("useAddLiquidity ~ error:", error);
        if (hash) {
          // Already broadcast: don't report failure for a tx that may still succeed.
          setLiquidityStatus(AddLiquidityStatus.MINT_LOADING);
          return;
        }
        addToast((error as any).toString(), "error");
        setLiquidityStatus(AddLiquidityStatus.MINT);
      }
    },
    [
      position,
      publicClient,
      walletClient,
      accountAddress,
      chainId,
      addLiquidityParams,
      tokenA,
      tokenAWrapperExists,
      tokenB,
      tokenBWrapperExists,
      setLiquidityStatus,
      customGasLimit,
      gasSettings,
      setLiquidityHash,
      addRecentTransaction,
      gasModel,
    ],
  );

  return {
    handleAddLiquidity,
  };
};
