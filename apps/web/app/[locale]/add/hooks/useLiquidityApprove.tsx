import { useTranslations } from "next-intl";
import { useCallback, useMemo, useRef } from "react";
import { Address } from "viem";
import { usePublicClient } from "wagmi";

import { useStoreAllowance } from "@/hooks/useAllowance";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { useStoreDeposit } from "@/hooks/useDeposit";
import { NONFUNGIBLE_POSITION_MANAGER_ADDRESS } from "@/sdk_bi/addresses";
import { DexChainId } from "@/sdk_bi/chains";
import { Currency } from "@/sdk_bi/entities/currency";
import { CurrencyAmount } from "@/sdk_bi/entities/fractions/currencyAmount";
import { Standard } from "@/sdk_bi/standard";
import { useConfirmInWalletAlertStore } from "@/stores/useConfirmInWalletAlertStore";

import { Field, useTokensStandards } from "../stores/useAddLiquidityAmountsStore";
import { useAddLiquidityGasSettings } from "../stores/useAddLiquidityGasSettings";
import {
  AddLiquidityApproveStatus,
  useAddLiquidityStatusStore,
} from "../stores/useAddLiquidityStatusStore";
import { useAddLiquidityTokensStore } from "../stores/useAddLiquidityTokensStore";

export type ApproveTransaction = {
  token: Currency;
  amount: bigint;
  isAllowed: boolean;
  status: AddLiquidityApproveStatus;
  estimatedGas: bigint | null;
  hash?: Address;
};

export enum ApproveTransactionType {
  "ERC20",
  "ERC223",
  "ERC20_AND_ERC223",
}

const isStepBlockingAnotherAttempt = (status: AddLiquidityApproveStatus) =>
  status === AddLiquidityApproveStatus.PENDING ||
  status === AddLiquidityApproveStatus.LOADING ||
  status === AddLiquidityApproveStatus.SUCCESS;

