import { useCallback, useEffect, useMemo, useState } from "react";
import { Address, getAbiItem, getContractAddress, parseEventLogs, parseUnits } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";

import {
  CreateTokenStatus,
  useCreateTokenStatusStore,
} from "@/app/[locale]/create-token/stores/useCreateTokenStatusStore";
import {
  useSwapGasLimitStore,
  useSwapGasPriceStore,
} from "@/app/[locale]/swap/stores/useSwapGasSettingsStore";
import { useImportToken } from "@/components/manage-tokens/ImportToken";
import { ERC223_TOKEN_DEPLOYER_ABI } from "@/config/abis/erc2223TokenDeployer";
import { TOKEN_CONVERTER_ABI } from "@/config/abis/tokenConverter";
import { getGasSettings } from "@/functions/gasSettings";
import { getTransactionWithRetries } from "@/functions/getTransactionWithRetries";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { CONVERTER_ADDRESS, ERC223_TOKEN_DEPLOYER_ADDRESS, ZERO_ADDRESS } from "@/sdk_bi/addresses";
import { Standard } from "@/sdk_bi/standard";
import { useGlobalFees } from "@/shared/hooks/useGlobalFees";
import {
  GasFeeModel,
  RecentTransactionTitleTemplate,
  stringifyObject,
  useRecentTransactionsStore,
} from "@/stores/useRecentTransactionsStore";

import {
  useCreateTokenGasLimitStore,
  useCreateTokenGasPriceStore,
} from "../stores/useCreateTokenGasSettingsStore";

const DEFAULT_CREATE_TOKEN_GAS = BigInt(900000);
const CREATE_TOKEN_GAS_BUFFER = BigInt(30000);

