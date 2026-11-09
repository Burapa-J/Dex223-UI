import ExternalTextLink from "@repo/ui/external-text-link";
import Preloader from "@repo/ui/preloader";
import clsx from "clsx";
import Image from "next/image";
import { useTranslations } from "next-intl";
import React, { ButtonHTMLAttributes, PropsWithChildren } from "react";

import Svg from "@/components/atoms/Svg";
import IconButton from "@/components/buttons/IconButton";
import { useTransactionSpeedUpDialogStore } from "@/components/dialogs/stores/useTransactionSpeedUpDialogStore";
import { clsxMerge } from "@/functions/clsxMerge";
import { formatFloat } from "@/functions/formatFloat";
import getExplorerLink, { ExplorerLinkType } from "@/functions/getExplorerLink";
import truncateMiddle from "@/functions/truncateMiddle";
import {
  IRecentTransaction,
  IRecentTransactionTitle,
  RecentTransactionStatus,
  RecentTransactionTitleTemplate,
} from "@/stores/useRecentTransactionsStore";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  color?: "primary" | "secondary";
  isRepriced?: boolean;
}

export function RecentTransactionActionButton({
  color = "primary",
  children,
  isRepriced,
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      {...props}
      className={clsx(
        "h-8 rounded-5 relative px-6 border disabled:border-secondary-border disabled:text-tertiary-text duration-300 ease-in-out disabled:pointer-events-none w-full",
        color === "primary"
          ? "border-transparent text-secondary-text hocus:text-primary-text bg-green-bg hocus:border-green-hover"
          : "border-primary-border text-secondary-text hocus:border-red-light hocus:text-primary-text hocus:bg-red-bg",
      )}
    >
      {isRepriced && (
        <span className="absolute -top-2 right-2 text-green">
          <Svg size={16} iconName="speed-up" />
        </span>
      )}
      {children}
    </button>
  );
}

