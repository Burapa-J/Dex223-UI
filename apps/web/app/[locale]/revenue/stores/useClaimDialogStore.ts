"use client";

import { create } from "zustand";

export type ClaimDialogState =
  | "initial"
  | "confirming-delivery"
  | "executing-delivery"
  | "confirming-claim"
  | "executing-claim"
  | "success"
  | "error";

export interface ClaimToken {
  id: string;
  name: string;
  symbol: string;
  logoURI: string;
  amount: string;
  amountUSD: string;
  erc20Address: string;
  erc223Address: string;
  fullErc20Address?: string; // Full address for ERC20 token
  fullErc223Address?: string; // Full address for ERC223 token
  tokenId?: string; // Identifier for getting pools
  chainId: number;
  // Token versions with a non-zero payout; claim() pays each one from its own balance.
  claimAddresses?: string[];
  amountERC20?: string;
  amountERC223?: string;
  selectedStandard?: "ERC-20" | "ERC-223";
}

export interface ClaimDialogData {
  selectedTokens: ClaimToken[];
  totalReward: number;
  selectedStandard?: "ERC-20" | "ERC-223"; // Global standard for single token
  tokenStandards?: Record<string, "ERC-20" | "ERC-223">; // Per-token standards for multiple tokens
  errorMessage?: string;
  deliveryTransactionHash?: string;
  claimTransactionHash?: string;
  isMultiple?: boolean; // Flag to determine if it's single or multiple claim
}

interface ClaimDialogStore {
  isOpen: boolean;
  state: ClaimDialogState;
  data: ClaimDialogData | null;

  // Actions
  openDialog: (data: ClaimDialogData) => void;
  closeDialog: () => void;
  setState: (state: ClaimDialogState) => void;
  setData: (data: Partial<ClaimDialogData>) => void;
  setError: (errorMessage: string) => void;
  setDeliveryTransactionHash: (hash: string) => void;
  setClaimTransactionHash: (hash: string) => void;
  setTokenStandard: (tokenId: string, standard: "ERC-20" | "ERC-223") => void;
  resetClaim: () => void;
}

export const useClaimDialogStore = create<ClaimDialogStore>((set) => ({
  isOpen: false,
  state: "initial",
  data: null,

  openDialog: (data) =>
    set({
      isOpen: true,
      state: "initial",
      data,
    }),

  closeDialog: () =>
    set((state) => {
      if (
        state.state === "confirming-delivery" ||
        state.state === "executing-delivery" ||
        state.state === "confirming-claim" ||
        state.state === "executing-claim"
      ) {
        return {
          isOpen: false,
        };
      }
      return {
        isOpen: false,
        state: "initial",
        data: null,
      };
    }),

  setState: (state) =>
    set((currentState) => {
      if (state === "success" || state === "error") {
        return { state };
      }
      return { state };
    }),

  setData: (newData) =>
    set((state) => ({
      data: state.data ? { ...state.data, ...newData } : null,
    })),

  setError: (errorMessage) =>
    set((state) => ({
      data: state.data ? { ...state.data, errorMessage } : null,
      state: "error",
    })),

  setDeliveryTransactionHash: (deliveryTransactionHash) =>
    set((state) => ({
      data: state.data ? { ...state.data, deliveryTransactionHash } : null,
    })),

  setClaimTransactionHash: (claimTransactionHash) =>
    set((state) => ({
      data: state.data ? { ...state.data, claimTransactionHash } : null,
    })),

  setTokenStandard: (tokenId, standard) =>
    set((state) => {
      if (!state.data) return state;

      const tokenStandards = state.data.tokenStandards || {};
      return {
        data: {
          ...state.data,
          tokenStandards: {
            ...tokenStandards,
            [tokenId]: standard,
          },
        },
      };
    }),

  resetClaim: () =>
    set({
      isOpen: false,
      state: "initial",
      data: null,
    }),
}));
