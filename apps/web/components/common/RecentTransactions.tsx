import Image from "next/image";
import { useTranslations } from "next-intl";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { scroller } from "react-scroll";
import { useAccount } from "wagmi";
import { StoreApi, UseBoundStore } from "zustand";

import IconButton, { IconButtonVariant } from "@/components/buttons/IconButton";
import Pagination from "@/components/common/Pagination";
import RecentTransaction from "@/components/common/RecentTransaction";
import { RecentTransactionsStore } from "@/stores/factories/createRecentTransactionsStore";
import {
  RecentTransactionStatus,
  RecentTransactionTitleTemplate,
  useRecentTransactionsStore,
} from "@/stores/useRecentTransactionsStore";

const PAGE_SIZE = 10;
interface Props {
  showRecentTransactions: boolean;
  handleClose: () => void;
  store: UseBoundStore<StoreApi<RecentTransactionsStore>>;
  pageSize?: number;
  filterFunction?: RecentTransactionTitleTemplate[];
}

const isInView = (element: HTMLDivElement, visibleHeight = 200) => {
  if (!element) return false;

  const rect = element.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;

  // Check if at least 200px of the element from its top is visible
  return rect.top >= 0 && rect.top <= windowHeight - visibleHeight;
};

export default function RecentTransactions({
  showRecentTransactions,
  handleClose,
  pageSize = PAGE_SIZE,
  store,
  filterFunction = [],
}: Props) {
  const t = useTranslations("RecentTransactions");

  const { transactions } = useRecentTransactionsStore();

  const { address, isConnected } = useAccount();

  const componentRef = useRef<HTMLDivElement>(null);
  const prevShowRecentTransactions = useRef(showRecentTransactions);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isInitialized) {
      prevShowRecentTransactions.current = store.getState().isOpened;
      setIsInitialized(true);
    }
  }, [isInitialized, showRecentTransactions, store]);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    if (!prevShowRecentTransactions.current && showRecentTransactions && componentRef.current) {
      let scrollDuration;

      if (!isInView(componentRef.current)) {
        scroller.scrollTo("recent-transactions-container", {
          duration: (scrollDistanceInPx: number) => {
            scrollDuration = scrollDistanceInPx / 2;
            return scrollDuration;
          },
          smooth: true,
          offset: -20,
        });
      }
    }

    prevShowRecentTransactions.current = showRecentTransactions;
  }, [showRecentTransactions, isInitialized]);

  const lowestPendingNonce = useMemo(() => {
    if (address) {
      const accountPendingTransactions = transactions[address]?.filter(
        (v) => v.status === RecentTransactionStatus.PENDING,
      );

      if (!accountPendingTransactions) {
        return -1;
      }

      return accountPendingTransactions.reduce((lowest, obj) => {
        return obj.nonce !== undefined && (lowest === -1 || obj.nonce < lowest)
          ? obj.nonce
          : lowest;
      }, -1);
    }

    return -1;
  }, [address, transactions]);

  const _transactions = useMemo(() => {
    if (address && transactions[address]) {
      return [...transactions[address]];
    }

    return [];
  }, [address, transactions]);

  const _transactionsFiltered = useMemo(() => {
    if (filterFunction?.length) {
      return _transactions.filter((tx) => {
        return filterFunction.includes(tx.title?.template);
      });
    }

    return _transactions;
  }, [filterFunction, _transactions]);

  const [currentPage, setCurrentPage] = useState(1);

  const currentTableData = useMemo(() => {
    const firstPageIndex = (currentPage - 1) * pageSize;
    const lastPageIndex = firstPageIndex + pageSize;
    return _transactionsFiltered.slice(firstPageIndex, lastPageIndex);
  }, [_transactionsFiltered, currentPage, pageSize]);

  return (
    <>
      {showRecentTransactions && (
        <div id="recent-transactions-container" ref={componentRef}>
          <div className="card-spacing pt-2.5 pb-5 surface rounded-5">
            <div className="flex justify-between items-center mb-2.5">
              <h3 className="font-bold text-20">{t("transactions")}</h3>
              <div className="flex items-center relative -right-3">
                <IconButton variant={IconButtonVariant.CLOSE} handleClose={handleClose} />
              </div>
            </div>
            <div>
              {currentTableData.length ? (
                <>
                  <div className="flex flex-col gap-3 mb-5">
                    {currentTableData.map((transaction) => {
                      return (
                        <RecentTransaction
                          isLowestNonce={transaction.nonce === lowestPendingNonce}
                          transaction={transaction}
                          key={transaction.hash}
                        />
                      );
                    })}
                  </div>
                  <Pagination
                    className="pagination-bar"
                    currentPage={currentPage}
                    totalCount={_transactionsFiltered.length}
                    pageSize={pageSize}
                    onPageChange={(page) => setCurrentPage(page as number)}
                  />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[400px] gap-2 bg-empty-no-transactions bg-right-top bg-no-repeat -mx-4 card-spacing-x sm:-mx-6 lg:-mx-10 -mt-3 pt-3 max-md:bg-size-180">
                  <span className="text-secondary-text">
                    {isConnected
                      ? t("transactions_will_be_displayed_here")
                      : "Connect wallet to see your transactions"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