export function RecentTransactionTitle({ title }: { title: IRecentTransactionTitle }) {
  const t = useTranslations("RecentTransactions");

  switch (title.template) {
    case RecentTransactionTitleTemplate.APPROVE:
      return (
        <span className="mr-1 text-0">
          <Svg className="text-tertiary-text inline-block mr-1 align-top" iconName="check" />

          <span className="font-medium inline text-16">
            {t("approve_title", { symbol: title.symbol })}
          </span>
        </span>
      );
    case RecentTransactionTitleTemplate.LIST_SINGLE:
      return (
        <span className="mr-1 text-0">
          <Svg className="text-tertiary-text inline-block mr-1 align-top" iconName="listing" />

          <span className="font-medium inline text-16">List token</span>
        </span>
      );
    case RecentTransactionTitleTemplate.LIST_DOUBLE:
      return (
        <span className="mr-1 text-0">
          <Svg className="text-tertiary-text inline-block mr-1 align-top" iconName="listing" />

          <span className="font-medium inline text-16">List tokens</span>
        </span>
      );
    case RecentTransactionTitleTemplate.DEPOSIT:
      return (
        <span className="mr-1 text-0">
          <Svg className="text-tertiary-text inline-block mr-1 align-top" iconName="deposit" />

          <span className="font-medium inline text-16">
            {t("deposit_title", { symbol: title.symbol })}
          </span>
        </span>
      );
    case RecentTransactionTitleTemplate.TRANSFER:
      return (
        <span className="mr-1 text-0">
          <Svg
            className="text-tertiary-text inline-block mr-1 align-top"
            iconName="transfer-to-contract"
          />

          <span className="font-medium inline text-16">Transfer to contract</span>
        </span>
      );
    case RecentTransactionTitleTemplate.WITHDRAW:
      return (
        <span className="mr-1 text-0">
          <Svg className="text-tertiary-text inline-block mr-1 align-top" iconName="withdraw" />

          <span className="font-medium inline text-16">
            {t("withdraw_title", { symbol: title.symbol })}
          </span>
        </span>
      );
    case RecentTransactionTitleTemplate.CONVERT:
      return (
        <span className="mr-1 text-0">
          <Svg className="text-tertiary-text inline-block mr-1 align-top" iconName="convert" />

          <span className="font-medium inline text-16">
            {t("conversion_title", { symbol: title.symbol })}
          </span>
        </span>
      );
    case RecentTransactionTitleTemplate.DEPLOY_TOKEN:
      return (
        <span className="mr-1 text-0">
          <Svg className="text-tertiary-text inline-block mr-1 align-top" iconName="deploy-token" />

          <span className="font-medium inline text-16">Create token</span>
        </span>
      );
    case RecentTransactionTitleTemplate.UNWRAP:
      return (
        <span className="mr-1 text-0">
          <Svg className="text-tertiary-text inline-block mr-1 align-top" iconName="convert" />

          <span className="font-medium inline text-16">Unwrap {title.symbol}</span>
        </span>
      );
    case RecentTransactionTitleTemplate.SWAP:
      return (
        <span className="mr-1 text-0">
          <Svg className="text-tertiary-text inline-block mr-1 align-top" iconName="swap" />

          <span className="font-medium inline-block text-16 align-top">{t("swap_title")}</span>
        </span>
      );
    case RecentTransactionTitleTemplate.COLLECT:
      return (
        <span className="mr-1 text-0">
          <Svg className="text-tertiary-text inline-block mr-1 align-top" iconName="collect" />

          <span className="font-medium inline-block text-16 align-top">
            {t("collect_fees_title")}
          </span>
        </span>
      );
    case RecentTransactionTitleTemplate.REMOVE:
      return (
        <span className="mr-1 text-0">
          <Svg className="text-tertiary-text inline-block mr-1 align-top" iconName="minus" />

          <span className="font-medium inline-block text-16 align-top">
            {t("remove_liquidity_title")}
          </span>
        </span>
      );
    case RecentTransactionTitleTemplate.ADD:
      return (
        <span className="mr-1 text-0">
          <Svg className="text-tertiary-text inline-block mr-1 align-top" iconName="add" />

          <span className="font-medium inline-block text-16 align-top">
            {t("add_liquidity_title")}
          </span>
        </span>
      );
    case RecentTransactionTitleTemplate.CREATE_LENDING_ORDER:
      return (
        <span className="mr-1 text-0">
          <Svg className="text-tertiary-text inline-block mr-1 align-top" iconName="lending" />

          <span className="font-medium inline-block text-16 align-top">Create lending order</span>
        </span>
      );
    case RecentTransactionTitleTemplate.CLOSE_LENDING_ORDER:
      return (
        <span className="mr-1 text-0">
          <Svg className="text-tertiary-text inline-block mr-1 align-top" iconName="closed" />

          <span className="font-medium inline-block text-16 align-top">Close lending order</span>
        </span>
      );
    case RecentTransactionTitleTemplate.OPEN_LENDING_ORDER:
      return (
        <span className="mr-1 text-0">
          <Svg className="text-tertiary-text inline-block mr-1 align-top" iconName="open-order" />

          <span className="font-medium inline-block text-16 align-top">Open lending order</span>
        </span>
      );
    case RecentTransactionTitleTemplate.EDIT_LENDING_ORDER:
      return (
        <span className="mr-1 text-0">
          <Svg className="text-tertiary-text inline-block mr-1 align-top" iconName="edit" />

          <span className="font-medium inline-block text-16 align-top">Edit lending order</span>
        </span>
      );
    case RecentTransactionTitleTemplate.CREATE_MARGIN_POSITION:
      return (
        <span className="mr-1 text-0">
          <Svg className="text-tertiary-text inline-block mr-1 align-top" iconName="borrow" />

          <span className="font-medium inline-block text-16 align-top">
            Borrow {title.amountBorrowed} {title.symbolBorrowed}
          </span>
        </span>
      );
    case RecentTransactionTitleTemplate.CLOSE_MARGIN_POSITION:
      return (
        <span className="mr-1 text-0">
          <Svg className="text-tertiary-text inline-block mr-1 align-top" iconName="closed" />
          <span className="font-medium inline-block text-16 align-top">Close margin position</span>
        </span>
      );
    case RecentTransactionTitleTemplate.UNFREEZE_MARGIN_POSITION:
      return (
        <span className="mr-1 text-0">
          <Svg className="text-tertiary-text inline-block mr-1 align-top" iconName="done" />
          <span className="font-medium inline-block text-16 align-top">
            Unfreeze margin position
          </span>
        </span>
      );
  }
}

