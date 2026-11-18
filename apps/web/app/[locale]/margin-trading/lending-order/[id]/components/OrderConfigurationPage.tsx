import clsx from "clsx";
import { useTranslations } from "next-intl";
import React, { useCallback } from "react";

import { useLendingOrderRecentTransactionsStore } from "@/app/[locale]/margin-trading/lending-order/create/hooks/useLendingOrderRecentTransactionsStore";
import FirstStep from "@/app/[locale]/margin-trading/lending-order/create/steps/FirstStep";
import SecondStep from "@/app/[locale]/margin-trading/lending-order/create/steps/SecondStep";
import ThirdStep from "@/app/[locale]/margin-trading/lending-order/create/steps/ThirdStep";
import {
  FirstStepValues,
  SecondStepValues,
  ThirdStepValues,
} from "@/app/[locale]/margin-trading/lending-order/create/stores/useCreateOrderConfigStore";
import {
  LendingOrder,
  OrderActionMode,
  OrderActionStep,
} from "@/app/[locale]/margin-trading/types";
import IconButton, { IconButtonSize } from "@/components/buttons/IconButton";
import { Link } from "@/i18n/routing";

type Props = {
  order?: LendingOrder;
  step: OrderActionStep;
  setStep: (step: OrderActionStep) => void;
  firstStepValues: FirstStepValues;
  setFirstStepValues: (firstStepValues: FirstStepValues) => void;
  secondStepValues: SecondStepValues;
  setSecondStepValues: (secondStepValues: SecondStepValues) => void;
  thirdStepValues: ThirdStepValues;
  setThirdStepValues: (thirdStepValues: ThirdStepValues) => void;
  openPreviewDialog: () => void;
  mode: OrderActionMode;
};

export default function OrderConfigurationPage({
  mode,
  order,

  step,
  setStep,

  firstStepValues,
  secondStepValues,
  thirdStepValues,

  setSecondStepValues,
  setFirstStepValues,
  setThirdStepValues,

  openPreviewDialog,
}: Props) {
  const t = useTranslations("Margin");
  const renderSteps = useCallback(() => {
    switch (step) {
      case OrderActionStep.FIRST:
        return (
          <FirstStep
            mode={mode}
            firstStepValues={firstStepValues}
            setStep={setStep}
            setFirstStepValues={setFirstStepValues}
          />
        );
      case OrderActionStep.SECOND:
        return (
          <SecondStep
            mode={mode}
            firstStepValues={firstStepValues}
            setStep={setStep}
            secondStepValues={secondStepValues}
            setSecondStepValues={setSecondStepValues}
          />
        );
      case OrderActionStep.THIRD:
        return (
          <ThirdStep
            order={order}
            mode={mode}
            setStep={setStep}
            thirdStepValues={thirdStepValues}
            setThirdStepValues={setThirdStepValues}
            openPreviewDialog={openPreviewDialog}
          />
        );
    }
  }, [
    firstStepValues,
    mode,
    order,
    openPreviewDialog,
    secondStepValues,
    setFirstStepValues,
    setSecondStepValues,
    setStep,
    setThirdStepValues,
    step,
    thirdStepValues,
  ]);

  const { isOpened: showRecentTransactions, setIsOpened: setShowRecentTransactions } =
    useLendingOrderRecentTransactionsStore();

  return (
    <>
      <div className="rounded-3 bg-primary-bg w-full max-w-[600px] mx-auto">
        <div className="py-1.5 px-6 flex justify-between items-center">
          <Link href="/margin-trading">
            <IconButton iconName="back" />
          </Link>
          <h1 className="text-20 font-bold">
            {mode === OrderActionMode.CREATE ? t("new_lending_order") : t("edit_lending_order")}
          </h1>
          <IconButton
            buttonSize={IconButtonSize.LARGE}
            active={showRecentTransactions}
            iconName="recent-transactions"
            onClick={() => setShowRecentTransactions(!showRecentTransactions)}
          />
        </div>
        <div className="pb-10 px-4 sm:px-10">
          <div className="flex justify-between mb-5 items-center gap-2 sm:gap-5">
            {[OrderActionStep.FIRST, OrderActionStep.SECOND, OrderActionStep.THIRD].map((_step) => {
              return (
                <React.Fragment key={_step}>
                  <div
                    className="flex min-w-0 flex-col sm:flex-row items-center gap-1 sm:gap-2"
                    key={_step}
                  >
                    <span
                      className={clsx(
                        "w-8 h-8 shrink-0 rounded-full text-18 flex items-center justify-center border",
                        _step === step
                          ? "border-green bg-green-bg"
                          : "border-quaternary-bg bg-quaternary-bg text-tertiary-text",
                      )}
                    >
                      {_step + 1}
                    </span>
                    <span
                      className={clsx(
                        "text-12 sm:text-18 text-center",
                        _step === step ? "text-primary-text" : "text-tertiary-text",
                      )}
                    >
                      {_step === OrderActionStep.FIRST
                        ? t("step_loan")
                        : _step === OrderActionStep.SECOND
                          ? t("step_parameters")
                          : t("step_liquidation")}
                    </span>
                  </div>
                  {_step !== OrderActionStep.THIRD && (
                    <div className="h-1 flex-grow bg-quaternary-bg" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          {renderSteps()}
        </div>
      </div>
    </>
  );
}
