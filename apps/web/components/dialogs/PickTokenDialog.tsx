import Alert from "@repo/ui/alert";
import Checkbox from "@repo/ui/checkbox";
import ExternalTextLink from "@repo/ui/external-text-link";
import Preloader from "@repo/ui/preloader";
import Tooltip from "@repo/ui/tooltip";
import { useVirtualizer } from "@tanstack/react-virtual";
import clsx from "clsx";
import Image from "next/image";
import { useTranslations } from "next-intl";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useMediaQuery } from "react-responsive";
import { Address, formatUnits, isAddress } from "viem";
import { useAccount } from "wagmi";

import DialogHeader from "@/components/atoms/DialogHeader";
import DrawerDialog from "@/components/atoms/DrawerDialog";
import { SearchInput } from "@/components/atoms/Input";
import ScrollbarContainer from "@/components/atoms/ScrollbarContainer";
import Svg from "@/components/atoms/Svg";
import Badge, { BadgeVariant } from "@/components/badges/Badge";
import { Check, rateToScore, TrustMarker, TrustRateCheck } from "@/components/badges/TrustBadge";
import Button, { ButtonSize } from "@/components/buttons/Button";
import IconButton, { IconButtonSize, IconButtonVariant } from "@/components/buttons/IconButton";
import { TokenPortfolioDialogContent } from "@/components/dialogs/TokenPortfolioDialog";
import { addCustomToken } from "@/db/addCustomToken";
import { clsxMerge } from "@/functions/clsxMerge";
import { formatFloat } from "@/functions/formatFloat";
import getExplorerLink, { ExplorerLinkType } from "@/functions/getExplorerLink";
import { filterTokens } from "@/functions/searchTokens";
import truncateMiddle from "@/functions/truncateMiddle";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import useDerivedTokenInfo from "@/hooks/useDerivedTokenInfo";
import { useErc777Addresses } from "@/hooks/useErc777";
import useTokenBalances from "@/hooks/useTokenBalances";
import { useTokens } from "@/hooks/useTokenLists";
import { useUSDPrice } from "@/hooks/useUSDPrice";
import addToast from "@/other/toast";
import { Currency } from "@/sdk_bi/entities/currency";
import { Token } from "@/sdk_bi/entities/token";
import { Standard } from "@/sdk_bi/standard";
import { useManageTokensDialogStore } from "@/stores/useManageTokensDialogStore";
import { usePinnedTokensStore } from "@/stores/usePinnedTokensStore";

// With a mouse or trackpad, put the caret in the token search as soon as the picker opens so
// users can type a symbol straight away. Touch devices skip this so the on-screen keyboard does
// not cover the list. Waiting two frames lets the dialog's focus manager first record the
// element to return focus to on close, and run its own initial focus, before we move it.
function focusSearchOnOpen(node: HTMLDivElement | null) {
  if (!node || !window.matchMedia("(pointer: fine)").matches) return;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => node.querySelector<HTMLInputElement>("input")?.focus()),
  );
}

interface Props {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  handlePick: (token: Currency) => void;
  simpleForm?: boolean;
  prevToken?: Currency | null;
  availableTokens?: Currency[];
}

function FoundInOtherListMarker() {
  return (
    <Tooltip
      text="There is a token with a same name but different address"
      renderTrigger={(ref, refProps) => {
        return (
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-full p-0.5 bg-primary-bg group-hocus:bg-tertiary-bg duration-200"
            ref={ref.setReference}
            {...refProps}
          >
            <div className="rounded-full p-0.5 flex items-center gap-1 cursor-pointer text-12 text-orange bg-orange-bg">
              <Svg size={20} iconName="duplicate-found" />
            </div>
          </div>
        );
      }}
    />
  );
}

function Erc777Badge() {
  const t = useTranslations("ManageTokens");

  return (
    <Tooltip
      text={t("erc777_tooltip")}
      renderTrigger={(ref, refProps) => (
        <span ref={ref.setReference} {...refProps} className="flex">
          <Badge size="small" variant={BadgeVariant.COLORED} color="red" text="ERC-777" />
        </span>
      )}
    />
  );
}

