import { useCallback, useMemo } from "react";
import { getAbiItem, parseEventLogs, parseUnits } from "viem";
import { useAccount, usePublicClient } from "wagmi";

import { useMarginWriteGas } from "@/app/[locale]/margin-trading/components/MarginGasSettings";
import { getBorrowFunding } from "@/app/[locale]/margin-trading/helpers/assetFunding";
import useMarginGasEstimate from "@/app/[locale]/margin-trading/hooks/useMarginGasEstimate";
import useMarginWalletClient from "@/app/[locale]/margin-trading/hooks/useMarginWalletClient";
import { useCreateMarginPositionConfigStore } from "@/app/[locale]/margin-trading/lending-order/[id]/borrow/stores/useCreateMarginPositionConfigStore";
import {
  CreateMarginPositionStatus,
  useCreateMarginPositionStatusStore,
} from "@/app/[locale]/margin-trading/lending-order/[id]/borrow/stores/useCreateMarginPositionStatusStore";
import { useNewlyCreatedPositionId } from "@/app/[locale]/margin-trading/lending-order/[id]/borrow/stores/useNewlyCreatedPositionId";
import {
  getApproveTextMap,
  getTransferTextMap,
} from "@/app/[locale]/margin-trading/lending-order/[id]/helpers/getStepTexts";
import { LendingOrder } from "@/app/[locale]/margin-trading/types";
import { OperationStepStatus } from "@/components/common/OperationStepRow";
import { ERC223_ABI } from "@/config/abis/erc223";
import { MARGIN_MODULE_ABI } from "@/config/abis/marginModule";
import { isMarginDeployed } from "@/config/modules";
import { IconName } from "@/config/types/IconName";
import { getTransactionWithRetries } from "@/functions/getTransactionWithRetries";
import { useStoreAllowance } from "@/hooks/useAllowance";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { MARGIN_TRADING_ADDRESS } from "@/sdk_bi/addresses";
import { Currency } from "@/sdk_bi/entities/currency";
import { Standard } from "@/sdk_bi/standard";
import {
  GasFeeModel,
  RecentTransactionTitleTemplate,
  stringifyObject,
  useRecentTransactionsStore,
} from "@/stores/useRecentTransactionsStore";

type OperationStepConfig = {
  iconName: IconName;
  textMap: Record<OperationStepStatus, string>;
  pending: CreateMarginPositionStatus;
  loading: CreateMarginPositionStatus;
  error: CreateMarginPositionStatus;
};

type ApproveStepConfig = OperationStepConfig & { amount: bigint; token: Currency };

function useBorrowFunding(order: LendingOrder) {
  const { values } = useCreateMarginPositionConfigStore();
  return useMemo(() => {
    try {
      return getBorrowFunding(order, values);
    } catch {
      return undefined;
    }
  }, [order, values]);
}

export function useCreatePositionApproveSteps(order: LendingOrder): {
  approveSteps: ApproveStepConfig[];
  allSteps: (OperationStepConfig | ApproveStepConfig)[];
} {
  const { values } = useCreateMarginPositionConfigStore();
  const funding = useBorrowFunding(order);
  const approveSteps: ApproveStepConfig[] = [];

  if (funding && values.collateralToken) {
    if (!funding.collateralIsNative) {
      const transfer = values.collateralTokenStandard === Standard.ERC223;
      approveSteps.push({
        iconName: transfer ? "transfer-to-contract" : "done",
        pending: transfer
          ? CreateMarginPositionStatus.PENDING_TRANSFER
          : CreateMarginPositionStatus.PENDING_APPROVE_BORROW,
        loading: transfer
          ? CreateMarginPositionStatus.LOADING_TRANSFER
          : CreateMarginPositionStatus.LOADING_APPROVE_BORROW,
        error: transfer
          ? CreateMarginPositionStatus.ERROR_TRANSFER
          : CreateMarginPositionStatus.ERROR_APPROVE_BORROW,
        textMap: (transfer ? getTransferTextMap : getApproveTextMap)(
          values.collateralToken.symbol!,
        ),
        amount: funding.collateralApprovalAmount,
        token: values.collateralToken,
      });
    }
    if (
      !funding.feeIsNative &&
      !funding.combinedApproval &&
      order.liquidationRewardAmount.value > 0n
    ) {
      approveSteps.push({
        iconName:
          order.liquidationRewardAssetStandard === Standard.ERC223
            ? "transfer-to-contract"
            : "done",
        pending: CreateMarginPositionStatus.PENDING_APPROVE_LIQUIDATION_FEE,
        loading: CreateMarginPositionStatus.LOADING_APPROVE_LIQUIDATION_FEE,
        error: CreateMarginPositionStatus.ERROR_APPROVE_LIQUIDATION_FEE,
        textMap: (order.liquidationRewardAssetStandard === Standard.ERC223
          ? getTransferTextMap
          : getApproveTextMap)(order.liquidationRewardAsset.symbol!),
        amount: order.liquidationRewardAmount.value,
        token: order.liquidationRewardAsset,
      });
    }
  }

  const borrowStep: OperationStepConfig = {
    iconName: "borrow",
    pending: CreateMarginPositionStatus.PENDING_BORROW,
    loading: CreateMarginPositionStatus.LOADING_BORROW,
    error: CreateMarginPositionStatus.ERROR_BORROW,
    textMap: {
      [OperationStepStatus.IDLE]: "Borrow",
      [OperationStepStatus.AWAITING_SIGNATURE]: "Borrow",
      [OperationStepStatus.LOADING]: "Borrowing",
      [OperationStepStatus.STEP_COMPLETED]: "Successfully borrowed",
      [OperationStepStatus.STEP_FAILED]: "Borrow failed",
      [OperationStepStatus.OPERATION_COMPLETED]: "Successfully borrowed",
    },
  };
  return { approveSteps, allSteps: [...approveSteps, borrowStep] };
}

