import Alert from "@repo/ui/alert";
import Checkbox from "@repo/ui/checkbox";
import ExternalTextLink from "@repo/ui/external-text-link";
import Preloader from "@repo/ui/preloader";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslations } from "next-intl";
import React, { useMemo, useState } from "react";
import SimpleBar from "simplebar-react";
import { Address, isAddress } from "viem";

import { SearchInput } from "@/components/atoms/Input";
import Badge, { BadgeVariant } from "@/components/badges/Badge";
import Button, { ButtonSize } from "@/components/buttons/Button";
import IconButton, { IconButtonSize, IconButtonVariant } from "@/components/buttons/IconButton";
import ManageTokenItem from "@/components/manage-tokens/ManageTokenItem";
import { addCustomToken } from "@/db/addCustomToken";
import getExplorerLink, { ExplorerLinkType } from "@/functions/getExplorerLink";
import { filterTokens } from "@/functions/searchTokens";
import truncateMiddle from "@/functions/truncateMiddle";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import useDerivedTokenInfo from "@/hooks/useDerivedTokenInfo";
import { useTokenLists, useTokens } from "@/hooks/useTokenLists";
import addToast from "@/other/toast";
import { Token } from "@/sdk_bi/entities/token";
import { Standard } from "@/sdk_bi/standard";

export default function TokensTab({
  setTokenForPortfolio,
}: {
  setTokenForPortfolio: (token: Token) => void;
}) {
  const t = useTranslations("ManageTokens");

  const [onlyCustom, setOnlyCustom] = useState(false);
  const chainId = useCurrentChainId();

  const tokens = useTokens(onlyCustom);

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

  const parentRef = React.useRef(null);

  const virtualizer = useVirtualizer({
    count: filteredTokens.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
  });
  const items = virtualizer.getVirtualItems();

  const [paddingTop, paddingBottom] =
    items.length > 0
      ? [items[0].start, Math.max(0, virtualizer.getTotalSize() - items[items.length - 1].end)]
      : [0, 0];

  const [checkedUnderstand, setCheckedUnderstand] = useState<boolean>(false);

  const custom = useTokenLists(true);

  const alreadyImported = useMemo(() => {
    return !!(
      custom &&
      custom?.[0]?.list.tokens.find(
        (v) => v.address0.toLowerCase() === tokensSearchValue.toLowerCase(),
      )
    );
  }, [custom, tokensSearchValue]);
  return (
    <div className="flex-grow flex flex-col ">
      <div className="flex gap-3 card-spacing-x">
        <SearchInput
          value={tokensSearchValue}
          onChange={(e) => setTokensSearchValue(e.target.value)}
          placeholder={t("search_name_or_paste_address")}
        />
      </div>

      {!derivedToken && !isTokenFilterActive && (
        <>
          <div className="flex justify-between items-center my-3 card-spacing-x text-secondary-text">
            <div>
              {t("total")}{" "}
              {onlyCustom ? (
                <>{t("custom_tokens_amount", { amount: tokens.length })}</>
              ) : (
                <>{t("tokens_amount", { amount: tokens.length })}</>
              )}
            </div>
            <div>
              <Checkbox
                checked={onlyCustom}
                handleChange={() => setOnlyCustom(!onlyCustom)}
                id="only-custom"
                label={t("only_custom")}
              />
            </div>
          </div>
          <div className="bg-secondary-border h-px mx-4 md:mx-10" />
        </>
      )}

      {Boolean(filteredTokens.length) && (
        <div className="flex flex-col flex-grow card-spacing-x">
          <div style={{ flex: "1 1 auto" }} className="pb-[1px] -mr-3 md:-mr-8">
            <SimpleBar
              scrollableNodeProps={{
                ref: parentRef,
              }}
              className="pr-3 md:pr-8 pt-3"
              style={{ height: 414 }}
              autoHide={false}
            >
              <div
                style={{
                  paddingTop,
                  paddingBottom,
                }}
              >
                {items.map((item) => (
                  <div key={item.key} data-index={item.index} ref={virtualizer.measureElement}>
                    <ManageTokenItem
                      setTokenForPortfolio={setTokenForPortfolio}
                      token={filteredTokens[item.index]}
                    />
                  </div>
                ))}
              </div>
            </SimpleBar>
          </div>
        </div>
      )}
      {Boolean(!filteredTokens.length && onlyCustom && !isTokenFilterActive) && (
        <div className="flex items-center justify-center gap-2 flex-col h-full bg-empty-custom-token bg-right-top bg-no-repeat max-md:bg-size-180">
          <span className="text-secondary-text">{t("no_custom_yet")}</span>
        </div>
      )}
      {Boolean(!filteredTokens.length && isTokenFilterActive) && !derivedToken && !isLoading && (
        <div className="flex items-center justify-center gap-2 flex-col h-full bg-empty-not-found-token bg-right-top bg-no-repeat max-md:bg-size-180">
          <span className="text-secondary-text">{t("token_not_found")}</span>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 flex-col h-full">
          <Preloader size={80} />
        </div>
      )}

      {Boolean(!filteredTokens.length && isTokenFilterActive) && derivedToken && (
        <div className="card-spacing-x flex flex-col flex-grow mt-3 card-spacing-b">
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
                  {derivedToken.name} ({t("decimals_amount", { decimals: derivedToken.decimals })})
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
                        <Badge variant={BadgeVariant.COLORED} color="red" text="ERC-777" />
                      ) : (
                        <Badge variant={BadgeVariant.STANDARD} standard={Standard.ERC20} />
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
                          <Badge variant={BadgeVariant.STANDARD} standard={Standard.ERC223} />
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
            ) : alreadyImported ? (
              <Alert
                type="info"
                text="This token has already been imported. You cannot import the same token twice."
              />
            ) : (
              <Alert text={t("import_token_warning")} type="warning" />
            )}
          </div>

          <div className="flex flex-col gap-5 mt-5">
            {!alreadyImported && !isErc777 && (
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
                : alreadyImported
                  ? t("already_imported")
                  : t("import_symbol", { symbol: derivedToken.symbol })}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
