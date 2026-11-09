import { Address, Hash } from "viem";

import { Currency } from "@/sdk_bi/entities/currency";
import { Standard } from "@/sdk_bi/standard";

export enum OrderActionMode {
  CREATE,
  EDIT,
}

export enum OrderActionStep {
  FIRST,
  SECOND,
  THIRD,
}

export type MarginPosition = {
  id: number;
  owner: Address;
  loanAmount: bigint;
  loanAsset: Currency;
  deadline: number;
  assetAddresses: {
    address: Address;
    balance: bigint;
    assetId: number;
  }[];
  assetsWithBalances: {
    asset: Currency;
    balance: bigint | undefined;
  }[];
  assets: Currency[];

  createdAt: number;

  isClosed: boolean;
  closedAt: number;
  isLiquidated: boolean;
  liquidatedAt: number;
  liquidator: Address;
  order: Omit<LendingOrder, "positions">;
  txClosed: Hash;
  txFrozen: Hash;
  txLiquidated: Hash;
  collateralAmount: bigint;
  collateralAsset: Currency;
  initialLeverage: number;
  frozenTime: number;
};

export type LendingOrder = {
  id: number;
  owner: Address;
  leverage: number;
  minLoan: bigint;
  positionDuration: number;
  deadline: number;
  createdAt: number;

  liquidationRewardAmount: {
    value: bigint;
    formatted: string;
  };
  liquidationRewardAsset: Currency;
  liquidationRewardAddress?: Address;
  liquidationRewardAssetStandard: Standard;

  collateralAddresses: Address[];
  allowedCollateralAssets: Currency[];

  allowedTradingAssets: Currency[];
  allowedTradingAddresses: Address[];
  whitelistAutoListing?: Address;
  isErc223TradingAllowed: boolean;

  interestRate: number;
  currencyLimit: number;

  balance: bigint;
  baseAsset: Currency;
  baseAssetAddress?: Address;
  baseAssetStandard: Standard;

  positions: Omit<MarginPosition, "order">[];

  alive: boolean;
  oracle: Address;
};
