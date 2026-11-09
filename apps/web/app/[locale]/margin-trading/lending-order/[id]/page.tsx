"use client";
import ExternalTextLink from "@repo/ui/external-text-link";
import GradientCard, { CardGradient } from "@repo/ui/gradient-card";
import Tooltip from "@repo/ui/tooltip";
import Image from "next/image";
import { useTranslations } from "next-intl";
import React, { use, useMemo, useRef, useState } from "react";
import SimpleBar from "simplebar-react";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";

import {
  InactiveMarginPositionCard,
  LendingPositionCard,
} from "@/app/[locale]/margin-trading/components/MarginPositionCard";
import MarginRecordMissing from "@/app/[locale]/margin-trading/components/MarginRecordMissing";
import {
  OrderInfoBlock,
  OrderInfoCard,
} from "@/app/[locale]/margin-trading/components/widgets/OrderInfoBlock";
import timestampToDateString from "@/app/[locale]/margin-trading/helpers/timestampToDateString";
import { useOrder } from "@/app/[locale]/margin-trading/hooks/useOrder";
import OrderCloseDialog from "@/app/[locale]/margin-trading/lending-order/[id]/components/OrderCloseDialog";
import OrderDepositDialog from "@/app/[locale]/margin-trading/lending-order/[id]/components/OrderDepositDialog";
import OrderOpenDialog from "@/app/[locale]/margin-trading/lending-order/[id]/components/OrderOpenDialog";
import OrderWithdrawDialog from "@/app/[locale]/margin-trading/lending-order/[id]/components/OrderWithdrawDialog";
import { calculatePeriodInterestRate } from "@/app/[locale]/margin-trading/lending-order/[id]/helpers/calculatePeriodInterestRate";
import calculateTotalOrderBalance from "@/app/[locale]/margin-trading/lending-order/[id]/helpers/calculateTotalOrderBalance";
import Container from "@/components/atoms/Container";
import DialogHeader from "@/components/atoms/DialogHeader";
import DrawerDialog from "@/components/atoms/DrawerDialog";
import { SearchInput } from "@/components/atoms/Input";
import Svg from "@/components/atoms/Svg";
import Button, { ButtonColor } from "@/components/buttons/Button";
import { TokenPortfolioDialogContent } from "@/components/dialogs/TokenPortfolioDialog";
import { formatFloat } from "@/functions/formatFloat";
import getExplorerLink, { ExplorerLinkType } from "@/functions/getExplorerLink";
import { filterTokens } from "@/functions/searchTokens";
import truncateMiddle from "@/functions/truncateMiddle";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { useTokenLists } from "@/hooks/useTokenLists";
import { Link } from "@/i18n/routing";
import { ORACLE_ADDRESS } from "@/sdk_bi/addresses";
import { Token } from "@/sdk_bi/entities/token";

