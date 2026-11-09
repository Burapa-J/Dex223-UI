import { Address } from "viem";
import { create } from "zustand";
import { createJSONStorage, persist, StateStorage } from "zustand/middleware";

import { db } from "@/db/db";
import { DexChainId } from "@/sdk_bi/chains";
import { Standard } from "@/sdk_bi/standard";
export enum RecentTransactionStatus {
  PENDING,
  SUCCESS,
  ERROR,
}
export enum GasFeeModel {
  EIP1559,
  LEGACY,
}
export enum RecentTransactionTitleTemplate {
  APPROVE,
  DEPOSIT,
  SWAP,
  ADD,
  REMOVE,
  COLLECT,
  WITHDRAW,
  LIST_SINGLE,
  LIST_DOUBLE,
  CONVERT,
  UNWRAP,
  CREATE_LENDING_ORDER,
  EDIT_LENDING_ORDER,
  OPEN_LENDING_ORDER,
  CLOSE_LENDING_ORDER,
  CREATE_MARGIN_POSITION,
  CLOSE_MARGIN_POSITION,
  TRANSFER,
  FREEZE_MARGIN_POSITION,
  LIQUIDATE_MARGIN_POSITION,
  MARGIN_SWAP,
  WITHDRAW_FROM_CLOSED_POSITION,
  DEPLOY_TOKEN,
  MSIG_ADD_OWNER,
  MSIG_REMOVE_OWNER,
  MSIG_SET_DELAY,
  MSIG_SET_THRESHOLD,
  MSIG_APPROVE,
  MSIG_TRANSACTION_CONFIRMED,
  MSIG_DECLINE,
  CLAIM,
  UNFREEZE_MARGIN_POSITION,
}

type RecentTransactionGasLimit =
  | {
      model: GasFeeModel.EIP1559;
      maxFeePerGas: string | undefined;
      maxPriorityFeePerGas: string | undefined;
    }
  | {
      model: GasFeeModel.LEGACY;
      gasPrice: string;
    };

type MarginPositionTitle = {
  symbol: string;
  positionId: number;
  logoURI: string;
};

type TakeLoanTitle = {
  logoURI: string;
  symbolBorrowed: string;
  amountBorrowed: string;
  symbolCollateral: string;
  amountCollateral: string;
  symbolFee: string;
  amountFee: string;
};

type MarginOrderTitle = {
  symbol: string;
  orderId: number;
  logoURI: string;
};

type SingleTokenTransactionTitle = {
  symbol: string;
  amount: string;
  logoURI: string;
};

type TwoTokensTransactionTitle = {
  symbol0: string;
  symbol1: string;
  amount0: string;
  amount1: string;
  logoURI0: string;
  logoURI1: string;
};

type MultisigTransactionConfirmedTitle = {
  hash: string;
  chainId: number;
};

type IncreaseLiquidityParams = any;

type SwapParams = any;

type RemoveLiquidityParams = any;

type ApproveTokenParams = any;

