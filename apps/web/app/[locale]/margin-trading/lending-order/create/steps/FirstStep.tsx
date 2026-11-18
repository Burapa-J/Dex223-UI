import { Formik } from "formik";
import { useTranslations } from "next-intl";
import React, { useMemo, useState } from "react";
import * as Yup from "yup";

import {
  calculatePeriodInterestRate,
  calculatePeriodInterestRateNum,
} from "@/app/[locale]/margin-trading/lending-order/[id]/helpers/calculatePeriodInterestRate";
import LendingOrderDetailsRow from "@/app/[locale]/margin-trading/lending-order/create/components/LendingOrderDetailsRow";
import LendingOrderPeriodConfig from "@/app/[locale]/margin-trading/lending-order/create/components/LendingOrderPeriodConfig";
import LendingOrderTokenSelect from "@/app/[locale]/margin-trading/lending-order/create/components/LendingOrderTokenSelect";
import { positionDurationSeconds } from "@/app/[locale]/margin-trading/lending-order/create/helpers/positionDurationSeconds";
import {
  LendingOrderPeriod,
  LendingOrderPeriodType,
  PerpetualPeriodType,
} from "@/app/[locale]/margin-trading/lending-order/create/steps/types";
import {
  FirstStepValues,
  SecondStepValues,
} from "@/app/[locale]/margin-trading/lending-order/create/stores/useCreateOrderConfigStore";
import { OrderActionMode, OrderActionStep } from "@/app/[locale]/margin-trading/types";
import { InputWithArrows } from "@/components/atoms/Input";
import TextField from "@/components/atoms/TextField";
import Button, { ButtonSize } from "@/components/buttons/Button";
import { formatFloat } from "@/functions/formatFloat";
import useTokenBalances from "@/hooks/useTokenBalances";
import { Currency } from "@/sdk_bi/entities/currency";
import { Standard } from "@/sdk_bi/standard";

const fixedPeriodSchema = Yup.object({
  type: Yup.mixed<LendingOrderPeriodType>().oneOf([LendingOrderPeriodType.FIXED]).required(),
  lendingOrderDeadline: Yup.date()
    .typeError("Invalid date")
    .required("Deadline required")
    .test(
      "is-future",
      "Deadline must be in the future",
      (value) => !!value && value.getTime() > Date.now(),
    ),
  positionDuration: Yup.number()
    .typeError("Must be a number")
    .required("Duration required")
    .moreThan(0, "Duration must be greater than zero")
    .max(182, "Maximum duration is 182 days"),
}).noUnknown();

const perpetualPeriodSchema = Yup.object({
  type: Yup.mixed<LendingOrderPeriodType>().oneOf([LendingOrderPeriodType.PERPETUAL]).required(),
  borrowingPeriod: Yup.object({
    type: Yup.mixed<PerpetualPeriodType>()
      .oneOf([PerpetualPeriodType.DAYS, PerpetualPeriodType.MINUTES])
      .required(),

    borrowingPeriodInDays: Yup.number().when("type", {
      is: PerpetualPeriodType.DAYS,
      then: (s) => s.typeError("Must be a number").required("Days required"),
      otherwise: (s) => s.notRequired().nullable(), // <-- remove when not in use
    }),

    borrowingPeriodInMinutes: Yup.number().when("type", {
      is: PerpetualPeriodType.MINUTES,
      then: (s) => s.typeError("Must be a number").required("Minutes required"),
      otherwise: (s) => s.notRequired().nullable(),
    }),
  }).required("Borrowing period required"),
}).noUnknown();

const periodSchema = Yup.lazy((value: any) => {
  if (value?.type === LendingOrderPeriodType.FIXED) {
    return fixedPeriodSchema;
  } else if (value?.type === LendingOrderPeriodType.PERPETUAL) {
    return perpetualPeriodSchema;
  }
  return Yup.mixed().notRequired(); // fallback
});

export function calculateFinalAmount({
  loanAmount,
  interestRatePerMonth,
  lendingOrderDeadline,
  positionDurationDays,
}: {
  loanAmount: number;
  interestRatePerMonth: number; // e.g. 10 for 10%
  lendingOrderDeadline: Date;
  positionDurationDays: number; // in days
}): number {
  const now = new Date();

  // Time between now and deadline in milliseconds
  const durationMs = lendingOrderDeadline.getTime() - now.getTime();

  if (durationMs <= 0 || positionDurationDays <= 0 || interestRatePerMonth <= 0) {
    return loanAmount; // no interest if invalid input
  }

  const msPerCycle = positionDurationDays * 24 * 60 * 60 * 1000;

  const fullCycles = Math.floor(durationMs / msPerCycle);

  const rate = interestRatePerMonth / 100;

  return loanAmount * Math.pow(1 + rate, fullCycles);
}

function getTokenOrAmountError({
  touchedAmount,
  touchedToken,
  amountError,
  tokenError,
  isEnoughBalance,
  insufficientBalance,
}: {
  touchedAmount?: boolean;
  touchedToken?: boolean;
  amountError?: string;
  tokenError?: string;
  isEnoughBalance: boolean;
  insufficientBalance: string;
}) {
  const errors = [];

  if (touchedToken && tokenError) {
    errors.push(tokenError);
  }

  if (touchedAmount && amountError) {
    errors.push(amountError);
  }

  if (!isEnoughBalance) {
    errors.push(insufficientBalance);
  }

  return errors;
}

