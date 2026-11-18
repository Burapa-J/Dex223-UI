import { create } from "zustand";

import { ManageTokensDialogContent } from "@/components/manage-tokens/types";
import { TokenListId } from "@/db/db";

type ManageTokensTab = number;
interface ManageTokensDialogStore {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  activeTab: ManageTokensTab;
  setActiveTab: (activeTab: ManageTokensTab) => void;
  content: ManageTokensDialogContent;
  setContent: (content: ManageTokensDialogContent) => void;
  scrollTo: TokenListId | null;
  setScrollTo: (scrollTo: TokenListId | null) => void;
  openTokenLists: () => void;
}

export const useManageTokensDialogStore = create<ManageTokensDialogStore>((set, get) => ({
  isOpen: false,
  activeTab: 0,
  content: "default",
  scrollTo: null,

  setIsOpen: (isOpen) => set({ isOpen }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setContent: (content) => set({ content }),
  setScrollTo: (scrollTo) => set({ scrollTo }),
  openTokenLists: () => set({ isOpen: true, activeTab: 0, content: "default" }),
}));