export type IRecentTransactionTitle =
  | ({
      template: RecentTransactionTitleTemplate.APPROVE;
    } & SingleTokenTransactionTitle)
  | ({
      template: RecentTransactionTitleTemplate.DEPOSIT;
    } & SingleTokenTransactionTitle)
  | ({
      template: RecentTransactionTitleTemplate.WITHDRAW;
    } & SingleTokenTransactionTitle & { standard: Standard })
  | ({
      template: RecentTransactionTitleTemplate.TRANSFER;
    } & SingleTokenTransactionTitle)
  | ({
      template: RecentTransactionTitleTemplate.UNWRAP;
    } & SingleTokenTransactionTitle)
  | ({
      template: RecentTransactionTitleTemplate.CONVERT;
    } & SingleTokenTransactionTitle & { standard: Standard })
  | ({
      template: RecentTransactionTitleTemplate.DEPLOY_TOKEN;
    } & SingleTokenTransactionTitle & { standard: Standard; address: Address; chainId: DexChainId })
  | ({
      template: RecentTransactionTitleTemplate.SWAP;
    } & TwoTokensTransactionTitle)
  | ({
      template: RecentTransactionTitleTemplate.COLLECT;
    } & TwoTokensTransactionTitle)
  | ({
      template: RecentTransactionTitleTemplate.REMOVE;
    } & TwoTokensTransactionTitle)
  | ({
      template: RecentTransactionTitleTemplate.LIST_SINGLE;
    } & Omit<SingleTokenTransactionTitle, "amount"> & { autoListing: string })
  | ({
      template: RecentTransactionTitleTemplate.LIST_DOUBLE;
    } & Omit<TwoTokensTransactionTitle, "amount0" | "amount1"> & { autoListing: string })
  | ({
      template: RecentTransactionTitleTemplate.ADD;
    } & TwoTokensTransactionTitle)
  | ({
      template: RecentTransactionTitleTemplate.CREATE_LENDING_ORDER;
    } & Omit<SingleTokenTransactionTitle, "amount">)
  | ({
      template: RecentTransactionTitleTemplate.OPEN_LENDING_ORDER;
    } & MarginOrderTitle)
  | ({
      template: RecentTransactionTitleTemplate.CLOSE_LENDING_ORDER;
    } & MarginOrderTitle)
  | ({
      template: RecentTransactionTitleTemplate.EDIT_LENDING_ORDER;
    } & MarginOrderTitle)
  | ({
      template: RecentTransactionTitleTemplate.CREATE_MARGIN_POSITION;
    } & TakeLoanTitle)
  | ({
      template: RecentTransactionTitleTemplate.CLOSE_MARGIN_POSITION;
    } & MarginPositionTitle)
  | ({
      template: RecentTransactionTitleTemplate.LIQUIDATE_MARGIN_POSITION;
    } & MarginPositionTitle)
  | ({
      template: RecentTransactionTitleTemplate.FREEZE_MARGIN_POSITION;
    } & MarginPositionTitle)
  | ({
      template: RecentTransactionTitleTemplate.UNFREEZE_MARGIN_POSITION;
    } & MarginPositionTitle)
  | ({
      template: RecentTransactionTitleTemplate.WITHDRAW_FROM_CLOSED_POSITION;
    } & MarginPositionTitle)
  | ({
      template: RecentTransactionTitleTemplate.MARGIN_SWAP;
    } & TwoTokensTransactionTitle)
  | ({
      template: RecentTransactionTitleTemplate.MSIG_TRANSACTION_CONFIRMED;
    } & MultisigTransactionConfirmedTitle)
  | ({
      template: RecentTransactionTitleTemplate.MSIG_ADD_OWNER;
    } & MultisigTransactionConfirmedTitle)
  | ({
      template: RecentTransactionTitleTemplate.MSIG_REMOVE_OWNER;
    } & MultisigTransactionConfirmedTitle)
  | ({
      template: RecentTransactionTitleTemplate.MSIG_SET_DELAY;
    } & MultisigTransactionConfirmedTitle)
  | ({
      template: RecentTransactionTitleTemplate.MSIG_SET_THRESHOLD;
    } & MultisigTransactionConfirmedTitle)
  | ({
      template: RecentTransactionTitleTemplate.MSIG_APPROVE;
    } & MultisigTransactionConfirmedTitle)
  | ({
      template: RecentTransactionTitleTemplate.MSIG_DECLINE;
    } & MultisigTransactionConfirmedTitle)
  | ({
      template: RecentTransactionTitleTemplate.CLAIM;
    } & SingleTokenTransactionTitle);
export type IRecentTransaction = {
  id: Address;
  status: RecentTransactionStatus;
  hash: Address;
  // Broadcasts can be tracked by hash before RPC transaction metadata is available.
  nonce?: number;
  chainId: number;
  gas: { gas: string } & RecentTransactionGasLimit;
  params: IncreaseLiquidityParams | SwapParams | RemoveLiquidityParams | ApproveTokenParams;
  title: IRecentTransactionTitle;
  replacement?: "repriced" | "cancelled";
};

