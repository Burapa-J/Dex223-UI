import clsx from "clsx";
import Image from "next/image";
import { useTranslations } from "next-intl";
import React, { useCallback, useMemo, useRef, useState } from "react";
import SimpleBar from "simplebar-react";
import { Address, formatUnits } from "viem";
import { useAccount } from "wagmi";

import { useOrders } from "@/app/[locale]/margin-trading/hooks/useOrder";
import { useBorrowMarketFilterStore } from "@/app/[locale]/margin-trading/stores/useBorrowMarketFilterStore";
import { LendingOrder } from "@/app/[locale]/margin-trading/types";
import Svg from "@/components/atoms/Svg";
import Button, { ButtonColor, ButtonSize } from "@/components/buttons/Button";
import IconButton, {
  IconButtonSize,
  IconButtonVariant,
  IconSize,
  SortingType,
} from "@/components/buttons/IconButton";
import Pagination from "@/components/common/Pagination";
import { formatFloat, formatNumberKilos } from "@/functions/formatFloat";
import { Link } from "@/i18n/routing";
import { Currency } from "@/sdk_bi/entities/currency";

type SortingField =
  | "currencyLimit"
  | "interestRate"
  | "leverage"
  | "balance"
  | "duration"
  | "collateralTokens"
  | "tradableTokens"
  | "minLoan";

export function HeaderItem({
  isFirst = false,
  label,
  sorting,
  handleSort,
  sortable = true,
  field,
}: {
  isFirst?: boolean;
  label: string;
  handleSort?: (field: SortingField) => void;
  sorting: SortingType;
  sortable?: boolean;
  field: SortingField;
}) {
  return (
    <div
      onClick={() => {
        if (handleSort) handleSort(field);
      }}
      className={clsx(
        "h-[60px] min-w-0 flex items-center relative mb-2 text-tertiary-text",
        isFirst && "pl-3.5",
        handleSort && "-left-3",
      )}
    >
      {handleSort && (
        <IconButton
          variant={IconButtonVariant.SORTING}
          buttonSize={IconButtonSize.SMALL}
          iconSize={IconSize.SMALL}
          sorting={sorting}
        />
      )}
      <span className="truncate">{label}</span>
    </div>
  );
}

const PAGE_SIZE = 10;

const headerColumns: Array<{ field: SortingField; sortable: boolean }> = [
  { field: "balance", sortable: true },
  { field: "leverage", sortable: true },
  { field: "interestRate", sortable: true },
  { field: "duration", sortable: true },
  { field: "currencyLimit", sortable: true },
  { field: "collateralTokens", sortable: false },
  { field: "tradableTokens", sortable: false },
  { field: "minLoan", sortable: true },
];

function columnTitle(t: ReturnType<typeof useTranslations<"Margin">>, field: SortingField) {
  switch (field) {
    case "balance":
      return t("order_balance");
    case "leverage":
      return t("leverage");
    case "interestRate":
      return t("interest");
    case "duration":
      return t("duration");
    case "currencyLimit":
      return t("limit");
    case "collateralTokens":
      return t("collateral_tokens");
    case "tradableTokens":
      return t("tradable_tokens");
    case "minLoan":
      return t("min_borrowing");
  }
}

function formatOrderAmount(raw: string) {
  const amount = Number(raw);
  if (!Number.isFinite(amount)) {
    return "0";
  }
  if (Math.abs(amount) >= 1_000_000) {
    return formatNumberKilos(amount, { trimZero: true });
  }
  return formatFloat(amount, { trimZero: true });
}

function formatOrderDuration(seconds: number, t: ReturnType<typeof useTranslations<"Margin">>) {
  seconds = Number(seconds);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return t("duration_zero");
  }
  if (seconds < 3600) {
    return t("duration_minutes", { count: Math.max(1, Math.round(seconds / 60)) });
  }
  if (seconds < 86400) {
    return t("duration_hours", { count: formatFloat(seconds / 3600, { trimZero: true }) });
  }
  return t("duration_days", { count: formatFloat(seconds / 86400, { trimZero: true }) });
}