export const useLiquidityApprove = (parsedAmounts: {
  [field in Field]: CurrencyAmount<Currency> | undefined;
}) => {
  const { gasSettings } = useAddLiquidityGasSettings(); // not used:  , gasModel, customGasLimit
  const {
    approve0Status,
    approve1Status,
    deposite0Status,
    deposite1Status,
    approve0Hash,
    approve1Hash,
    deposite0Hash,
    deposite1Hash,
    setApprove0Status,
    setApprove1Status,
    setDeposite0Status,
    setDeposite1Status,
    setApprove0Hash,
    setApprove1Hash,
    setDeposite0Hash,
    setDeposite1Hash,
  } = useAddLiquidityStatusStore();

  const chainId = useCurrentChainId();
  const { tokenA, tokenB } = useAddLiquidityTokensStore();

  const { tokenAStandard, tokenBStandard } = useTokensStandards();

  const amountToCheckA = parsedAmounts[Field.CURRENCY_A]
    ? BigInt(parsedAmounts[Field.CURRENCY_A].quotient.toString())
    : BigInt(0);
  const amountToCheckB = parsedAmounts[Field.CURRENCY_B]
    ? BigInt(parsedAmounts[Field.CURRENCY_B].quotient.toString())
    : BigInt(0);

  const {
    isAllowed: isAllowedA,
    writeTokenApprove: approveA,
    currentAllowance: currentAllowanceA,
    estimatedGas: estimatedGasAllowanceA,
    updateAllowance: updateAllowanceA,
  } = useStoreAllowance({
    token: tokenA,
    contractAddress: NONFUNGIBLE_POSITION_MANAGER_ADDRESS[chainId as DexChainId],
    amountToCheck: amountToCheckA,
  });

  const {
    isAllowed: isAllowedB,
    writeTokenApprove: approveB,
    currentAllowance: currentAllowanceB,
    estimatedGas: estimatedGasAllowanceB,
    updateAllowance: updateAllowanceB,
  } = useStoreAllowance({
    token: tokenB,
    contractAddress: NONFUNGIBLE_POSITION_MANAGER_ADDRESS[chainId as DexChainId],
    amountToCheck: amountToCheckB,
  });

  const {
    isDeposited: isDepositedA,
    writeTokenDeposit: depositA,
    currentDeposit: currentDepositA,
    estimatedGas: estimatedGasDepositA,
    updateDeposite: updateDepositeA,
  } = useStoreDeposit({
    token: tokenA,
    amountToCheck: amountToCheckA,
  });
  const {
    isDeposited: isDepositedB,
    writeTokenDeposit: depositB,
    currentDeposit: currentDepositB,
    estimatedGas: estimatedGasDepositB,
    updateDeposite: updateDepositeB,
  } = useStoreDeposit({
    token: tokenB,
    amountToCheck: amountToCheckB,
  });

  const approveTransactions = useMemo(() => {
    let approveA = undefined as undefined | ApproveTransaction;
    let approveB = undefined as undefined | ApproveTransaction;
    let depositA = undefined as undefined | ApproveTransaction;
    let depositB = undefined as undefined | ApproveTransaction;
    if (tokenA && tokenA.isToken && tokenAStandard && amountToCheckA) {
      if (tokenAStandard === Standard.ERC20) {
        approveA = {
          token: tokenA,
          amount: amountToCheckA,
          isAllowed: isAllowedA,
          status: approve0Status,
          estimatedGas: estimatedGasAllowanceA,
          hash: approve0Hash,
        };
      } else if (tokenAStandard === Standard.ERC223) {
        depositA = {
          token: tokenA,
          amount: amountToCheckA,
          isAllowed: isDepositedA,
          status: deposite0Status,
          estimatedGas: estimatedGasDepositA,
          hash: deposite0Hash,
        };
      }
    }
    if (tokenB && tokenB.isToken && tokenBStandard && amountToCheckB) {
      if (tokenBStandard === Standard.ERC20) {
        approveB = {
          token: tokenB,
          amount: amountToCheckB,
          isAllowed: isAllowedB,
          status: approve1Status,
          estimatedGas: estimatedGasAllowanceB,
          hash: approve1Hash,
        };
      } else if (tokenBStandard === Standard.ERC223) {
        depositB = {
          token: tokenB,
          amount: amountToCheckB,
          isAllowed: isDepositedB,
          status: deposite1Status,
          estimatedGas: estimatedGasDepositB,
          hash: deposite1Hash,
        };
      }
    }

    return {
      approveA,
      approveB,
      depositA,
      depositB,
    };
  }, [
    tokenA,
    tokenB,
    tokenAStandard,
    tokenBStandard,
    amountToCheckA,
    amountToCheckB,
    estimatedGasAllowanceA,
    estimatedGasAllowanceB,
    isAllowedA,
    isAllowedB,
    estimatedGasDepositA,
    estimatedGasDepositB,
    isDepositedA,
    isDepositedB,
    approve0Status,
    approve1Status,
    approve0Hash,
    approve1Hash,
    deposite0Status,
    deposite1Status,
    deposite0Hash,
    deposite1Hash,
  ]);

  const t = useTranslations("Swap");
  const publicClient = usePublicClient();
  const { openConfirmInWalletAlert, closeConfirmInWalletAlert } = useConfirmInWalletAlertStore();
  const approveInFlightRef = useRef(false);

  const handleApprove1 = useCallback(
    async ({ customAmountB }: { customAmountB?: bigint }) => {
      const amountB = customAmountB || amountToCheckB;

      if (!publicClient) {
        return;
      }

      const { approve1Status: latestApprove1Status, deposite1Status: latestDeposite1Status } =
        useAddLiquidityStatusStore.getState();

      if (
        tokenB?.isToken &&
        tokenBStandard === Standard.ERC20 &&
        !isStepBlockingAnotherAttempt(latestApprove1Status) &&
        (currentAllowanceB || BigInt(0)) < amountB
      ) {
        openConfirmInWalletAlert(t("confirm_action_in_your_wallet_alert"));

        setApprove1Status(AddLiquidityApproveStatus.PENDING);
        // A throw (e.g. wallet rejection) is treated like a failed result below:
        // set this step to ERROR and close the confirm-in-wallet alert.
        const result = await approveB({
          customAmount: customAmountB,
          customGasSettings: gasSettings,
        }).catch((e) => {
          console.error(e);
          return undefined;
        });

        if (!result?.success) {
          setApprove1Status(AddLiquidityApproveStatus.ERROR);
          closeConfirmInWalletAlert();
          // return;
        } else {
          setApprove1Hash(result.hash);
          setApprove1Status(AddLiquidityApproveStatus.LOADING);
          closeConfirmInWalletAlert();

          let approveReceipt;
          try {
            approveReceipt = await publicClient.waitForTransactionReceipt({
              hash: result.hash,
            });
          } catch (e) {
            // Broadcast already; keep LOADING rather than reporting a failure that may not be real.
            console.error(e);
            return;
          }

          if (approveReceipt.status === "reverted") {
            setApprove1Status(AddLiquidityApproveStatus.ERROR);
            // return;
          } else {
            setApprove1Status(AddLiquidityApproveStatus.SUCCESS);
          }
        }
      } else if (
        tokenB?.isToken &&
        tokenBStandard === Standard.ERC223 &&
        !isStepBlockingAnotherAttempt(latestDeposite1Status) &&
        (currentDepositB || BigInt(0)) < amountB
      ) {
        openConfirmInWalletAlert(t("confirm_action_in_your_wallet_alert"));

        setDeposite1Status(AddLiquidityApproveStatus.PENDING);
        // A throw (e.g. wallet rejection) is treated like a failed result below:
        // set this step to ERROR and close the confirm-in-wallet alert.
        const result = await depositB({
          customAmount: customAmountB,
          customGasSettings: gasSettings,
        }).catch((e) => {
          console.error(e);
          return undefined;
        });
        if (!result?.success) {
          setDeposite1Status(AddLiquidityApproveStatus.ERROR);
          closeConfirmInWalletAlert();
        } else {
          setDeposite1Hash(result.hash);
          setDeposite1Status(AddLiquidityApproveStatus.LOADING);
          closeConfirmInWalletAlert();

          let depositeReceipt;
          try {
            depositeReceipt = await publicClient.waitForTransactionReceipt({
              hash: result.hash,
            });
          } catch (e) {
            // Broadcast already; keep LOADING rather than reporting a failure that may not be real.
            console.error(e);
            return;
          }

          if (depositeReceipt.status === "reverted") {
            setDeposite1Status(AddLiquidityApproveStatus.ERROR);
          } else {
            try {
              await updateDepositeB();
            } catch (e) {
              console.error(e);
            }
            setDeposite1Status(AddLiquidityApproveStatus.SUCCESS);
          }
        }
      }
    },
    [
      amountToCheckB,
      publicClient,
      tokenB?.isToken,
      tokenBStandard,
      currentAllowanceB,
      currentDepositB,
      openConfirmInWalletAlert,
      t,
      setApprove1Status,
      approveB,
      gasSettings,
      closeConfirmInWalletAlert,
      setApprove1Hash,
      setDeposite1Status,
      depositB,
      setDeposite1Hash,
      updateDepositeB,
    ],
  );

  const handleApprove0 = useCallback(
    async ({
      customAmountA,
      customAmountB,
    }: {
      customAmountA?: bigint;
      customAmountB?: bigint;
    }) => {
      const amountA = customAmountA || amountToCheckA;

      if (!publicClient) {
        return;
      }

      const { approve0Status: latestApprove0Status, deposite0Status: latestDeposite0Status } =
        useAddLiquidityStatusStore.getState();

      if (
        tokenA?.isToken &&
        tokenAStandard === Standard.ERC20 &&
        !isStepBlockingAnotherAttempt(latestApprove0Status) &&
        (currentAllowanceA || BigInt(0)) < amountA
      ) {
        openConfirmInWalletAlert(t("confirm_action_in_your_wallet_alert"));

        setApprove0Status(AddLiquidityApproveStatus.PENDING);
        // A throw (e.g. wallet rejection) is treated like a failed result below:
        // set this step to ERROR and close the confirm-in-wallet alert.
        const result = await approveA({
          customAmount: customAmountA,
          customGasSettings: gasSettings,
        }).catch((e) => {
          console.error(e);
          return undefined;
        });

        if (!result?.success) {
          setApprove0Status(AddLiquidityApproveStatus.ERROR);
          closeConfirmInWalletAlert();
        } else {
          setApprove0Hash(result.hash);
          setApprove0Status(AddLiquidityApproveStatus.LOADING);
          closeConfirmInWalletAlert();

          let approveReceipt;
          try {
            approveReceipt = await publicClient.waitForTransactionReceipt({
              hash: result.hash,
            });
          } catch (e) {
            // Broadcast already; keep LOADING rather than reporting a failure that may not be real.
            console.error(e);
            return;
          }

          if (approveReceipt.status === "reverted") {
            setApprove0Status(AddLiquidityApproveStatus.ERROR);
          } else {
            setApprove0Status(AddLiquidityApproveStatus.SUCCESS);
          }
        }
      } else if (
        tokenA?.isToken &&
        tokenAStandard === Standard.ERC223 &&
        !isStepBlockingAnotherAttempt(latestDeposite0Status) &&
        (currentDepositA || BigInt(0)) < amountA
      ) {
        openConfirmInWalletAlert(t("confirm_action_in_your_wallet_alert"));

        setDeposite0Status(AddLiquidityApproveStatus.PENDING);
        // A throw (e.g. wallet rejection) is treated like a failed result below:
        // set this step to ERROR and close the confirm-in-wallet alert.
        const result = await depositA({
          customAmount: customAmountA,
          customGasSettings: gasSettings,
        }).catch((e) => {
          console.error(e);
          return undefined;
        });
        if (!result?.success) {
          setDeposite0Status(AddLiquidityApproveStatus.ERROR);
          closeConfirmInWalletAlert();
        } else {
          setDeposite0Hash(result.hash);
          setDeposite0Status(AddLiquidityApproveStatus.LOADING);
          closeConfirmInWalletAlert();

          let depositeReceipt;
          try {
            depositeReceipt = await publicClient.waitForTransactionReceipt({
              hash: result.hash,
            });
          } catch (e) {
            // Broadcast already; keep LOADING rather than reporting a failure that may not be real.
            console.error(e);
            return;
          }

          if (depositeReceipt.status === "reverted") {
            setDeposite0Status(AddLiquidityApproveStatus.ERROR);
          } else {
            try {
              await updateDepositeA();
            } catch (e) {
              console.error(e);
            }
            setDeposite0Status(AddLiquidityApproveStatus.SUCCESS);
          }
        }
      }

      if (customAmountB || amountToCheckB) {
        await handleApprove1({ customAmountB });
      }
    },
    [
      amountToCheckA,
      publicClient,
      amountToCheckB,
      tokenA?.isToken,
      tokenAStandard,
      currentAllowanceA,
      currentDepositA,
      openConfirmInWalletAlert,
      t,
      setApprove0Status,
      approveA,
      gasSettings,
      closeConfirmInWalletAlert,
      setApprove0Hash,
      setDeposite0Status,
      depositA,
      setDeposite0Hash,
      updateDepositeA,
      handleApprove1,
    ],
  );

  const handleApprove = useCallback(
    async ({
      customAmountA,
      customAmountB,
    }: {
      customAmountA?: bigint;
      customAmountB?: bigint;
    }) => {
      if (approveInFlightRef.current) {
        return;
      }
      approveInFlightRef.current = true;
      try {
        await handleApprove0({ customAmountA, customAmountB });
      } finally {
        approveInFlightRef.current = false;
      }
    },
    [handleApprove0],
  );

  const updateAllowance = useCallback(async () => {
    await Promise.all([
      updateAllowanceA(),
      updateAllowanceB(),
      updateDepositeA(),
      updateDepositeB(),
    ]);
  }, [updateAllowanceA, updateAllowanceB, updateDepositeA, updateDepositeB]);

  const approveTransactionsType = useMemo(() => {
    const isERC20Transaction = approveTransactions.approveA || approveTransactions.approveB;
    const isERC223Transaction = approveTransactions.depositA || approveTransactions.depositB;
    if (isERC20Transaction && isERC223Transaction) {
      return ApproveTransactionType.ERC20_AND_ERC223;
    } else if (isERC20Transaction) {
      return ApproveTransactionType.ERC20;
    } else {
      return ApproveTransactionType.ERC223;
    }
  }, [approveTransactions]);

  const { approveTransactionsCount, approveTotalGasLimit } = useMemo(() => {
    const approveTransactionsArray = Object.values(approveTransactions).filter(
      (t) => !!t && !t.isAllowed,
    ) as ApproveTransaction[];

    const transactionsCount = approveTransactionsArray.length;
    const totalGasLimit = approveTransactionsArray.reduce((acc, { estimatedGas }) => {
      return estimatedGas ? acc + estimatedGas : acc;
    }, BigInt(0));

    return { approveTransactionsCount: transactionsCount, approveTotalGasLimit: totalGasLimit };
  }, [approveTransactions]);

  return {
    approveTransactions,
    approveTransactionsCount,
    handleApprove,
    approveTransactionsType,
    approveTotalGasLimit,
    updateAllowance,
    currentDepositA,
    currentDepositB,
  };
};
