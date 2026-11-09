import { getTransaction } from "@wagmi/core";
import { white } from "next/dist/lib/picocolors";
import { useCallback, useEffect, useMemo } from "react";
import { Address } from "viem";
import { useAccount, usePublicClient } from "wagmi";

import { addNotification } from "@/other/notification";
import {
  IRecentTransactionTitle,
  RecentTransactionStatus,
  stringifyObject,
  useRecentTransactionsStore,
} from "@/stores/useRecentTransactionsStore";

const trackingTransactions: Address[] = [];
// viem can fire onReplaced several times for one replacement (and again on each retry of
// waitForTransactionReceipt), so remember the last replacement hash applied per transaction id.
const appliedReplacements = new Map<string, Address>();
export function useRecentTransactionTracking() {
  const {
    transactions,
    updateTransactionStatus,
    updateTransactionGasSettings,
    updateTransactionHash,
  } = useRecentTransactionsStore();
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const transactionsForAddress = useMemo(() => {
    return (address && transactions[address]) || [];
  }, [address, transactions]);

  const waitAndUpdate = useCallback(
    async (hash: `0x${string}`, id: string, title: IRecentTransactionTitle) => {
      if (!publicClient || !address) {
        return;
      }

      // Transaction/receipt absence at an RPC does not prove a broadcast has failed.
      const transaction = await publicClient.waitForTransactionReceipt({
        timeout: 1000 * 60 * 60,
        hash,
        onReplaced: (replacement) => {
          if (replacement.reason !== "repriced" && replacement.reason !== "cancelled") {
            return;
          }
          const newHash = replacement.transaction.hash;
          if (appliedReplacements.get(id) === newHash) {
            return;
          }
          appliedReplacements.set(id, newHash);
          updateTransactionHash(id, newHash, address, replacement.reason);
        },
      });
      if (transaction.status === "success") {
        updateTransactionStatus(id, RecentTransactionStatus.SUCCESS, address);
        addNotification(title, RecentTransactionStatus.SUCCESS);
      } else if (transaction.status === "reverted") {
        updateTransactionStatus(id, RecentTransactionStatus.ERROR, address);
        addNotification(title, RecentTransactionStatus.ERROR, { duration: Infinity });
      }
    },
    [address, publicClient, updateTransactionHash, updateTransactionStatus],
  );

  const waitForTransaction = useCallback(
    async (hash: `0x${string}`, id: string, title: IRecentTransactionTitle) => {
      while (true) {
        try {
          await waitAndUpdate(hash, id, title);
          return;
        } catch (e) {
          console.log(e);
          // Transient RPC errors also leave the broadcast pending. Retry after a delay
          // so receipt tracking resumes when the provider recovers.
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    },
    [waitAndUpdate],
  );

  useEffect(() => {
    for (const transaction of transactionsForAddress) {
      if (
        transaction.status === RecentTransactionStatus.PENDING &&
        !trackingTransactions.includes(transaction.id)
      ) {
        waitForTransaction(transaction.hash, transaction.id, transaction.title);
        trackingTransactions.push(transaction.id);
      }
    }
  }, [transactionsForAddress, waitForTransaction]);
}