export function RecentTransactionSubTitle({ title }: { title: IRecentTransactionTitle }) {
  const t = useTranslations("RecentTransactions");

  switch (title.template) {
    case RecentTransactionTitleTemplate.APPROVE:
    case RecentTransactionTitleTemplate.DEPOSIT:
    case RecentTransactionTitleTemplate.WITHDRAW:
    case RecentTransactionTitleTemplate.CONVERT:
    case RecentTransactionTitleTemplate.UNWRAP:
    case RecentTransactionTitleTemplate.TRANSFER:
      return (
        <span className="text-14 text-secondary-text">
          {t("single_subtitle", {
            amount: formatFloat(title.amount, { trimZero: true }),
            symbol: title.symbol,
          })}
        </span>
      );
    case RecentTransactionTitleTemplate.DEPLOY_TOKEN:
      return (
        <span className="text-14 text-secondary-text">
          <ExternalTextLink
            href={getExplorerLink(ExplorerLinkType.TOKEN, title.address, title.chainId)}
            text={truncateMiddle(title.address)}
          />
        </span>
      );
    case RecentTransactionTitleTemplate.SWAP:
    case RecentTransactionTitleTemplate.REMOVE:
    case RecentTransactionTitleTemplate.COLLECT:
    case RecentTransactionTitleTemplate.ADD:
      return (
        <span className="text-14 text-secondary-text">
          {t("double_tokens_subtitle", {
            amount0: formatFloat(title.amount0, { trimZero: true }),
            amount1: formatFloat(title.amount1, { trimZero: true }),
            symbol0: title.symbol0,
            symbol1: title.symbol1,
          })}
        </span>
      );
    case RecentTransactionTitleTemplate.LIST_SINGLE:
      return (
        <span className="text-14 text-secondary-text">{`${title.symbol} in "${title.autoListing}" list`}</span>
      );
    case RecentTransactionTitleTemplate.LIST_DOUBLE:
      return (
        <span className="text-14 text-secondary-text">{`${title.symbol0} and ${title.symbol0} in "${title.autoListing}" list`}</span>
      );
    case RecentTransactionTitleTemplate.CLOSE_LENDING_ORDER:
    case RecentTransactionTitleTemplate.OPEN_LENDING_ORDER:
    case RecentTransactionTitleTemplate.EDIT_LENDING_ORDER:
      return (
        <span className="text-14 text-secondary-text">{`${title.symbol} (ID: ${title.orderId})`}</span>
      );
    case RecentTransactionTitleTemplate.CREATE_MARGIN_POSITION:
      return (
        <span className="text-14 text-secondary-text">{`${title.amountCollateral} ${title.symbolCollateral} collateral and ${title.amountFee} ${title.symbolFee} fee`}</span>
      );
    case RecentTransactionTitleTemplate.CLOSE_MARGIN_POSITION:
    case RecentTransactionTitleTemplate.UNFREEZE_MARGIN_POSITION:
      return (
        <span className="text-14 text-secondary-text">{`${title.symbol} (ID: ${title.positionId})`}</span>
      );
    case RecentTransactionTitleTemplate.CREATE_LENDING_ORDER:
      return <span className="text-14 text-secondary-text">{title.symbol}</span>;
  }
}

export function RecentTransactionLogo({ title }: { title: IRecentTransactionTitle }) {
  switch (title.template) {
    case RecentTransactionTitleTemplate.APPROVE:
    case RecentTransactionTitleTemplate.DEPOSIT:
    case RecentTransactionTitleTemplate.WITHDRAW:
    case RecentTransactionTitleTemplate.LIST_SINGLE:
    case RecentTransactionTitleTemplate.CONVERT:
    case RecentTransactionTitleTemplate.DEPLOY_TOKEN:
    case RecentTransactionTitleTemplate.UNWRAP:
    case RecentTransactionTitleTemplate.CREATE_LENDING_ORDER:
    case RecentTransactionTitleTemplate.CLOSE_LENDING_ORDER:
    case RecentTransactionTitleTemplate.OPEN_LENDING_ORDER:
    case RecentTransactionTitleTemplate.EDIT_LENDING_ORDER:
    case RecentTransactionTitleTemplate.CREATE_MARGIN_POSITION:
    case RecentTransactionTitleTemplate.CLOSE_MARGIN_POSITION:
    case RecentTransactionTitleTemplate.UNFREEZE_MARGIN_POSITION:
    case RecentTransactionTitleTemplate.TRANSFER:
      return (
        <div className="flex items-center justify-center w-12 h-12 flex-shrink-0">
          <Image
            className="rounded-full"
            width={36}
            height={36}
            src={title.logoURI || "/images/tokens/placeholder.svg"}
            alt=""
          />
        </div>
      );
    case RecentTransactionTitleTemplate.SWAP:
    case RecentTransactionTitleTemplate.REMOVE:
    case RecentTransactionTitleTemplate.COLLECT:
    case RecentTransactionTitleTemplate.ADD:
    case RecentTransactionTitleTemplate.LIST_DOUBLE:
      return (
        <div className="flex items-center relative w-12 h-12 flex-shrink-0">
          <Image
            className="absolute left-0 top-0"
            width={32}
            height={32}
            src={title.logoURI0 || "/images/tokens/placeholder.svg"}
            alt=""
          />
          <div className="w-[34px] h-[34px] flex absolute right-0 bottom-0 bg-tertiary-bg rounded-full items-center justify-center">
            <Image
              width={32}
              height={32}
              src={title.logoURI1 || "/images/tokens/placeholder.svg"}
              alt=""
            />
          </div>
        </div>
      );
  }
}