export default function LendingOrder({
  params,
}: {
  params: Promise<{
    id: number;
  }>;
}) {
  const [isDepositDialogOpened, setIsDepositDialogOpened] = useState(false);
  const [isCloseDialogOpened, setIsCloseDialogOpened] = useState(false);
  const [isOpenDialogOpened, setIsOpenDialogOpened] = useState(false);
  const [isWithdrawDialogOpened, setIsWithdrawDialogOpened] = useState(false);
  const { id } = use(params);
  const { address } = useAccount();

  const { order, loading, refetch, error } = useOrder({ id: +id });
  const [tokenForPortfolio, setTokenForPortfolio] = useState<Token | null>(null);
  const chainId = useCurrentChainId();

  const tokenLists = useTokenLists();

  const isOwner = useMemo(() => {
    if (!address || !order) {
      return false;
    }

    return address.toLowerCase() === order?.owner.toLowerCase();
  }, [address, order]);

  const requestTimeRef = useRef<number>(Date.now());

  const [searchTradableTokenValue, setSearchTradableTokenValue] = useState("");
  const t = useTranslations("Margin");

  const [filteredTokens, isTokenFilterActive] = useMemo(() => {
    return searchTradableTokenValue
      ? [filterTokens(searchTradableTokenValue, order?.allowedTradingAssets || []), true]
      : [order?.allowedTradingAssets || [], false];
  }, [searchTradableTokenValue, order?.allowedTradingAssets]);

  if (error) {
    return <div className="text-24 p-5">{t("orders_load_error")}</div>;
  }

  if (loading) {
    return <div className="text-24 p-5">{t("order_loading")}</div>;
  }
  if (!order) {
    return (
      <MarginRecordMissing title={t("order_not_found")} backLabel={t("back_to_lending_orders")} />
    );
  }

  return (
    <div className="py-10">
      <Container>
        <div className="mb-10">
          <Link href="/margin-trading" className="flex items-center gap-1">
            <Svg iconName="back" />
            {t("back_to_lending_orders")}
          </Link>
        </div>

        <h1 className="text-40 font-medium mb-3">{t("lending_order_details")}</h1>

        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="bg-primary-bg rounded-2 flex items-center gap-1 pl-5 pr-4 py-1 min-h-12 text-tertiary-text">
            {t("owner")}:{" "}
            <ExternalTextLink
              text={truncateMiddle(order.owner, { charsFromEnd: 6, charsFromStart: 6 })}
              href={getExplorerLink(ExplorerLinkType.ADDRESS, order.owner, chainId)}
            />
          </div>
          <div className="bg-primary-bg rounded-2 flex items-center gap-1 px-5 py-1 min-h-12 text-tertiary-text">
            {t("lending_order_id")}: <span className="text-secondary-text">{id}</span>
          </div>
        </div>

        <div className="py-5 px-10 bg-primary-bg rounded-5 mb-5">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <Image width={32} height={32} src="/images/tokens/placeholder.svg" alt="" />
              <span className="text-secondary-text text-18 font-bold">{order.baseAsset.name}</span>
              {order.alive ? (
                <div className="flex items-center gap-3 text-green">
                  {t("status_active")}
                  <div className="w-2 h-2 rounded-full bg-green"></div>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-tertiary-text">
                  {t("status_closed")}
                  <Svg iconName="closed" />
                </div>
              )}
            </div>

            {isOwner ? (
              <div className="flex items-center gap-3">
                {order.alive ? (
                  <Button
                    onClick={() => setIsCloseDialogOpened(true)}
                    colorScheme={ButtonColor.LIGHT_GREEN}
                  >
                    {t("close")}
                  </Button>
                ) : (
                  <Button
                    onClick={() => setIsOpenDialogOpened(true)}
                    colorScheme={ButtonColor.LIGHT_GREEN}
                  >
                    {t("open")}
                  </Button>
                )}
                <Link href={`/margin-trading/lending-order/${order.id}/edit`}>
                  <Button>{t("edit")}</Button>
                </Link>
              </div>
            ) : (
              <>
                {order.alive && (
                  <div className="flex items-center gap-3">
                    <Link
                      className={
                        order.balance < order.minLoan ||
                        requestTimeRef.current / 1000 > order.deadline ||
                        order.allowedTradingAssets.length === 0
                          ? "pointer-events-none"
                          : ""
                      }
                      href={`/margin-trading/lending-order/${order.id}/borrow`}
                    >
                      <Button
                        disabled={
                          order.balance < order.minLoan ||
                          requestTimeRef.current / 1000 > order.deadline ||
                          order.allowedTradingAssets.length === 0
                        }
                      >
                        {t("borrow")}
                      </Button>
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <GradientCard
              gradient={CardGradient.BLUE_LIGHT}
              className="flex px-5 py-3 justify-between "
            >
              <div className="">
                <div className="items-center flex gap-1 text-tertiary-text">
                  {t("available_balance")}
                  <Tooltip text={t("available_balance_tooltip")} />
                </div>

                <p className="font-medium text-20">
                  {formatFloat(formatUnits(order.balance, order.baseAsset.decimals ?? 18))}{" "}
                  <span className="text-secondary-text">{order.baseAsset.symbol}</span>
                </p>
              </div>
              {isOwner && (
                <div className="flex items-center gap-3">
                  <Button
                    disabled={!order.alive}
                    onClick={() => setIsDepositDialogOpened(true)}
                    className="border-green disabled:bg-green-bg disabled:opacity-50"
                    colorScheme={ButtonColor.LIGHT_GREEN}
                  >
                    {t("deposit")}
                  </Button>
                  <Button
                    disabled={!order.alive}
                    onClick={() => setIsWithdrawDialogOpened(true)}
                    className="border-green disabled:bg-green-bg disabled:opacity-50"
                    colorScheme={ButtonColor.LIGHT_GREEN}
                  >
                    {t("withdraw")}
                  </Button>
                </div>
              )}
            </GradientCard>
            {isOwner ? (
              <GradientCard className=" px-5 py-3 ">
                <div className="">
                  <div className="items-center flex gap-1 text-tertiary-text">
                    {t("total_balance")}
                    <Tooltip text={t("total_balance_tooltip")} />
                  </div>

                  <p className="font-medium text-20">
                    {formatFloat(
                      formatUnits(calculateTotalOrderBalance(order), order.baseAsset.decimals),
                    )}{" "}
                    <span className="text-secondary-text">{order.baseAsset.symbol}</span>
                  </p>
                </div>
              </GradientCard>
            ) : (
              <GradientCard className=" px-5 py-3 ">
                <div className="">
                  <div className="items-center flex gap-1 text-tertiary-text">
                    {t("min_borrowing")}
                    <Tooltip text={t("min_borrowing_page_tooltip")} />
                  </div>

                  <p className="font-medium text-20">
                    {formatUnits(order.minLoan, order.baseAsset.decimals)}{" "}
                    <span className="text-secondary-text">{order.baseAsset.symbol}</span>
                  </p>
                </div>
              </GradientCard>
            )}
          </div>
        </div>

        <div className="bg-primary-bg rounded-5 mb-5 py-3 px-10 flex items-center justify-between">
          <div>
            <div className="items-center flex gap-1 text-tertiary-text">
              {t("positions_count_label")}
              <Tooltip text={t("positions_count_tooltip")} />
            </div>
            <span className="text-20">
              {t("margin_positions_count", { count: order.positions?.length ?? 0 })}
            </span>
          </div>
          {!!order.positions?.length && (
            <Button
              colorScheme={ButtonColor.LIGHT_GREEN}
              endIcon="next"
              onClick={() =>
                document.getElementById("margin-positions")?.scrollIntoView({ block: "start" })
              }
            >
              {t("view_margin_positions")}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 rounded-5 gap-x-5 gap-y-4 bg-primary-bg px-10 pt-4 pb-5 mb-5">
          <OrderInfoBlock
            title={t("interest_rate")}
            cards={[
              {
                title: t("per_month"),
                tooltipText: t("interest_rate_tooltip"),
                value: `${order.interestRate / 100}%`,
                bg: "percentage",
              },
              {
                title: t("per_entire_period"),
                tooltipText: t("interest_entire_tooltip"),
                value: calculatePeriodInterestRate(order.interestRate, order.positionDuration),
                bg: "percentage",
              },
            ]}
          />
          <OrderInfoBlock
            cards={[
              {
                title: t("margin_positions_duration"),
                tooltipText: t("position_duration_tooltip"),
                value: t("duration_days", {
                  count: formatFloat(order.positionDuration / 24 / 60 / 60),
                }),
                bg: "margin_positions_duration",
              },
              {
                title: t("order_deadline"),
                tooltipText: t("order_deadline_tooltip"),
                value: timestampToDateString(order.deadline, { withUTC: false }),
                bg: "deadline",
              },
            ]}
            title={t("time_frame")}
          />
          <OrderInfoBlock
            cards={[
              {
                title: t("max_leverage"),
                tooltipText: t("leverage_page_tooltip"),
                value: `${order.leverage}x`,
                bg: "leverage",
              },
              {
                title: t("ltv"),
                tooltipText: t("ltv_tooltip"),
                value: order.leverage > 0 ? `${formatFloat((1 - 1 / order.leverage) * 100)}%` : "—",
                bg: "ltv",
              },
            ]}
            title={t("financial_metrics")}
          />
          <OrderInfoBlock
            cards={[
              {
                title: t("liquidation_fee"),
                tooltipText: t("liquidation_fee_tooltip"),
                value: `${formatFloat(order.liquidationRewardAmount.formatted)} ${order.liquidationRewardAsset.symbol}`,
                bg: "liquidation_fee",
              },
              {
                title: t("order_currency_limit"),
                tooltipText: t("currency_limit_page_tooltip"),
                value: t("currencies_count", { count: order.currencyLimit }),
                bg: "currency",
              },
            ]}
            title={t("fee_and_currency_limit")}
          />
        </div>

        <div className="bg-primary-bg rounded-5 px-10 pt-4 pb-5 flex flex-col gap-3 mb-5">
          <h3 className="text-20 text-secondary-text font-medium">{t("trading_and_collateral")}</h3>

          <div className="bg-tertiary-bg rounded-3 pl-5 pb-5 pt-2 bg-[url(/images/card-bg/collateral.svg)] bg-[length:120px_80px] bg-right-top bg-no-repeat">
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-tertiary-text flex items-center gap-1">
                    {t("accepted_collateral")}
                    <Tooltip text={t("accepted_collateral_tooltip")} />
                  </h3>
                  <span className="text-20 font-medium">
                    {t("listing_tokens_count", { count: order.allowedCollateralAssets.length })}
                  </span>
                </div>
                <div className="flex gap-1">
                  {order.allowedCollateralAssets.map((collateralToken) => {
                    return collateralToken.isToken ? (
                      <button
                        key={collateralToken.wrapped.address0}
                        onClick={() =>
                          setTokenForPortfolio(
                            new Token(
                              chainId,
                              collateralToken.address0,
                              collateralToken.address1,
                              +collateralToken.decimals,
                              collateralToken.symbol,
                              collateralToken.name,
                              "/images/tokens/placeholder.svg",
                              tokenLists
                                ?.filter((tokenList) => {
                                  return !!tokenList.list.tokens.find(
                                    (t) =>
                                      t.address0.toLowerCase() ===
                                      collateralToken.address0.toLowerCase(),
                                  );
                                })
                                .map((t) => t.id),
                            ),
                          )
                        }
                        className="bg-quaternary-bg text-secondary-text px-2 py-1 rounded-2 hocus:bg-green-bg duration-200"
                      >
                        {collateralToken.symbol}
                      </button>
                    ) : (
                      <div
                        key={collateralToken.wrapped.address0}
                        className="rounded-2 text-secondary-text border border-secondary-border px-2 flex items-center py-1"
                      >
                        {collateralToken.symbol}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-tertiary-bg rounded-3 px-5 pb-5 pt-2">
            <div className="flex justify-between mb-3">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-tertiary-text flex items-center gap-1">
                  {t("tokens_allowed_trading")}
                  <Tooltip text={t("tokens_allowed_tooltip")} />
                </h3>
                <span className="text-20 font-medium">
                  {t("listing_tokens_count", { count: order.allowedTradingAssets.length })}
                </span>
              </div>
              <div>
                <SearchInput
                  value={searchTradableTokenValue}
                  onChange={(e) => setSearchTradableTokenValue(e.target.value)}
                  placeholder={t("token_name")}
                  className="bg-primary-bg"
                />
              </div>
            </div>

            {!!filteredTokens.length && (
              <SimpleBar style={{ maxHeight: 216 }}>
                <div className="flex gap-1 flex-wrap">
                  {filteredTokens.map((tradingToken) => {
                    return tradingToken.isToken ? (
                      <button
                        key={tradingToken.address0}
                        onClick={() =>
                          setTokenForPortfolio(
                            new Token(
                              chainId,
                              tradingToken.address0,
                              tradingToken.address1,
                              +tradingToken.decimals,
                              tradingToken.symbol,
                              tradingToken.name,
                              "/images/tokens/placeholder.svg",
                              tokenLists
                                ?.filter((tokenList) => {
                                  return !!tokenList.list.tokens.find(
                                    (t) =>
                                      t.address0.toLowerCase() ===
                                      tradingToken.address0.toLowerCase(),
                                  );
                                })
                                .map((t) => t.id),
                            ),
                          )
                        }
                        className="bg-quaternary-bg text-secondary-text px-2 py-1 rounded-2 hocus:bg-green-bg duration-200"
                      >
                        {tradingToken.symbol}
                      </button>
                    ) : (
                      <div
                        key={tradingToken.wrapped.address0}
                        className="rounded-2 text-secondary-text border border-secondary-border px-2 flex items-center py-1"
                      >
                        {tradingToken.symbol}
                      </div>
                    );
                  })}
                </div>
              </SimpleBar>
            )}
            {!filteredTokens.length && searchTradableTokenValue && (
              <div className="rounded-5 h-[232px] -mt-5 flex items-center justify-center text-secondary-text bg-empty-not-found-token bg-no-repeat bg-right-top bg-[length:212px_212px] -mr-5">
                {t("token_not_found")}
              </div>
            )}
          </div>
        </div>

        <div className=" bg-primary-bg rounded-5 px-10 pt-4 pb-5 mb-5 flex flex-col gap-3">
          <h3 className="text-20 text-secondary-text font-medium">{t("liquidation_details")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <OrderInfoCard
              value={
                <ExternalTextLink
                  text={t("dex223_market")}
                  href={getExplorerLink(ExplorerLinkType.ADDRESS, ORACLE_ADDRESS[chainId], chainId)}
                />
              }
              title={t("liquidation_price_source")}
              bg="liquidation_price_source"
              tooltipText={t("liquidation_price_tooltip")}
            />
            <OrderInfoCard
              value={t("anyone")}
              title={t("initiate_liquidation")}
              bg="initiate_liquidation"
              tooltipText={t("initiate_liquidation_tooltip")}
            />
          </div>
        </div>

        {!!order.positions?.length && (
          <>
            <h2 id="margin-positions" className="text-32 text-secondary-text font-medium mb-5">
              {t("margin_positions")}
            </h2>
            <div className="grid gap-5">
              {!!order.positions?.length &&
                order.positions.map((position, index) => (
                  <React.Fragment key={position.id}>
                    {position.isLiquidated || position.isClosed ? (
                      <InactiveMarginPositionCard
                        key={position.id}
                        position={{ ...position, order }}
                      />
                    ) : (
                      <LendingPositionCard position={{ ...position, order }} />
                    )}
                  </React.Fragment>
                ))}
            </div>
          </>
        )}
      </Container>

      <OrderDepositDialog
        isOpen={isDepositDialogOpened}
        setIsOpen={setIsDepositDialogOpened}
        order={order}
      />
      <OrderWithdrawDialog
        isOpen={isWithdrawDialogOpened}
        setIsOpen={setIsWithdrawDialogOpened}
        order={order}
      />
      <OrderCloseDialog
        isOpen={isCloseDialogOpened}
        setIsOpen={setIsCloseDialogOpened}
        order={order}
      />
      <OrderOpenDialog
        isOpen={isOpenDialogOpened}
        setIsOpen={setIsOpenDialogOpened}
        order={order}
      />
      <DrawerDialog isOpen={!!tokenForPortfolio} setIsOpen={() => setTokenForPortfolio(null)}>
        <DialogHeader
          onClose={() => setTokenForPortfolio(null)}
          title={tokenForPortfolio?.name || t("unknown")}
        />
        {tokenForPortfolio ? <TokenPortfolioDialogContent token={tokenForPortfolio} /> : null}
      </DrawerDialog>
    </div>
  );
}