function TokenRow({
  currency,
  handlePick,
  setTokenForPortfolio,
  unsupported = false,
}: {
  currency: Currency;
  handlePick: (currency: Currency) => void;
  setTokenForPortfolio: (currency: Currency) => void;
  unsupported?: boolean;
}) {
  const t = useTranslations("ManageTokens");
  const { isConnected } = useAccount();

  const { toggleToken, isTokenPinned, pinnedTokens } = usePinnedTokensStore((s) => ({
    toggleToken: s.toggleToken,
    pinnedTokens: s.tokens,
    isTokenPinned: s.tokens[currency.chainId]?.includes(
      currency.isNative ? "native" : currency.address0,
    ),
  }));

  const {
    balance: { erc20Balance, erc223Balance },
  } = useTokenBalances(isTokenPinned ? currency : undefined);

  const scoreObj = useMemo((): [number, boolean] | undefined => {
    if (currency.isToken && currency.rate) {
      return [
        rateToScore(currency.rate),
        currency.rate[Check.SAME_NAME_IN_OTHER_LIST] === TrustRateCheck.TRUE,
      ];
    }

    return;
  }, [currency]);

  const { price } = useUSDPrice(isTokenPinned ? currency.wrapped.address0 : undefined);

  const totalBalance = useMemo(() => {
    if (currency.isNative) {
      return erc20Balance?.formatted || "0";
    }

    if (!currency || !erc20Balance || !erc223Balance) {
      return "0";
    }

    return formatFloat(formatUnits(erc20Balance?.value + erc223Balance.value, currency.decimals));
  }, [erc20Balance, erc223Balance, currency]);

  const totalUSDBalance = useMemo(() => {
    if (!isTokenPinned || !isConnected || !price || !totalBalance) {
      return null;
    }

    return price * +totalBalance;
  }, [isConnected, isTokenPinned, price, totalBalance]);

  return (
    <div
      role="button"
      aria-disabled={unsupported}
      onClick={() => handlePick(currency)}
      className={clsx(
        "rounded-2 flex items-center flex-wrap md:block md:rounded-0 pl-3 pr-1.5 md:pl-10 md:pr-4 bg-tertiary-bg md:bg-transparent hocus:bg-tertiary-bg duration-200 group pt-1.5 md:pt-0 pb-1.5 md:pb-2 w-full text-left",
        unsupported && "opacity-70 cursor-not-allowed",
      )}
    >
      <div className="grid grid-cols-[40px_1fr] gap-2 w-full">
        <div className="flex items-center md:pt-3">
          <Image
            width={40}
            height={40}
            src={
              currency?.logoURI !== "/tokens/placeholder.svg"
                ? currency?.logoURI || ""
                : "/images/tokens/placeholder.svg"
            }
            alt=""
          />
        </div>
        <div className="w-full">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center md:gap-x-2 flex-wrap">
              <div className="flex items-center w-[120px] md:gap-2 md:w-[256px]">
                <span className="whitespace-nowrap overflow-ellipsis overflow-hidden">
                  {currency.name}
                </span>
                <div className="flex relative items-center">
                  {scoreObj && (
                    <>
                      {scoreObj[0] < 20 && (
                        <>
                          {currency.isToken && currency.rate && (
                            <TrustMarker rate={currency?.rate} totalScore={scoreObj[0]} />
                          )}
                        </>
                      )}
                      {scoreObj[1] && (
                        <div className={scoreObj[0] < 20 ? "-ml-2.5" : ""}>
                          <FoundInOtherListMarker />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {totalUSDBalance ? (
                <span className="block w-full text-primary-text text-12 md:hidden">
                  ${formatFloat(totalUSDBalance)}
                </span>
              ) : (
                <span className="w-full ">
                  <span className="w-[100px] whitespace-nowrap overflow-hidden overflow-ellipsis block text-secondary-text text-12  md:hidden">
                    {currency.symbol}
                  </span>
                </span>
              )}
            </div>

            <div className={clsx("items-center gap-1", unsupported ? "hidden" : "flex")}>
              {totalUSDBalance ? (
                <span className="text-primary-text text-12 hidden md:inline pr-2.5">
                  ${formatFloat(totalUSDBalance)}
                </span>
              ) : null}
              {currency.isToken ? (
                <Tooltip
                  text={`Token belongs to ${currency.lists?.length || 1} token lists`}
                  renderTrigger={(ref, refProps) => {
                    return (
                      <span
                        onClick={(e) => e.stopPropagation()}
                        ref={ref.setReference}
                        {...refProps}
                        className="flex gap-0.5 items-center text-secondary-text text-14 cursor-pointer w-10"
                      >
                        {currency.lists?.length || 1}
                        <Svg className="text-tertiary-text" iconName="list" />
                      </span>
                    );
                  }}
                />
              ) : (
                <span className="block w-10" />
              )}
              {currency.isToken ? (
                <IconButton
                  iconName="details"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTokenForPortfolio(currency);
                  }}
                />
              ) : (
                <span className="block w-10" />
              )}
              <IconButton
                iconName={isTokenPinned ? "pin-fill" : "pin"}
                onClick={(e) => {
                  e.stopPropagation();
                  if (pinnedTokens[currency.chainId]?.length < 8 || isTokenPinned) {
                    toggleToken(currency.isNative ? "native" : currency.address0, currency.chainId);
                  } else {
                    addToast("Pinning limit reached: 8 tokens", "info");
                  }
                }}
                active={isTokenPinned}
              />
            </div>
            {unsupported && (
              <span className="text-red-light text-14 pr-2.5">{t("unsupported")}</span>
            )}
          </div>

          <div className="auto-cols-fr grid-flow-col gap-2 hidden md:grid min-h-4">
            {unsupported ? (
              <span className="flex items-center gap-1">
                <Erc777Badge />
                <span className="text-secondary-text text-12">{currency.symbol}</span>
              </span>
            ) : (
              (!isTokenPinned || (!erc20Balance && !erc223Balance)) && (
                <span className="text-secondary-text text-12">{currency.symbol}</span>
              )
            )}
            {erc20Balance && currency.isNative && (
              <div className="flex items-center gap-1">
                <Badge size="small" variant={BadgeVariant.COLORED} text="Native" />
                <span className="text-secondary-text text-12">
                  {formatFloat(erc20Balance?.formatted)} {currency.symbol}
                </span>
              </div>
            )}
            {erc20Balance && !currency.isNative && (
              <div className="flex items-center gap-1">
                <Badge size="small" variant={BadgeVariant.STANDARD} standard={Standard.ERC20} />
                <span className="text-secondary-text text-12">
                  {formatFloat(erc20Balance?.formatted)} {currency.symbol}
                </span>
              </div>
            )}
            {erc223Balance && !currency.isNative && (
              <div className="flex items-center gap-1">
                <Badge size="small" variant={BadgeVariant.STANDARD} standard={Standard.ERC223} />
                <span className="text-secondary-text text-12">
                  {formatFloat(erc223Balance?.formatted)} {currency.symbol}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="auto-cols-fr grid grid-flow-col gap-2 md:hidden mt-1">
        {unsupported && <Erc777Badge />}
        {erc20Balance && currency.isNative && (
          <div className="flex items-center gap-1">
            <Badge size="small" variant={BadgeVariant.COLORED} text="Native" />
            <span className="text-secondary-text text-12">
              {formatFloat(erc20Balance?.formatted)} {currency.symbol}
            </span>
          </div>
        )}
        {erc20Balance && !currency.isNative && (
          <div className="flex items-center gap-1">
            <Badge size="small" variant={BadgeVariant.STANDARD} standard={Standard.ERC20} />
            <span className="text-secondary-text text-12">
              {formatFloat(erc20Balance?.formatted)} {currency.symbol}
            </span>
          </div>
        )}
        {erc223Balance && !currency.isNative && (
          <div className="flex items-center gap-1">
            <Badge size="small" variant={BadgeVariant.STANDARD} standard={Standard.ERC223} />
            <span className="text-secondary-text text-12">
              {formatFloat(erc223Balance?.formatted)} {currency.symbol}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function TokenRowSimple({
  currency,
  handlePick,
  setTokenForPortfolio,
  isMobile,
  prevToken,
  unsupported = false,
}: {
  currency: Currency;
  handlePick: (currency: Currency) => void;
  setTokenForPortfolio: (currency: Currency) => void;
  isMobile: boolean;
  prevToken: Currency | null;
  unsupported?: boolean;
}) {
  return (
    <div
      role="button"
      aria-disabled={unsupported}
      onClick={() => handlePick(currency)}
      className={clsx(
        "rounded-2 flex items-center flex-wrap md:block md:rounded-0 pl-3 pr-1.5 md:pl-10 md:pr-7 bg-transparent hocus:bg-tertiary-bg duration-200 group py-1 md:py-2 w-full text-left",
        unsupported && "opacity-70 cursor-not-allowed",
      )}
    >
      <div className="grid md:grid-cols-[40px_1fr] grid-cols-[32px_1fr] gap-2 w-full">
        <div className="flex items-center">
          <Image
            width={isMobile ? 32 : 40}
            height={isMobile ? 32 : 40}
            src={
              currency?.logoURI !== "/tokens/placeholder.svg"
                ? currency?.logoURI || ""
                : "/images/tokens/placeholder.svg"
            }
            alt=""
          />
        </div>
        <div className="w-full pl-1 md:pl-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center md:gap-x-2 flex-wrap">
              <div className="flex items-center w-[120px] md:gap-2 md:w-[256px]">
                <span className="whitespace-nowrap overflow-ellipsis overflow-hidden">
                  {currency.name}
                </span>
                {unsupported && <Erc777Badge />}
              </div>

              <span className="w-full ">
                <span className="w-[100px] whitespace-nowrap overflow-hidden overflow-ellipsis block text-secondary-text text-12  md:text-14">
                  {currency.symbol}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-1">
              <span className="block w-10" />
              {prevToken && prevToken.name === currency.name && (
                <Svg iconName="check" className="text-green mr-1.5" />
              )}
              {currency.isToken ? (
                <IconButton
                  iconName="details"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTokenForPortfolio(currency);
                  }}
                />
              ) : (
                <span className="block w-10" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PickTokenDialog({
  isOpen,
  setIsOpen,
  handlePick,
  simpleForm = false,
  prevToken = null,
  availableTokens,
}: Props) {
  return (
    <DrawerDialog isOpen={isOpen} setIsOpen={setIsOpen}>
      <PickTokenDialogContent
        handlePick={handlePick}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        availableTokens={availableTokens}
        prevToken={prevToken}
        simpleForm={simpleForm}
      />
    </DrawerDialog>
  );
}

function PickTokenDialogContent({
  setIsOpen,
  handlePick: handlePickToken,
  simpleForm = false,
  prevToken = null,
  availableTokens,
}: Props) {
  const currencies = useTokens();
  const tokens = availableTokens || currencies;
  const t = useTranslations("ManageTokens");
  const chainId = useCurrentChainId();
  const { tokens: pinnedTokensAddresses, toggleToken } = usePinnedTokensStore();
  const parentRef = React.useRef(null);

  const pinnedTokens = useMemo(() => {
    const lookupMap: Map<"native" | Address, Currency> = new Map(
      tokens.map((token) => [token.isNative ? "native" : token.address0, token]),
    );

    return pinnedTokensAddresses[chainId]?.map((id) => lookupMap.get(id)) || [];
  }, [chainId, pinnedTokensAddresses, tokens]);

  const [tokenForPortfolio, setTokenForPortfolio] = useState<Currency | null>(null);
  const [isEditActivated, setEditActivated] = useState<boolean>(false);
  const { setIsOpen: setManageOpened } = useManageTokensDialogStore();

  const [tokensSearchValue, setTokensSearchValue] = useState("");

  const [filteredTokens, isTokenFilterActive] = useMemo(() => {
    return tokensSearchValue ? [filterTokens(tokensSearchValue, tokens), true] : [tokens, false];
  }, [tokens, tokensSearchValue]);

  const {
    token: derivedToken,
    isErc777,
    isLoading,
  } = useDerivedTokenInfo({
    tokenAddressToImport: tokensSearchValue as Address,
    enabled: !!tokensSearchValue && isAddress(tokensSearchValue) && filteredTokens.length === 0,
  });

  const virtualizer = useVirtualizer({
    count: filteredTokens.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
  });
  const items = virtualizer.getVirtualItems();

  // Check the rows on screen and the pinned chips for ERC-777, which the converter does not support.
  const erc777Candidates = useMemo(
    () =>
      [...items.map((item) => filteredTokens[item.index]), ...pinnedTokens]
        .filter((c): c is Token => !!c && c.isToken)
        .map((c) => c.address0),
    [filteredTokens, items, pinnedTokens],
  );
  const erc777Addresses = useErc777Addresses(erc777Candidates);
  const isUnsupported = useCallback(
    (currency: Currency) =>
      currency.isToken && erc777Addresses.has(currency.address0.toLowerCase()),
    [erc777Addresses],
  );
  const handlePick = useCallback(
    (currency: Currency) => {
      if (!isUnsupported(currency)) handlePickToken(currency);
    },
    [handlePickToken, isUnsupported],
  );

  const minYPadding = useMemo(() => (pinnedTokens?.length ? 8 : 0), [pinnedTokens]);

  const [paddingTop, paddingBottom] = useMemo(() => {
    return items.length > 0
      ? [
          Math.max(minYPadding, items[0].start),
          Math.max(8, virtualizer.getTotalSize() - items[items.length - 1].end),
        ]
      : [minYPadding, 8];
  }, [items, minYPadding, virtualizer]);

  const isMobile = useMediaQuery({ query: "(max-width: 767px)" });

  useEffect(() => {
    if (!isMobile || !pinnedTokens.length) {
      setEditActivated(false);
    }
  }, [isMobile, pinnedTokens.length]);
  const [checkedUnderstand, setCheckedUnderstand] = useState<boolean>(false);
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => {
      setTokenForPortfolio(null);
    }, 400);
  }, [setIsOpen]);

  return (
    <>
      {tokenForPortfolio ? (
        <>
          <DialogHeader
            onClose={handleClose}
            onBack={() => {
              setTokenForPortfolio(null);
            }}
            title={tokenForPortfolio.name || "Unknown"}
          />
          {tokenForPortfolio.isToken && (
            <TokenPortfolioDialogContent
              onManageListAction={() => setIsOpen(false)}
              token={tokenForPortfolio}
            />
          )}
        </>
      ) : (
        <>
          <DialogHeader onClose={handleClose} title={t("select_token")} />

          {Boolean(tokens.length) && (
            <>
              <div className="w-full sm:w-[600px] max-h-[580px] h-[calc(100dvh-60px)] flex flex-col">
                <div
                  ref={focusSearchOnOpen}
                  className={clsx("card-spacing-x", (!pinnedTokens.length || simpleForm) && "pb-3")}
                >
                  <SearchInput
                    value={tokensSearchValue}
                    onChange={(e) => setTokensSearchValue(e.target.value)}
                    placeholder={t("search_name_or_paste_address")}
                  />
                  <div
                    className={clsx(
                      "flex flex-wrap gap-2 md:gap-3",
                      !!pinnedTokens.length &&
                        !simpleForm &&
                        "border-b border-secondary-border pb-3 mt-3",
                    )}
                  >
                    {!simpleForm &&
                      pinnedTokens.map((pinnedToken) => {
                        if (!pinnedToken) {
                          return;
                        }

                        return (
                          <div
                            key={
                              pinnedToken.isToken
                                ? pinnedToken.address0
                                : `native-${pinnedToken.wrapped.address0}`
                            }
                            className="group relative"
                          >
                            <button
                              onClick={() => {
                                if (isMobile && isEditActivated) {
                                  toggleToken(
                                    pinnedToken.isNative ? "native" : pinnedToken.address0,
                                    pinnedToken.chainId,
                                  );
                                } else {
                                  handlePick(pinnedToken);
                                }
                              }}
                              className={clsx(
                                isEditActivated
                                  ? "bg-transparent border-secondary-border"
                                  : "bg-tertiary-bg border-transparent",
                                "items-center border justify-center px-4 duration-200 h-10 rounded-2 flex gap-2",
                                !isMobile && isEditActivated && "hocus:bg-transparent",
                                !isMobile && !isEditActivated && "hocus:bg-green-bg",
                              )}
                            >
                              <Image
                                width={24}
                                height={24}
                                src={pinnedToken.logoURI || "/images/tokens/placeholder.svg"}
                                alt=""
                              />
                              {pinnedToken.symbol}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleToken(
                                  pinnedToken.isNative ? "native" : pinnedToken.address0,
                                  pinnedToken.chainId,
                                );
                              }}
                              className={clsxMerge(
                                "opacity-0 duration-200 flex absolute w-5 h-5 items-center justify-center bg-quaternary-bg rounded-full text-secondary-text  -right-1 -top-1",
                                isEditActivated && "opacity-100",
                                !isMobile &&
                                  "group-hocus:opacity-100 hocus:opacity-100 hocus:text-primary-text",
                              )}
                            >
                              <Svg size={16} iconName="close" />
                            </button>
                          </div>
                        );
                      })}
                    {!!pinnedTokens.length && !simpleForm && (
                      <span className="md:hidden">
                        <button
                          className={clsx(
                            "w-10 h-10 rounded-2 flex items-center justify-center",
                            isEditActivated ? "bg-green-bg-hover" : "bg-tertiary-bg",
                          )}
                          onClick={() => {
                            setEditActivated(!isEditActivated);
                          }}
                        >
                          <Svg iconName="edit" size={20} />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
                {Boolean(filteredTokens.length) && (
                  <div
                    className={clsxMerge(
                      "flex-grow flex min-h-0",
                      simpleForm && "overflow-hidden md:pb-5",
                    )}
                  >
                    <ScrollbarContainer
                      scrollableNodeProps={{
                        ref: parentRef,
                      }}
                      height="full"
                    >
                      <div
                        className={clsx(
                          "flex flex-col gap-2 md:gap-0 pl-4 md:pl-0 pr-4 md:pr-[11px] pb-2",
                          !!pinnedTokens.length && !simpleForm && "pt-3",
                          simpleForm ? "pl-2 pr-3" : "pl-4 pr-4",
                        )}
                        style={{
                          paddingTop,
                          paddingBottom,
                        }}
                      >
                        {simpleForm
                          ? items.map((item) => {
                              const token = filteredTokens[item.index];
                              // if (simpleForm)
                              return (
                                <TokenRowSimple
                                  setTokenForPortfolio={setTokenForPortfolio}
                                  handlePick={handlePick}
                                  key={
                                    token.isToken
                                      ? token.address0
                                      : `native-${token.wrapped.address0}`
                                  }
                                  currency={token}
                                  isMobile={isMobile}
                                  prevToken={prevToken}
                                  unsupported={isUnsupported(token)}
                                />
                              );
                            })
                          : items.map((item) => {
                              const token = filteredTokens[item.index];

                              return (
                                <TokenRow
                                  setTokenForPortfolio={setTokenForPortfolio}
                                  handlePick={handlePick}
                                  key={
                                    token.isToken
                                      ? token.address0
                                      : `native-${token.wrapped.address0}`
                                  }
                                  currency={token}
                                  unsupported={isUnsupported(token)}
                                />
                              );
                            })}
                      </div>
                    </ScrollbarContainer>
                  </div>
                )}
                {Boolean(!filteredTokens.length && isTokenFilterActive) && derivedToken && (
                  <div className="card-spacing-x flex-grow ">
                    <div className="flex-grow">
                      <div className="flex items-center gap-3 pb-2.5 mt-0.5 mb-3">
                        <img
                          className="w-12 h-12"
                          width={48}
                          height={48}
                          src="/images/tokens/placeholder.svg"
                          alt=""
                        />
                        <div className="flex flex-col text-16">
                          <span className="text-primary-text">{derivedToken.symbol}</span>
                          <span className="text-secondary-text">
                            {derivedToken.name} (
                            {t("decimals_amount", { decimals: derivedToken.decimals })})
                          </span>
                        </div>
                      </div>
                      {derivedToken.address0 && derivedToken.address1 && (
                        <>
                          <div className="mb-4 flex flex-col gap-4 pl-5 pr-3 pb-5 pt-4 bg-tertiary-bg rounded-3">
                            <div className="grid grid-cols-[1fr_auto_32px] gap-y-1">
                              <span className="text-secondary-text flex items-center gap-1">
                                {t("address")}{" "}
                                {isErc777 ? (
                                  <Badge
                                    variant={BadgeVariant.COLORED}
                                    color="red"
                                    text="ERC-777"
                                  />
                                ) : (
                                  <Badge
                                    variant={BadgeVariant.STANDARD}
                                    standard={Standard.ERC20}
                                  />
                                )}{" "}
                              </span>
                              <ExternalTextLink
                                text={truncateMiddle(derivedToken.address0)}
                                href={getExplorerLink(
                                  ExplorerLinkType.ADDRESS,
                                  derivedToken.address0,
                                  chainId,
                                )}
                                className="justify-between"
                              />
                              <IconButton
                                variant={IconButtonVariant.COPY}
                                buttonSize={IconButtonSize.SMALL}
                                text={derivedToken.address0}
                              />
                              {!isErc777 && (
                                <>
                                  <span className="text-secondary-text flex items-center gap-1">
                                    {t("address")}{" "}
                                    <Badge
                                      variant={BadgeVariant.STANDARD}
                                      standard={Standard.ERC223}
                                    />
                                  </span>
                                  {derivedToken.address1 && derivedToken.address1 && (
                                    <>
                                      <ExternalTextLink
                                        text={truncateMiddle(derivedToken.address1)}
                                        href={getExplorerLink(
                                          ExplorerLinkType.ADDRESS,
                                          derivedToken.address1,
                                          chainId,
                                        )}
                                        className="justify-between"
                                      />
                                      <IconButton
                                        variant={IconButtonVariant.COPY}
                                        buttonSize={IconButtonSize.SMALL}
                                        text={derivedToken.address1}
                                      />
                                    </>
                                  )}
                                </>
                              )}
                              {/*{erc223AddressToImport && !isErc223Exist && (*/}
                              {/*  <>*/}
                              {/*    <span></span>*/}
                              {/*    <span className="text-tertiary-text text-right flex w-8 items-center justify-center">*/}
                              {/*      —*/}
                              {/*    </span>*/}
                              {/*  </>*/}
                              {/*)}*/}
                            </div>
                          </div>
                        </>
                      )}

                      {isErc777 ? (
                        <Alert text={t("erc777_warning")} type="error" />
                      ) : (
                        <Alert text={t("import_token_warning")} type="warning" />
                      )}
                    </div>

                    <div className="flex flex-col gap-5 mt-5">
                      {!isErc777 && (
                        <Checkbox
                          checked={checkedUnderstand}
                          handleChange={() => setCheckedUnderstand(!checkedUnderstand)}
                          id="approve-list-import"
                          label={t("i_understand")}
                        />
                      )}
                      <Button
                        fullWidth
                        size={ButtonSize.LARGE}
                        disabled={!checkedUnderstand || isErc777}
                        onClick={async () => {
                          if (chainId && derivedToken) {
                            await addCustomToken(derivedToken);
                            addToast(t("imported_successfully"));
                          }
                        }}
                      >
                        {isErc777
                          ? t("token_not_supported")
                          : t("import_symbol", { symbol: derivedToken.symbol })}
                      </Button>
                    </div>
                  </div>
                )}

                {Boolean(!filteredTokens.length && isTokenFilterActive) &&
                  !derivedToken &&
                  !isLoading && (
                    <div
                      className={clsx(
                        "flex items-center justify-center gap-2 flex-col h-full flex-grow w-full bg-empty-not-found-token bg-right-top bg-no-repeat max-md:bg-size-180",
                        !pinnedTokens.length && "-mt-3",
                      )}
                    >
                      <span className="text-secondary-text">{t("token_not_found")}</span>
                    </div>
                  )}

                {isLoading && (
                  <div className="flex items-center justify-center gap-2 flex-col h-full">
                    <Preloader size={80} />
                  </div>
                )}
                {!simpleForm && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      setManageOpened(true);
                    }}
                    className="flex-shrink-0 w-full text-green hocus:text-green-hover rounded-b-0 md:rounded-b-5 border-t border-secondary-border md:border-t-0 flex items-center justify-center gap-2 h-[60px] bg-tertiary-bg hocus:bg-green-bg duration-200"
                  >
                    Manage tokens
                    <Svg iconName="edit" />
                  </button>
                )}
              </div>
            </>
          )}
          {Boolean(!tokens.length) && ( //probably impossible scenario, handling in case user find a way to turn off all token lists or delete all tokens
            <div className="flex items-center justify-center gap-2 flex-col h-full min-h-[520px] w-full md:w-[570px] bg-empty-no-tokens bg-right-top bg-no-repeat max-md:bg-size-180">
              <span className="text-secondary-text">{t("no_tokens_here")}</span>
            </div>
          )}
        </>
      )}
    </>
  );
}
