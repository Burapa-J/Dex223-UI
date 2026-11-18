"use client";

import clsx from "clsx";
import React, { useEffect } from "react";

import OrderConfigurationPage from "@/app/[locale]/margin-trading/lending-order/[id]/components/OrderConfigurationPage";
import ReviewLendingOrderDialog from "@/app/[locale]/margin-trading/lending-order/create/components/ReviewCreateOrderDialog";
import { useLendingOrderRecentTransactionsStore } from "@/app/[locale]/margin-trading/lending-order/create/hooks/useLendingOrderRecentTransactionsStore";
import { useCreateOrderConfigStore } from "@/app/[locale]/margin-trading/lending-order/create/stores/useCreateOrderConfigStore";
import { useCreateOrderStepStore } from "@/app/[locale]/margin-trading/lending-order/create/stores/useCreateOrderStepStore";
import { useConfirmCreateOrderDialogStore } from "@/app/[locale]/margin-trading/stores/dialogStates";
import { OrderActionMode } from "@/app/[locale]/margin-trading/types";
import { useSwapRecentTransactionsStore } from "@/app/[locale]/swap/stores/useSwapRecentTransactions";
import Container from "@/components/atoms/Container";
import RecentTransactions from "@/components/common/RecentTransactions";

export default function CreateLendingOrderPage() {
  const { step, setStep } = useCreateOrderStepStore();

  const config = useCreateOrderConfigStore();

  const { isOpen, setIsOpen } = useConfirmCreateOrderDialogStore();

  // The wizard's step and values live in global stores, so without a reset "New lending order"
  // reopened the last order on step 3 until a full page reload (Dario, 13396807020). Reset when the
  // page unmounts: leaving after creating an order, or abandoning a draft, starts the next one fresh.
  useEffect(() => {
    return () => {
      useCreateOrderConfigStore.getState().reset();
      useCreateOrderStepStore.getState().reset();
    };
  }, []);

  const { isOpened: showRecentTransactions, setIsOpened: setShowRecentTransactions } =
    useLendingOrderRecentTransactionsStore();

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
              {...config}
              openPreviewDialog={() => setIsOpen(true)}
              setStep={setStep}
              mode={OrderActionMode.CREATE}
              step={step}
            />
          </div>
        </div>
      </div>

      <ReviewLendingOrderDialog isOpen={isOpen} setIsOpen={setIsOpen} />
    </Container>
  );
}