export function useBorrowGasEstimate(
  order: LendingOrder | undefined,
  values: {
    collateralToken: Currency | undefined;
    collateralTokenStandard: Standard;
    collateralAmount: string;
    borrowAmount: string;
  },
) {
  const chainId = useCurrentChainId();
  useMarginGasEstimate("borrow", () => {
    if (!order) return;
    try {
      const funding = getBorrowFunding(order, values);
      return {
        abi: MARGIN_MODULE_ABI,
        address: MARGIN_TRADING_ADDRESS[chainId],
        functionName: "takeLoan" as const,
        args: [
          BigInt(order.id),
          funding.borrowAmount,
          BigInt(funding.collateralIndex),
          funding.collateralAmount,
        ] as const,
        value: funding.nativeValue,
      };
    } catch {
      return undefined;
    }
  });
}

export default function useCreateMarginPosition(order: LendingOrder) {
  const {
    setStatus,
    setBorrowHash,
    setApproveBorrowHash,
    setApproveLiquidationFeeHash,
    setTransferHash,
  } = useCreateMarginPositionStatusStore();
  const { values } = useCreateMarginPositionConfigStore();
  const funding = useBorrowFunding(order);
  const { addRecentTransaction } = useRecentTransactionsStore();
  const gasOverrides = useMarginWriteGas("borrow");
  const { data: walletClient } = useMarginWalletClient("borrow");
  const publicClient = usePublicClient();
  const chainId = useCurrentChainId();
  const { address } = useAccount();
  const { setPositionId } = useNewlyCreatedPositionId();

  const { isAllowed: collateralAllowed, writeTokenApprove: approveCollateral } = useStoreAllowance({
    token: funding?.collateralIsNative ? undefined : values.collateralToken,
    contractAddress: MARGIN_TRADING_ADDRESS[chainId],
    amountToCheck: funding?.collateralApprovalAmount ?? null,
  });
  useBorrowGasEstimate(order, values);

  const { isAllowed: feeAllowed, writeTokenApprove: approveFee } = useStoreAllowance({
    token:
      funding?.feeIsNative || funding?.combinedApproval ? undefined : order.liquidationRewardAsset,
    contractAddress: MARGIN_TRADING_ADDRESS[chainId],
    amountToCheck: order.liquidationRewardAmount.value,
  });

  const handleCreateMarginPosition = useCallback(
    async (orderId: string, amountToApprove: string, feeAmountToApprove: string) => {
      if (
        !isMarginDeployed(chainId) ||
        !walletClient ||
        !publicClient ||
        !address ||
        !funding ||
        !values.collateralToken
      )
        return;
      let failureStatus = CreateMarginPositionStatus.ERROR_BORROW;
      try {
        // Validate everything before an ERC-223 transfer can move funds into the module.
        if (BigInt(orderId) !== BigInt(order.id)) throw new Error("Order changed");
        const collateralApproval = parseUnits(amountToApprove, values.collateralToken.decimals);
        const feeApproval = parseUnits(feeAmountToApprove, order.liquidationRewardAsset.decimals);
        if (
          !funding.collateralIsNative &&
          values.collateralTokenStandard === Standard.ERC20 &&
          collateralApproval < funding.collateralApprovalAmount
        )
          throw new Error("Collateral approval is too small");
        if (
          !funding.feeIsNative &&
          !funding.combinedApproval &&
          order.liquidationRewardAssetStandard === Standard.ERC20 &&
          feeApproval < order.liquidationRewardAmount.value
        )
          throw new Error("Fee approval is too small");

        if (!funding.collateralIsNative) {
          if (values.collateralTokenStandard === Standard.ERC223) {
            failureStatus = CreateMarginPositionStatus.ERROR_TRANSFER;
            setStatus(CreateMarginPositionStatus.PENDING_TRANSFER);
            const hash = await walletClient.writeContract({
              abi: ERC223_ABI,
              address: funding.collateralAddress,
              functionName: "transfer",
              args: [MARGIN_TRADING_ADDRESS[chainId], funding.collateralAmount],
              ...gasOverrides,
              account: undefined,
            });
            setTransferHash(hash);
            setStatus(CreateMarginPositionStatus.LOADING_TRANSFER);
            if ((await publicClient.waitForTransactionReceipt({ hash })).status !== "success")
              throw new Error("Collateral transfer failed");
          } else if (!collateralAllowed) {
            failureStatus = CreateMarginPositionStatus.ERROR_APPROVE_BORROW;
            setStatus(CreateMarginPositionStatus.PENDING_APPROVE_BORROW);
            const result = await approveCollateral({
              customAmount: collateralApproval,
              customGasSettings: gasOverrides,
            });
            if (!result?.success) throw new Error("Collateral approval failed");
            setApproveBorrowHash(result.hash);
            setStatus(CreateMarginPositionStatus.LOADING_APPROVE_BORROW);
            if (
              (await publicClient.waitForTransactionReceipt({ hash: result.hash })).status !==
              "success"
            )
              throw new Error("Collateral approval failed");
          }
        }

        if (
          !funding.feeIsNative &&
          !funding.combinedApproval &&
          order.liquidationRewardAmount.value > 0n
        ) {
          const transfer = order.liquidationRewardAssetStandard === Standard.ERC223;
          if (transfer || !feeAllowed) {
            failureStatus = CreateMarginPositionStatus.ERROR_APPROVE_LIQUIDATION_FEE;
            setStatus(CreateMarginPositionStatus.PENDING_APPROVE_LIQUIDATION_FEE);
            let hash;
            if (transfer) {
              hash = await walletClient.writeContract({
                abi: ERC223_ABI,
                address: funding.feeAddress,
                functionName: "transfer",
                args: [MARGIN_TRADING_ADDRESS[chainId], order.liquidationRewardAmount.value],
                ...gasOverrides,
                account: undefined,
              });
            } else {
              const result = await approveFee({
                customAmount: feeApproval,
                customGasSettings: gasOverrides,
              });
              if (!result?.success) throw new Error("Fee approval failed");
              hash = result.hash;
            }
            setApproveLiquidationFeeHash(hash);
            setStatus(CreateMarginPositionStatus.LOADING_APPROVE_LIQUIDATION_FEE);
            if ((await publicClient.waitForTransactionReceipt({ hash })).status !== "success")
              throw new Error("Fee funding failed");
          }
        }

        failureStatus = CreateMarginPositionStatus.ERROR_BORROW;
        setStatus(CreateMarginPositionStatus.PENDING_BORROW);
        const params = {
          abi: MARGIN_MODULE_ABI,
          address: MARGIN_TRADING_ADDRESS[chainId],
          functionName: "takeLoan" as const,
          args: [
            BigInt(order.id),
            funding.borrowAmount,
            BigInt(funding.collateralIndex),
            funding.collateralAmount,
          ] as const,
          value: funding.nativeValue,
        };
        const hash = await walletClient.writeContract({
          ...params,
          ...gasOverrides,
          account: undefined,
        });
        setBorrowHash(hash);
        setStatus(CreateMarginPositionStatus.LOADING_BORROW);
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
              ...stringifyObject(params),
              abi: [getAbiItem({ name: "takeLoan", abi: MARGIN_MODULE_ABI })],
            },
            title: {
              symbolBorrowed: order.baseAsset.symbol!,
              symbolFee: order.liquidationRewardAsset.symbol!,
              symbolCollateral: values.collateralToken.symbol!,
              amountBorrowed: values.borrowAmount,
              amountFee: order.liquidationRewardAmount.formatted,
              amountCollateral: values.collateralAmount,
              template: RecentTransactionTitleTemplate.CREATE_MARGIN_POSITION,
              logoURI: order.baseAsset.logoURI || "/images/tokens/placeholder.svg",
            },
          },
          address,
        );
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("Borrow failed");
        const opened = parseEventLogs({ abi: MARGIN_MODULE_ABI, logs: receipt.logs }).find(
          (log) => log.eventName === "PositionOpened",
        );
        if (opened) setPositionId(Number(opened.args.positionId));
        setStatus(CreateMarginPositionStatus.SUCCESS);
      } catch (error) {
        console.error(error);
        setStatus(failureStatus);
      }
    },
    [
      address,
      addRecentTransaction,
      approveCollateral,
      approveFee,
      chainId,
      collateralAllowed,
      feeAllowed,
      funding,
      gasOverrides,
      order,
      publicClient,
      setApproveBorrowHash,
      setApproveLiquidationFeeHash,
      setBorrowHash,
      setPositionId,
      setStatus,
      setTransferHash,
      values,
      walletClient,
    ],
  );

  return { handleCreateMarginPosition };
}