function OrderActions({
  order,
  address,
  currentTimestamp,
}: {
  order: LendingOrder;
  address?: Address;
  currentTimestamp: number;
}) {
  const t = useTranslations("Margin");
  const borrowDisabled =
    order.balance < order.minLoan ||
    currentTimestamp > order.deadline ||
    order.allowedTradingAssets.length === 0;

  if (order.owner.toLowerCase() === address?.toLowerCase()) {
    return (
      <Link className="flex-grow" href={`/margin-trading/lending-order/${order.id}`}>
        <Button fullWidth size={ButtonSize.MEDIUM} colorScheme={ButtonColor.LIGHT_GREEN}>
          {t("view_my_order")}
        </Button>
      </Link>
    );
  }

  return (
    <>
      <Link
        className={clsx("flex-shrink-0", borrowDisabled && "pointer-events-none")}
        href={`/margin-trading/lending-order/${order.id}/borrow`}
      >
        <Button
          disabled={borrowDisabled}
          size={ButtonSize.MEDIUM}
          colorScheme={ButtonColor.LIGHT_GREEN}
        >
          {t("borrow")}
        </Button>
      </Link>
    </>
  );
}

export default function BorrowMarketTable({
  borrowAssets,
  collateralAssets,
  tradableAssets,
}: {
  borrowAssets: Currency[];
  collateralAssets: Currency[];
  tradableAssets: Currency[];
}) {
  const t = useTranslations("Margin");
  const [currentPage, setCurrentPage] = useState(1);

  const [sorting, setSorting] = useState<{ field: SortingField; direction: SortingType }>({
    field: "currencyLimit",
    direction: SortingType.NONE,
  });

  const { address } = useAccount();

  const handleSort = useCallback(
    (field: SortingField) => {
      if (field === sorting.field) {
        switch (sorting.direction) {
          case SortingType.NONE:
            setSorting((values) => ({ ...values, direction: SortingType.ASCENDING }));
            return;
          case SortingType.ASCENDING:
            setSorting((values) => ({ ...values, direction: SortingType.DESCENDING }));
            return;
          case SortingType.DESCENDING:
            setSorting((values) => ({ ...values, direction: SortingType.NONE }));
            return;
        }
      } else {
        setSorting({ field, direction: SortingType.ASCENDING });
      }
    },
    [sorting],
  );

  const {
    leverage,
    maxInterestRatePerMonth,
    maxPositionDuration,
    orderCurrencyLimit,
    minOrderBalance,
    minLoanAmount,
    minPositionDuration,
  } = useBorrowMarketFilterStore();

  const { loading, orders, error, isFilterActive } = useOrders({
    sortingDirection: sorting.direction,
    orderBy: sorting.field,
    leverage_lte: leverage,
    currencyLimit_lte: orderCurrencyLimit || undefined,
    duration_lte: maxPositionDuration || undefined,
    duration_gte: minPositionDuration || undefined,
    interestRate_lte: maxInterestRatePerMonth
      ? (+maxInterestRatePerMonth * 100).toString()
      : undefined,
    minLoanFormatted_gte: minLoanAmount,
    balanceFormatted_gte: minOrderBalance,
    baseAsset_in: borrowAssets.flatMap((asset) => [
      asset.wrapped.address0.toLowerCase() as Address,
      asset.wrapped.address1.toLowerCase() as Address,
    ]),
    collateralAssets_filter: collateralAssets.flatMap((asset) => [
      asset.wrapped.address0.toLowerCase() as Address,
      asset.wrapped.address1.toLowerCase() as Address,
    ]),
    tradableAssets_filter: tradableAssets.flatMap((asset) => [
      asset.wrapped.address0.toLowerCase() as Address,
      asset.wrapped.address1.toLowerCase() as Address,
    ]),
  });

  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const didDrag = useRef(false);
  const dragThreshold = 5;

  const currentTableData = useMemo(() => {
    const firstPageIndex = (currentPage - 1) * PAGE_SIZE;
    const lastPageIndex = firstPageIndex + PAGE_SIZE;
    return orders?.slice(firstPageIndex, lastPageIndex) || [];
  }, [orders, currentPage]);

  const currentTimestamp = useMemo(() => {
    return Date.now() / 1000;
  }, []);

  if (loading) {
    return <div>{t("loading")}</div>;
  }

  return (
    <>
      {orders?.length ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] w-full rounded-5 overflow-hidden">
            <SimpleBar
              autoHide={false}
              style={{ maxWidth: "100%", minWidth: 0, width: "100%" }}
              className="max-w-full min-w-0"
              scrollableNodeProps={{
                onMouseDown(e: any) {
                  const el = e.currentTarget;
                  isDragging.current = true;
                  didDrag.current = false;
                  el.classList.add("is-grabbing");

                  startX.current = e.pageX - el.offsetLeft;
                  scrollLeft.current = el.scrollLeft;
                },
                onMouseMove(e: any) {
                  if (!isDragging.current) return;
                  e.preventDefault();
                  const el = e.currentTarget;
                  const x = e.pageX - el.offsetLeft;
                  const walk = x - startX.current;
                  if (Math.abs(walk) > dragThreshold) {
                    didDrag.current = true;
                  }
                  el.scrollLeft = scrollLeft.current - walk;
                },
                onMouseUp(e: any) {
                  isDragging.current = false;
                  e.currentTarget.classList.remove("is-grabbing");
                },
                onMouseLeave(e: any) {
                  isDragging.current = false;
                  e.currentTarget.classList.remove("is-grabbing");
                },
              }}
            >
              <div className="min-w-[1020px]">
                <div className="grid overflow-hidden bg-table-gradient grid-cols-[minmax(175px,1.62fr)_minmax(110px,0.93fr)_minmax(100px,0.85fr)_minmax(106px,0.9fr)_minmax(78px,0.65fr)_minmax(140px,1.15fr)_minmax(132px,1.15fr)_minmax(150px,1.35fr)] pb-2 px-2.5">
                  {headerColumns.map((columnData, index) => (
                    <HeaderItem
                      key={columnData.field}
                      label={columnTitle(t, columnData.field)}
                      sorting={
                        sorting.field === columnData.field ? sorting.direction : SortingType.NONE
                      }
                      handleSort={!columnData.sortable ? undefined : handleSort}
                      field={columnData.field}
                      isFirst={index === 0}
                    />
                  ))}

                  {currentTableData.map((o: LendingOrder) => {
                    return (
                      <React.Fragment key={o.id}>
                        <Link
                          href={`/margin-trading/lending-order/${o.id}`}
                          className="group contents"
                          onClick={(e) => {
                            // if we dragged, cancel navigation
                            if (didDrag.current) {
                              e.preventDefault();
                              didDrag.current = false;
                            }
                          }}
                        >
                          <div className="pl-2.5 rounded-l-3 h-[56px] min-w-0 flex items-center gap-2 overflow-hidden group-hocus:bg-tertiary-bg duration-200 pr-2">
                            {o.allowedTradingAssets.length === 0 ? (
                              <Svg iconName="warning" className="text-red-light shrink-0" />
                            ) : (
                              <Image
                                src="/images/tokens/placeholder.svg"
                                width={24}
                                height={24}
                                alt=""
                                className="shrink-0"
                              />
                            )}
                            <span
                              className={clsx(
                                "font-medium truncate",
                                o.balance < o.minLoan && "text-yellow-light",
                              )}
                            >
                              {formatOrderAmount(
                                formatUnits(o.balance, o.baseAsset.decimals ?? 18),
                              )}
                            </span>
                            <span className="text-secondary-texts shrink-0">
                              {o.baseAsset.symbol}
                            </span>
                          </div>
                          <div className=" h-[56px] flex items-center group-hocus:bg-tertiary-bg duration-200 pr-2">
                            {o.leverage}x
                          </div>
                          <div className=" h-[56px] flex items-center group-hocus:bg-tertiary-bg duration-200 pr-2">
                            {formatFloat(Number(o.interestRate) / 100, { trimZero: true })}%
                          </div>
                          <div className="h-[56px] min-w-0 flex items-center whitespace-nowrap group-hocus:bg-tertiary-bg duration-200 pr-2">
                            {formatOrderDuration(o.positionDuration, t)}
                          </div>
                          <div className=" h-[56px] flex items-center group-hocus:bg-tertiary-bg duration-200 pr-2">
                            {o.currencyLimit}
                          </div>
                          <div className="h-[56px] min-w-0 overflow-hidden flex items-center group-hocus:bg-tertiary-bg duration-200 pr-2">
                            <span className="flex gap-2 min-w-0">
                              {o.allowedCollateralAssets.length > 2 ? (
                                <>
                                  {o.allowedCollateralAssets.slice(0, 2).map((token) => (
                                    <span
                                      key={token.wrapped.address0}
                                      className="rounded-2 flex items-center gap-1 border border-secondary-border py-1 px-2"
                                    >
                                      {token.symbol}
                                    </span>
                                  ))}
                                  <span className="px-1 text-16 flex items-end">{"..."}</span>

                                  <span className="rounded-2 border border-secondary-border font-medium py-1 px-2 min-w-8 flex items-center justify-center">
                                    {o.allowedCollateralAssets.length - 2}
                                  </span>
                                </>
                              ) : (
                                o.allowedCollateralAssets.map((token) => (
                                  <span
                                    key={token.wrapped.address0}
                                    className="rounded-2 flex items-center gap-1 border border-secondary-border py-1 px-2 pr-3"
                                  >
                                    {token.symbol}
                                  </span>
                                ))
                              )}
                            </span>
                          </div>
                          <div className="h-[56px] min-w-0 overflow-hidden flex items-center group-hocus:bg-tertiary-bg duration-200 pr-2">
                            <span className="flex gap-2 min-w-0">
                              {o.allowedTradingAssets.length > 2 ? (
                                <>
                                  {o.allowedTradingAssets.slice(0, 2).map((token) => (
                                    <span
                                      key={token.wrapped.address0}
                                      className="rounded-2 flex items-center gap-1 border border-secondary-border py-1 px-2"
                                    >
                                      {token.symbol}
                                    </span>
                                  ))}
                                  <span className="px-1 text-16 flex items-end">{"..."}</span>

                                  <span className="rounded-2 border border-secondary-border font-medium py-1 px-2 min-w-8 flex items-center justify-center">
                                    {o.allowedTradingAssets.length - 2}
                                  </span>
                                </>
                              ) : (
                                o.allowedTradingAssets.map((token) => (
                                  <span
                                    key={token.wrapped.address0}
                                    className="rounded-2 flex items-center gap-1 border border-secondary-border py-1 px-2"
                                  >
                                    {token.symbol}
                                  </span>
                                ))
                              )}
                            </span>
                          </div>
                          <div className="h-[56px] min-w-0 rounded-r-3 flex items-center overflow-hidden group-hocus:bg-tertiary-bg duration-200 pr-2 gap-2">
                            <span
                              className={clsx(
                                "font-medium truncate",
                                o.balance < o.minLoan && "text-yellow-light",
                              )}
                            >
                              {formatOrderAmount(
                                formatUnits(o.minLoan, o.baseAsset.decimals ?? 18),
                              )}
                            </span>
                            <span className="text-secondary-texts shrink-0">
                              {o.baseAsset.symbol}
                            </span>
                          </div>
                        </Link>
                        <div className="col-span-full flex items-center gap-2 px-2.5 pb-3 lg:hidden">
                          <OrderActions
                            order={o}
                            address={address}
                            currentTimestamp={currentTimestamp}
                          />
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </SimpleBar>
            <div className="hidden lg:block h-full border-l border-secondary-border shadow-[0px_4px_40px_0px_#000000] relative z-40">
              <div
                className={clsx(
                  "h-[60px] flex items-center bg-quaternary-bg pl-5 text-tertiary-text",
                )}
              >
                {t("actions")}
              </div>
              <div className="py-2.5 px-3 bg-primary-bg">
                {currentTableData.map((o: LendingOrder) => {
                  return (
                    <div key={o.id} className="p-2 gap-2 flex items-center">
                      <OrderActions
                        order={o}
                        address={address}
                        currentTimestamp={currentTimestamp}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <Pagination
            isLoading={loading}
            className="pagination-bar mt-5"
            currentPage={currentPage}
            totalCount={orders.length}
            pageSize={PAGE_SIZE}
            onPageChange={(page) => setCurrentPage(page as number)}
          />
        </>
      ) : null}
      {!loading && !orders?.length && (
        <div className="bg-primary-bg rounded-5 h-[340px] flex items-center justify-center text-secondary-text bg-empty-no-borrow-found bg-no-repeat bg-right-top">
          {error
            ? t("orders_load_error")
            : isFilterActive
              ? t("orders_no_results")
              : t("orders_none_yet")}
        </div>
      )}
    </>
  );
}