interface RecentTransactions {
  transactions: {
    [key: string]: IRecentTransaction[];
  };
  addRecentTransaction: (
    transaction: Omit<IRecentTransaction, "status" | "id">,
    accountAddress: Address,
    status?: RecentTransactionStatus,
  ) => void;
  updateTransactionStatus: (id: string, status: RecentTransactionStatus, account: string) => void;
  updateTransactionHash: (
    id: string,
    newHash: `0x${string}`,
    account: string,
    replacement: "repriced" | "cancelled",
  ) => void;
  updateTransactionGasSettings: (
    id: string,
    newGasSettings: RecentTransactionGasLimit,
    account: string,
  ) => void;
  clearTransactions: () => void;
}

export function stringifyObject(object: { [key: string]: any }) {
  return JSON.parse(
    JSON.stringify(
      object,
      (key, value) => (typeof value === "bigint" ? value.toString() : value), // return everything else unchanged
    ),
  );
}

const storage: StateStorage = {
  getItem: async (key) => {
    const item = await db.recentTransactions.get({ key });
    return item ? JSON.stringify(item.value) : null;
  },
  setItem: async (key, value) => {
    await db.recentTransactions.put({ key, value: JSON.parse(value) });
  },
  removeItem: async (key) => {
    await db.recentTransactions.delete(key);
  },
};

export const useRecentTransactionsStore = create<RecentTransactions>()(
  persist(
    (set) => ({
      transactions: {},
      addRecentTransaction: (
        transaction,
        accountAddress,
        status = RecentTransactionStatus.PENDING,
      ) =>
        set((state) => {
          const updatedTransactions = { ...state.transactions };
          const accountTransactions = updatedTransactions[accountAddress] || [];

          const newTransaction = {
            ...transaction,
            status,
            id: transaction.hash,
          };

          updatedTransactions[accountAddress] = [newTransaction, ...accountTransactions];
          return { transactions: updatedTransactions, isViewed: false };
        }),
      updateTransactionStatus: (id, status, account) =>
        set((state) => {
          console.log("updateTransactionStatus", id, status, account);
          const updatedTransactions = { ...state.transactions };
          const accountTransactions = updatedTransactions[account];
          const transactionIndex = accountTransactions.findIndex((t) => t.id === id);

          if (transactionIndex === -1) return {};

          accountTransactions[transactionIndex].status = status;

          return { transactions: updatedTransactions };
        }),
      updateTransactionHash: (id, newHash, account, replacement) =>
        set((state) => {
          const updatedTransactions = { ...state.transactions };
          const accountTransactions = updatedTransactions[account];
          const transaction = accountTransactions.find((t) => t.id === id);

          if (!transaction) return {};

          transaction.hash = newHash;
          transaction.replacement = replacement;

          return { transactions: updatedTransactions };
        }),

      updateTransactionGasSettings: (id, newGasSettings, account) =>
        set((state) => {
          const updatedTransactions = { ...state.transactions };
          const accountTransactions = updatedTransactions[account];
          const transaction = accountTransactions.find((t) => t.id === id);

          if (!transaction) return {};

          if (transaction.gas.model === GasFeeModel.EIP1559) {
            transaction.gas = {
              ...newGasSettings,
              gas: transaction.gas.gas,
            };
          }

          if (transaction.gas.model === GasFeeModel.LEGACY) {
            transaction.gas = {
              ...newGasSettings,
              gas: transaction.gas.gas,
            };
          }

          return { transactions: updatedTransactions };
        }),
      clearTransactions: () =>
        set(() => {
          return { transactions: {} };
        }),
    }),
    {
      name: "transactions",
      storage: createJSONStorage(() => storage),
    },
  ),
);