export function RecentTransactionStatusIcon({
  status,
  replacement,
}: {
  status: RecentTransactionStatus;
  replacement?: "cancelled" | "repriced";
}) {
  switch (status) {
    case RecentTransactionStatus.PENDING:
      return <Preloader />;
    case RecentTransactionStatus.SUCCESS:
      if (replacement === "cancelled") {
        return <Svg className="text-red-light" iconName="warning" />;
      }
      return <Svg className="text-green" iconName="done" />;
    case RecentTransactionStatus.ERROR:
      return <Svg className="text-red-light" iconName="warning" />;
  }
}

export default function RecentTransaction({
  transaction,
  showSpeedUp = true,
  isLowestNonce = false,
  view = "default",
  isWaitingForProceeding = false,
}: {
  transaction: IRecentTransaction;
  isLowestNonce?: boolean;
  showSpeedUp?: boolean;
  view?: "default" | "transparent";
  isWaitingForProceeding?: boolean;
}) {
  const t = useTranslations("RecentTransactions");
  const { handleSpeedUp, handleCancel, replacement } = useTransactionSpeedUpDialogStore();
  showSpeedUp = showSpeedUp && transaction.nonce !== undefined;

  return (
    <div
      key={transaction.hash}
      className={clsxMerge(
        "flex justify-between w-full bg-tertiary-bg rounded-3 p-4 md:p-5 items-center @container flex-wrap",
        view === "transparent" && "bg-transparent rounded-0 p-0",
      )}
    >
      <div
        className={clsxMerge(
          "w-full",
          isWaitingForProceeding && "flex flex-col sm:grid sm:grid-cols-[1fr_auto]",
        )}
      >
        <div className="flex gap-2">
          <RecentTransactionLogo title={transaction.title} />
          <div className="mt-0.5 flex-grow">
            <div className="flex justify-between">
              <RecentTransactionTitle title={transaction.title} />
              <div className="flex gap-3">
                {!isWaitingForProceeding ? (
                  <>
                    {transaction.replacement === "cancelled" && (
                      <span className="@[420px]:flex hidden gap-1 text-red-light">
                        Cancelled
                        <Svg iconName="cancel" />
                      </span>
                    )}
                    <a
                      className="relative w-10 h-6 flex items-center justify-center"
                      target="_blank"
                      rel="noopener noreferrer"
                      href={getExplorerLink(
                        ExplorerLinkType.TRANSACTION,
                        transaction.hash,
                        transaction.chainId,
                      )}
                    >
                      <IconButton iconName="forward" />
                    </a>
                    <span className="flex-shrink-0">
                      <RecentTransactionStatusIcon
                        replacement={transaction.replacement}
                        status={transaction.status}
                      />
                    </span>
                  </>
                ) : (
                  <div className="flex gap-2 justify-end">
                    <Preloader size={20} type="linear" />
                    <span className="text-secondary-text text-14">Proceed in your wallet</span>
                  </div>
                )}
              </div>
            </div>

            <RecentTransactionSubTitle title={transaction.title} />
          </div>
        </div>
      </div>

      {transaction.replacement === "cancelled" && (
        <span className="@[420px]:hidden flex items-center gap-1 text-red-light text-12 mt-1">
          Cancelled
          <Svg iconName="cancel" size={16} />
        </span>
      )}

      {transaction.status === RecentTransactionStatus.PENDING && showSpeedUp && isLowestNonce && (
        <>
          {transaction.replacement !== "cancelled" ? (
            <div className="w-full grid grid-cols-2 gap-3 mt-3">
              <RecentTransactionActionButton
                onClick={() => handleCancel(transaction)}
                color="secondary"
              >
                {t("cancel")}
              </RecentTransactionActionButton>

              <RecentTransactionActionButton
                onClick={() => handleSpeedUp(transaction)}
                isRepriced={transaction.replacement === "repriced"}
              >
                {t("speed_up")}
              </RecentTransactionActionButton>
            </div>
          ) : (
            <div className="mt-3 w-full">
              <RecentTransactionActionButton onClick={() => handleSpeedUp(transaction)}>
                Speed up cancellation
              </RecentTransactionActionButton>
            </div>
          )}
        </>
      )}
      {transaction.status === RecentTransactionStatus.PENDING && showSpeedUp && !isLowestNonce && (
        <div className="w-full mt-3 grid grid-cols-1">
          <RecentTransactionActionButton disabled color="secondary">
            {t("queue")}
          </RecentTransactionActionButton>
        </div>
      )}
    </div>
  );
}
