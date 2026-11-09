"use client";

import clsx from "clsx";
import { useTranslations } from "next-intl";
import React, { use, useEffect } from "react";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";

import { useOrder } from "@/app/[locale]/margin-trading/hooks/useOrder";
import OrderConfigurationPage from "@/app/[locale]/margin-trading/lending-order/[id]/components/OrderConfigurationPage";
import ReviewEditOrderDialog from "@/app/[locale]/margin-trading/lending-order/[id]/edit/components/ReviewEditOrderDialog";
import { useEditOrderConfigStore } from "@/app/[locale]/margin-trading/lending-order/[id]/edit/stores/useEditOrderConfigStore";
import { useEditOrderStepStore } from "@/app/[locale]/margin-trading/lending-order/[id]/edit/stores/useEditOrderStepStore";
import { useLendingOrderRecentTransactionsStore } from "@/app/[locale]/margin-trading/lending-order/create/hooks/useLendingOrderRecentTransactionsStore";
import {
  LendingOrderPeriodType,
  LiquidationType,
  PerpetualPeriodType,
  TradingTokensInputMode,
} from "@/app/[locale]/margin-trading/lending-order/create/steps/types";
import { useConfirmEditOrderDialogStore } from "@/app/[locale]/margin-trading/stores/dialogStates";
import { OrderActionMode, OrderActionStep } from "@/app/[locale]/margin-trading/types";
import { useSwapRecentTransactionsStore } from "@/app/[locale]/swap/stores/useSwapRecentTransactions";
import Container from "@/components/atoms/Container";
import RecentTransactions from "@/components/common/RecentTransactions";
import { ORACLE_ADDRESS } from "@/sdk_bi/addresses";
import { DexChainId } from "@/sdk_bi/chains";
import { Standard } from "@/sdk_bi/standard";

export default function EditLendingOrderPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const t = useTranslations("Margin");
  const { id: orderId } = use(params);
  const { order, loading } = useOrder({ id: +orderId });

  const { address } = useAccount();

  const { step, setStep } = useEditOrderStepStore();

  const { isOpen, setIsOpen } = useConfirmEditOrderDialogStore();

  const { setIsInitialized, isInitialized, initializedOrderId, setInitializedFor, ...config } =
    useEditOrderConfigStore();

  const { setFirstStepValues, setSecondStepValues, setThirdStepValues } = config;

  useEffect(() => {
    if (!order) {
      return;
    }
    if (isInitialized && initializedOrderId === order.id) {
      return;
    }

    const date = new Date(order.deadline * 1000);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const formattedDatetime = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    setFirstStepValues({
      interestRatePerMonth: (order.interestRate / 100).toString(),
      loanAmount: formatUnits(order.balance, order.baseAsset.decimals),
      loanToken: order.baseAsset,
      loanTokenStandard: Standard.ERC20,
      period: {
        type: LendingOrderPeriodType.FIXED,
        lendingOrderDeadline: formattedDatetime,
        positionDuration: (order.positionDuration / 60 / 60 / 24).toString(),
        borrowingPeriod: {
          type: PerpetualPeriodType.DAYS,
          borrowingPeriodInDays: "0",
          borrowingPeriodInMinutes: "0",
        },
      },
    });

    setSecondStepValues({
      minimumBorrowingAmount: formatUnits(order.minLoan, order.baseAsset.decimals),
      collateralTokens: order.allowedCollateralAssets,
      leverage: order.leverage,
      tradingTokens: {
        inputMode: TradingTokensInputMode.MANUAL,
        allowedTokens: order.allowedTradingAssets,
        includeERC223Trading: false,
        tradingTokensAutoListing: undefined,
      },
    });

    setThirdStepValues({
      liquidationFeeToken: order.liquidationRewardAsset,
      orderCurrencyLimit: order.currencyLimit.toString(),
      liquidationMode: { type: LiquidationType.ANYONE, whitelistedLiquidators: [] },
      liquidationFeeForLiquidator: order.liquidationRewardAmount.formatted,
      priceSource: ORACLE_ADDRESS[DexChainId.SEPOLIA],
    });

    setInitializedFor(order.id);
  }, [
    initializedOrderId,
    isInitialized,
    order,
    setFirstStepValues,
    setInitializedFor,
    setIsInitialized,
    setSecondStepValues,
    setThirdStepValues,
  ]);

  const { isOpened: showRecentTransactions, setIsOpened: setShowRecentTransactions } =
    useLendingOrderRecentTransactionsStore();

  useEffect(() => {
    return () => {
      setStep(OrderActionStep.FIRST);
    };
  }, [setStep]);

  if (!order || loading) {
    return t("loading");
  }

  if (!address || order.owner.toLowerCase() !== address.toLowerCase()) {
    return t("not_order_owner");
  }

  return (
    <Container>
      <div
        className={clsx(
          "grid py-4 lg:py-[40px] grid-cols-1 mx-auto",
          showRecentTransactions
            ? "xl:grid-cols-[580px_600px] xl:max-w-[1200px] gap-4 xl:grid-areas-[left_right] grid-areas-[right,left]"
            : "xl:grid-cols-[600px] xl:max-w-[600px] grid-areas-[right]",
        )}
      >
        <div className="grid-in-[left] flex justify-center">
          <div className="w-full sm:max-w-[600px] xl:max-w-full">
            <RecentTransactions
              showRecentTransactions={showRecentTransactions}
              handleClose={() => setShowRecentTransactions(false)}
              store={useSwapRecentTransactionsStore}
            />
          </div>
        </div>

        <div className="flex justify-center grid-in-[right]">
          <div className="flex flex-col gap-4 md:gap-6 lg:gap-5 w-full sm:max-w-[600px] xl:max-w-full">
            <OrderConfigurationPage
              order={order}
              {...config}
              openPreviewDialog={() => setIsOpen(true)}
              mode={OrderActionMode.EDIT}
              step={step}
              setStep={setStep}
            />
          </div>
        </div>
      </div>

      <ReviewEditOrderDialog isOpen={isOpen} setIsOpen={setIsOpen} order={order} />
    </Container>
  );
}