export function useCreateTokenEstimatedGas({
  name,
  symbol,
  totalSupply,
  imageURL,
  allowMintForOwner,
}: {
  name: string;
  symbol: string;
  totalSupply: string;
  imageURL: string;
  allowMintForOwner: boolean;
  createERC20: boolean;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { setEstimatedGas } = useCreateTokenGasLimitStore();
  const chainId = useCurrentChainId();

  useEffect(() => {
    let cancelled = false;

    async function estimateGas() {
      if (
        !address ||
        !publicClient ||
        !totalSupply.trim() ||
        ERC223_TOKEN_DEPLOYER_ADDRESS[chainId] === ZERO_ADDRESS
      ) {
        setEstimatedGas(DEFAULT_CREATE_TOKEN_GAS);
        return;
      }

      try {
        const estimated = await publicClient.estimateContractGas({
          account: address,
          abi: ERC223_TOKEN_DEPLOYER_ABI,
          address: ERC223_TOKEN_DEPLOYER_ADDRESS[chainId],
          functionName: "deployERC223Token",
          args: [
            name.trim(),
            symbol.trim(),
            parseUnits(totalSupply, 18),
            imageURL,
            18,
            allowMintForOwner,
          ],
        });

        if (!cancelled) {
          setEstimatedGas(
            estimated ? estimated + CREATE_TOKEN_GAS_BUFFER : DEFAULT_CREATE_TOKEN_GAS,
          );
        }
      } catch {
        if (!cancelled) {
          setEstimatedGas(DEFAULT_CREATE_TOKEN_GAS);
        }
      }
    }

    void estimateGas();
    return () => {
      cancelled = true;
    };
  }, [
    address,
    allowMintForOwner,
    chainId,
    imageURL,
    name,
    publicClient,
    setEstimatedGas,
    symbol,
    totalSupply,
  ]);
}

export default function useCreateToken(createTokenSettings: {
  name: string;
  symbol: string;
  totalSupply: string;
  imageURL: string;
  allowMintForOwner: boolean;
  createERC20: boolean;
}) {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const chainId = useCurrentChainId();
  const { address: accountAddress, chainId: walletChainId } = useAccount();
  const { status, setStatus, setCreateTokenHash, setCreateWrapperHash } =
    useCreateTokenStatusStore();
  const { addRecentTransaction } = useRecentTransactionsStore();
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);
  // ERC-20 version of the new token, when "create ERC-20" ran and its wrapper was deployed.
  const [erc20Address, setErc20Address] = useState<Address | null>(null);
  const [isReceiptUnavailable, setIsReceiptUnavailable] = useState(false);
  const { handleImport } = useImportToken();
  const { baseFee, priorityFee, gasPrice } = useGlobalFees();
  const { customGasLimit } = useCreateTokenGasLimitStore();
  const { gasPriceOption, gasPriceSettings } = useCreateTokenGasPriceStore();

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

  const handleCreateToken = useCallback(async () => {
    if (!walletClient || !publicClient || !accountAddress || walletChainId !== chainId) {
      return;
    }

    setIsReceiptUnavailable(false);
    setStatus(CreateTokenStatus.PENDING_CREATE_TOKEN);

    let hash: `0x${string}` | undefined;
    try {
      const deployTokenParams = {
        abi: ERC223_TOKEN_DEPLOYER_ABI,
        address: ERC223_TOKEN_DEPLOYER_ADDRESS[chainId],
        functionName: "deployERC223Token" as const,
        args: [
          createTokenSettings.name,
          createTokenSettings.symbol,
          parseUnits(createTokenSettings.totalSupply, 18),
          createTokenSettings.imageURL,
          18,
          createTokenSettings.allowMintForOwner,
        ],
      } as const;

      const estimatedGas = await publicClient.estimateContractGas({
        account: accountAddress,
        ...deployTokenParams,
      } as any);

      const gasToUse = customGasLimit ? customGasLimit : estimatedGas + CREATE_TOKEN_GAS_BUFFER;

      hash = await walletClient.writeContract({
        ...deployTokenParams,
        ...gasSettings,
        gas: gasToUse,
      });

      setCreateTokenHash(hash);
      setStatus(CreateTokenStatus.LOADING_CREATE_TOKEN);

      const factoryNonce = await publicClient.getTransactionCount({
        address: ERC223_TOKEN_DEPLOYER_ADDRESS[chainId],
        blockTag: "pending",
      });

      const futureAddress = getContractAddress({
        from: ERC223_TOKEN_DEPLOYER_ADDRESS[chainId],
        nonce: BigInt(factoryNonce),
      });

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
            ...stringifyObject({ ...gasSettings, model: gasPriceSettings.model }),
            gas: gasToUse.toString(),
          },
          params: {
            ...stringifyObject(deployTokenParams),
            abi: [
              getAbiItem({
                name: deployTokenParams.functionName,
                abi: ERC223_TOKEN_DEPLOYER_ABI,
              }),
            ],
          },
          title: {
            template: RecentTransactionTitleTemplate.DEPLOY_TOKEN,
            symbol: createTokenSettings.symbol!,
            amount: createTokenSettings.totalSupply,
            logoURI: createTokenSettings.imageURL || "/images/tokens/placeholder.svg",
            standard: Standard.ERC223,
            address: futureAddress,
            chainId: chainId,
          },
        },
        accountAddress,
      );

      if (hash) {
        let deployReceipt;
        try {
          deployReceipt = await publicClient.waitForTransactionReceipt({ hash });
        } catch (e) {
          // The tx was broadcast; a receipt-wait failure (RPC timeout, replacement) does not
          // mean it failed. Let the tracker settle it, but allow the dialog to reset on close.
          console.error(e);
          setIsReceiptUnavailable(true);
          return;
        }

        if (deployReceipt.status === "reverted") {
          setStatus(CreateTokenStatus.ERROR_CREATE_TOKEN);
          return;
        }

        const parsedEventLog = parseEventLogs({
          abi: ERC223_TOKEN_DEPLOYER_ABI,
          logs: deployReceipt.logs,
        });

        const deployTokenLog = parsedEventLog.find((log) => log.eventName === "Deployed");

        console.log(deployTokenLog);
        if (deployTokenLog) {
          setTokenAddress(deployTokenLog.args.token);
          setErc20Address(null);
          try {
            await handleImport(deployTokenLog.args.token, chainId, createTokenSettings.imageURL);
          } catch (e) {
            console.log(e);
            console.log("Failed to import token to user custom tokenlist");
          }

          if (!createTokenSettings.createERC20) {
            setStatus(CreateTokenStatus.SUCCESS);
          } else {
            let wrapperHash: `0x${string}` | undefined;
            try {
              setStatus(CreateTokenStatus.PENDING_CREATE_WRAPPER);

              const deployTokenParams = {
                abi: TOKEN_CONVERTER_ABI,
                address: CONVERTER_ADDRESS[chainId],
                functionName: "createERC20Wrapper" as const,
                args: [deployTokenLog.args.token],
              } as const;

              wrapperHash = await walletClient.writeContract({
                ...deployTokenParams,
                ...gasSettings,
              });

              setCreateWrapperHash(wrapperHash);

              setStatus(CreateTokenStatus.LOADING_CREATE_WRAPPER);
              const receipt = await publicClient.waitForTransactionReceipt({ hash: wrapperHash });

              if (receipt.status === "success") {
                try {
                  const wrapper = await publicClient.readContract({
                    abi: TOKEN_CONVERTER_ABI,
                    address: CONVERTER_ADDRESS[chainId],
                    functionName: "getERC20WrapperFor",
                    args: [deployTokenLog.args.token],
                  });
                  if (wrapper && wrapper !== ZERO_ADDRESS) setErc20Address(wrapper as Address);
                } catch (e) {
                  // Address display only; the token and its wrapper exist either way.
                  console.error(e);
                }
                setStatus(CreateTokenStatus.SUCCESS);
              }

              if (receipt.status === "reverted") {
                setStatus(CreateTokenStatus.ERROR_CREATE_WRAPPER);
              }
            } catch (error) {
              if (wrapperHash) {
                // Wrapper tx was broadcast; keep LOADING_CREATE_WRAPPER rather than reporting a failure.
                console.error(error);
                return;
              }
              setStatus(CreateTokenStatus.ERROR_CREATE_WRAPPER);
            }
          }
        } else {
          setStatus(CreateTokenStatus.ERROR_CREATE_TOKEN);
        }
      }
    } catch (e) {
      if (hash) {
        // Already broadcast: don't report failure for a tx that may still succeed.
        console.error(e);
        setIsReceiptUnavailable(true);
        return;
      }
      setStatus(CreateTokenStatus.ERROR_CREATE_TOKEN);
    }
  }, [
    accountAddress,
    addRecentTransaction,
    chainId,
    createTokenSettings.allowMintForOwner,
    createTokenSettings.createERC20,
    createTokenSettings.imageURL,
    createTokenSettings.name,
    createTokenSettings.symbol,
    createTokenSettings.totalSupply,
    customGasLimit,
    gasPriceSettings.model,
    gasSettings,
    handleImport,
    publicClient,
    setCreateTokenHash,
    setCreateWrapperHash,
    setStatus,
    walletChainId,
    walletClient,
  ]);

  return {
    handleCreateToken,
    tokenAddress,
    erc20Address,
    setTokenAddress,
    isReceiptUnavailable,
    setIsReceiptUnavailable,
  };
}