export default function FirstStep({
  mode,
  setStep,
  firstStepValues,
  setFirstStepValues,
}: {
  mode: OrderActionMode;
  firstStepValues: FirstStepValues;
  setFirstStepValues: (firstStep: FirstStepValues) => void;
  setStep: (step: OrderActionStep) => void;
}) {
  const t = useTranslations("Margin");
  const {
    balance: { erc20Balance: token0Balance, erc223Balance: token1Balance },
    refetch: refetchBalance,
  } = useTokenBalances(firstStepValues.loanToken);

  const [isEnoughBalance, setIsEnoughBalance] = useState<boolean>(true);

  const [value, setValue] = useState<string>("");

  const schema = useMemo(() => {
    return Yup.object({
      loanToken: Yup.object().default(undefined).required("Please select a token"),

      loanAmount: Yup.number().when([], {
        is: () => mode === OrderActionMode.CREATE,
        then: (schema) =>
          schema
            .typeError("Loan amount must be a number")
            .required("Loan amount is required")
            .positive("Loan amount must be greater than zero"),
        otherwise: (schema) => schema.strip(), // completely removes the field
      }),

      interestRatePerMonth: Yup.number()
        .typeError("Interest rate must be a number")
        .required("Please provide interest rate per month")
        .min(0, "Interest rate cannot be negative")
        .max(9999, "Maximum interest rate is 9999%"),

      loanTokenStandard: Yup.string()
        .oneOf([Standard.ERC20, Standard.ERC223])
        .required("Token standard is required"),

      period: periodSchema, // your conditional schema from previous step
    });
  }, [mode]);

  return (
    <Formik
      enableReinitialize={mode === OrderActionMode.EDIT}
      initialValues={{
        interestRatePerMonth: firstStepValues.interestRatePerMonth,
        period: firstStepValues.period,
        loanToken: firstStepValues.loanToken,
        loanAmount: firstStepValues.loanAmount,
        loanTokenStandard: firstStepValues.loanTokenStandard,
      }}
      validationSchema={schema}
      onSubmit={async (values) => {
        setFirstStepValues(values);
        setStep(OrderActionStep.SECOND);
      }}
    >
      {(props) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            props.handleSubmit();
          }}
        >
          <LendingOrderTokenSelect
            token={props.values.loanToken}
            setToken={async (token: Currency) => {
              await props.setFieldValue("loanToken", token);
            }}
            allowedErc223={true}
            amount={props.values.loanAmount}
            setAmount={(loanAmount: string) => props.setFieldValue("loanAmount", loanAmount)}
            standard={props.values.loanTokenStandard}
            setStandard={async (standard: Standard) => {
              await props.setFieldValue("loanTokenStandard", standard);
            }}
            errors={
              mode === OrderActionMode.CREATE
                ? getTokenOrAmountError({
                    touchedAmount: props.touched.loanAmount,
                    touchedToken: props.touched.loanToken,
                    tokenError: props.errors.loanToken,
                    amountError: props.errors.loanAmount,
                    isEnoughBalance,
                    insufficientBalance: t("insufficient_balance"),
                  })
                : []
            }
            readonly={mode === OrderActionMode.EDIT}
            setIsEnoughBalance={setIsEnoughBalance}
          />
          {/*<pre>{JSON.stringify(props.values, null, 2)}</pre>*/}
          {/*<pre>{JSON.stringify(props.errors, null, 2)}</pre>*/}

          <LendingOrderPeriodConfig
            setValues={(values: LendingOrderPeriod) => props.setFieldValue("period", values)}
            values={props.values.period}
            errors={props.touched.period ? props.errors.period : undefined}
          />
          <TextField
            isNumeric
            label={t("interest_per_month")}
            placeholder={t("interest_per_month")}
            internalText="%"
            error={
              props.touched.interestRatePerMonth && props.errors.interestRatePerMonth
                ? props.errors.interestRatePerMonth
                : undefined
            }
            value={props.values.interestRatePerMonth}
            onChange={(e) => props.setFieldValue("interestRatePerMonth", e.target.value)}
          />

          {/*<InputWithArrows value={value} onChange={(e) => setValue(e.target.value)} />*/}
          {/**/}
          <div className="bg-tertiary-bg rounded-3 px-5 py-4 flex flex-col gap-2 mb-5 mt-4">
            <LendingOrderDetailsRow
              title={t("interest_entire_period")}
              value={
                props.values.interestRatePerMonth && props.values.period.positionDuration
                  ? calculatePeriodInterestRate(
                      +props.values.interestRatePerMonth * 100,
                      positionDurationSeconds(props.values.period.positionDuration),
                    )
                  : "—"
              }
            />
            <LendingOrderDetailsRow
              title={t("receive_entire_period")}
              value={
                props.values.interestRatePerMonth &&
                props.values.period.positionDuration &&
                props.values.loanAmount &&
                props.values.loanToken?.symbol
                  ? (() => {
                      const loanAmount = parseFloat(props.values.loanAmount);
                      const interestRate = calculatePeriodInterestRateNum(
                        +props.values.interestRatePerMonth * 100,
                        positionDurationSeconds(props.values.period.positionDuration),
                      );

                      if (isNaN(loanAmount) || isNaN(interestRate)) return "—";

                      const interest = (loanAmount * interestRate) / 100;

                      return formatFloat(interest) + ` ${props.values.loanToken.symbol}`;
                    })() // or 2 decimals if needed
                  : "—"
              }
            />
          </div>

          <Button
            disabled={
              (Object.keys(props.touched).length > 0 && Object.keys(props.errors).length > 0) ||
              !isEnoughBalance
            }
            type="submit"
            size={ButtonSize.EXTRA_LARGE}
            fullWidth
          >
            {t("next_step")}
          </Button>
        </form>
      )}
    </Formik>
  );
}
