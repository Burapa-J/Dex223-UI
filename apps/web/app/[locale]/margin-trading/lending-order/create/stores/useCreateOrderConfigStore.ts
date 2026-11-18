import { create } from "zustand";

import {
  LendingOrderPeriod,
  LendingOrderPeriodType,
  LendingOrderTradingTokens,
  LiquidationMode,
  LiquidationType,
  PerpetualPeriodType,
  TradingTokensInputMode,
} from "@/app/[locale]/margin-trading/lending-order/create/steps/types";
import { Currency } from "@/sdk_bi/entities/currency";
import { Standard } from "@/sdk_bi/standard";

export type FirstStepValues = {
  interestRatePerMonth: string;
  period: LendingOrderPeriod;
  loanToken: Currency | undefined;
  loanAmount: string;
  loanTokenStandard: Standard;
};

export type SecondStepValues = {
  leverage: number;
  collateralTokens: Currency[];
  minimumBorrowingAmount: string;
  tradingTokens: LendingOrderTradingTokens;
};

export type ThirdStepValues = {
  liquidationMode: LiquidationMode;
  orderCurrencyLimit: string;
  liquidationFeeToken: Currency | undefined;
  liquidationFeeForLiquidator: string;
  priceSource: any;
};

interface CreateOrderConfig {
  firstStepValues: FirstStepValues;
  secondStepValues: SecondStepValues;
  thirdStepValues: ThirdStepValues;

  setFirstStepValues: (firstStep: FirstStepValues) => void;
  setSecondStepValues: (secondStep: SecondStepValues) => void;
  setThirdStepValues: (thirdStep: ThirdStepValues) => void;
  /** Back to empty fields; the create page calls this when it unmounts. */
  reset: () => void;
}

// A function, so each reset gets fresh objects and arrays.
const initialValues = () => ({
  firstStepValues: {
    interestRatePerMonth: "",
    period: {
      type: LendingOrderPeriodType.FIXED, // or PERPETUAL
      lendingOrderDeadline: "", // string or Date
      positionDuration: "",
      borrowingPeriod: {
        type: PerpetualPeriodType.DAYS, // or SECONDS
        borrowingPeriodInDays: "",
        borrowingPeriodInMinutes: "",
      },
    },
    loanToken: undefined,
    loanAmount: "",
    loanTokenStandard: Standard.ERC20,
  },
  secondStepValues: {
    leverage: 5,
    minimumBorrowingAmount: "",
    collateralTokens: [],

    tradingTokens: {
      inputMode: TradingTokensInputMode.MANUAL,
      allowedTokens: [],
      includeERC223Trading: false,
      tradingTokensAutoListing: undefined,
    },
  },
  thirdStepValues: {
    liquidationMode: {
      type: LiquidationType.ANYONE,
      whitelistedLiquidators: [],
    },
    orderCurrencyLimit: "",
    liquidationFeeToken: undefined,
    liquidationFeeForLiquidator: "",
    priceSource: "",
  },
});

export const useCreateOrderConfigStore = create<CreateOrderConfig>((set, get) => ({
  ...initialValues(),

  setFirstStepValues: (firstStepValues: FirstStepValues) =>
    set({
      firstStepValues,
      secondStepValues: {
        ...get().secondStepValues,
        tradingTokens: {
          ...get().secondStepValues.tradingTokens,
          allowedTokens: [firstStepValues.loanToken!],
        },
      },
    }),
  setSecondStepValues: (secondStepValues: SecondStepValues) => set({ secondStepValues }),
  setThirdStepValues: (thirdStepValues: ThirdStepValues) => set({ thirdStepValues }),
  reset: () => set(initialValues()),
}));
