import { isZeroAddress } from "@ethereumjs/util";
import Alert from "@repo/ui/alert";
import Checkbox from "@repo/ui/checkbox";
import ExternalTextLink from "@repo/ui/external-text-link";
import Preloader from "@repo/ui/preloader";
import { useTranslations } from "next-intl";
import React, { useCallback, useMemo, useState } from "react";
import { Address, isAddress } from "viem";
import { usePublicClient, useReadContract } from "wagmi";

import DialogHeader from "@/components/atoms/DialogHeader";
import EmptyStateIcon from "@/components/atoms/EmptyStateIcon";
import { InputSize } from "@/components/atoms/Input";
import TextField from "@/components/atoms/TextField";
import Badge, { BadgeVariant } from "@/components/badges/Badge";
import Button, { ButtonSize } from "@/components/buttons/Button";
import IconButton, { IconButtonSize, IconButtonVariant } from "@/components/buttons/IconButton";
import { predictWrapperAddress } from "@/components/manage-tokens/scripts/convertTokenList";
import { ManageTokensDialogContent } from "@/components/manage-tokens/types";
import { ERC20_ABI } from "@/config/abis/erc20";
import { ERC223_ABI } from "@/config/abis/erc223";
import {
  ERC777_TOKEN_INTERFACE_HASH,
  ERC1820_ABI,
  ERC1820_REGISTRY_ADDRESS,
} from "@/config/abis/erc1820";
import { TOKEN_CONVERTER_ABI } from "@/config/abis/tokenConverter";
import { addCustomToken } from "@/db/addCustomToken";
import getExplorerLink, { ExplorerLinkType } from "@/functions/getExplorerLink";
import truncateMiddle from "@/functions/truncateMiddle";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { isErc777Implementer, useIsErc777 } from "@/hooks/useErc777";
import { useTokenLists } from "@/hooks/useTokenLists";
import addToast from "@/other/toast";
import { CONVERTER_ADDRESS } from "@/sdk_bi/addresses";
import { DexChainId } from "@/sdk_bi/chains";
import { Token } from "@/sdk_bi/entities/token";
import { Standard } from "@/sdk_bi/standard";

interface Props {
  setContent: (content: ManageTokensDialogContent) => void;
  handleClose: () => void;
}

function EmptyState({
  tokenAddressToImport,
  isFound,
}: {
  tokenAddressToImport: string;
  isFound: boolean;
}) {
  const t = useTranslations("ManageTokens");

  if (!tokenAddressToImport) {
    return (
      <div className="flex-grow flex justify-center items-center flex-col gap-2 bg-empty-import-token bg-right-top bg-no-repeat max-md:bg-size-180 px-4 -mx-4 md:px-10 md:-mx-10 -mt-5 pt-5">
        <p className="text-secondary-text text-center">{t("to_import_a_token")}</p>
      </div>
    );
  }

  if (!isAddress(tokenAddressToImport)) {
    return (
      <div className="flex items-center justify-center gap-2 flex-col flex-grow">
        <EmptyStateIcon iconName="warning" />
        <span className="text-red-light">{t("enter_valid")}</span>
      </div>
    );
  }

  if (!isFound) {
    return (
      <div className="flex items-center justify-center gap-2 flex-col flex-grow bg-empty-not-found-token bg-right-top bg-no-repeat max-md:bg-size-180 px-4 -mx-4 md:px-10 md:-mx-10 -mt-5 pt-5">
        <span className="text-secondary-text">{t("token_not_found")}</span>
      </div>
    );
  }
}

export function useImportToken() {
  const publicClient = usePublicClient();

  const handleImport = useCallback(
    async (tokenAddressToImport: Address, chainId: DexChainId, imageURL?: string) => {
      const calls = [
        {
          abi: ERC20_ABI,
          address: tokenAddressToImport! as Address,
          chainId,
          functionName: "name",
        },
        {
          abi: ERC20_ABI,
          address: tokenAddressToImport! as Address,
          chainId,
          functionName: "symbol",
        },
        {
          abi: ERC20_ABI,
          address: tokenAddressToImport! as Address,
          chainId,
          functionName: "decimals",
        },
        {
          abi: ERC223_ABI,
          address: tokenAddressToImport! as Address,
          chainId,
          functionName: "standard",
        },
        {
          abi: TOKEN_CONVERTER_ABI,
          functionName: "isWrapper",
          address: CONVERTER_ADDRESS[chainId],
          chainId,
          args: [tokenAddressToImport as Address],
        },
        {
          abi: ERC1820_ABI,
          functionName: "getInterfaceImplementer",
          address: ERC1820_REGISTRY_ADDRESS,
          chainId,
          args: [tokenAddressToImport as Address, ERC777_TOKEN_INTERFACE_HASH],
        },
      ];

      if (!publicClient) {
        return;
      }

      const res = await publicClient.multicall({ contracts: calls });

      const name = res[0].result;
      const symbol = res[1].result;
      const decimals = res[2].result;
      const standard = res[3].result;
      const isWrapper = res[4].result;

      // ERC-777 tokens are not supported by the converter: never import them.
      if (isErc777Implementer(res[5].result)) {
        return;
      }

      const otherAddressFunctionName =
        isWrapper == null
          ? null
          : isWrapper
            ? standard === 223
              ? "getERC20OriginFor"
              : "getERC223OriginFor"
            : "predictWrapperAddress";

      const predictedOtherAddress = await publicClient.readContract({
        abi: TOKEN_CONVERTER_ABI,
        functionName: otherAddressFunctionName!,
        address: CONVERTER_ADDRESS[chainId],
        args: [tokenAddressToImport as Address, standard !== 223],
      });

      const { erc20AddressToImport, erc223AddressToImport } =
        standard === 223
          ? {
              erc20AddressToImport: predictedOtherAddress,
              erc223AddressToImport: tokenAddressToImport,
            }
          : {
              erc223AddressToImport: predictedOtherAddress,
              erc20AddressToImport: tokenAddressToImport,
            };

      if (!decimals || !name || !symbol) {
        return;
      }

      const logoURI = imageURL?.trim();
      const token = new Token(
        chainId,
        erc20AddressToImport as Address,
        erc223AddressToImport as Address,
        decimals as number,
        symbol as string,
        name as string,
        logoURI && /^(https|ipfs):\/\/\S+$/i.test(logoURI)
          ? logoURI
          : "/images/tokens/placeholder.svg",
      );

      await addCustomToken(token);

      return token;
    },
    [publicClient],
  );

  return { handleImport };
}

export default function ImportToken({ setContent, handleClose }: Props) {
  const t = useTranslations("ManageTokens");
  const [tokenAddressToImport, setTokenAddressToImport] = useState("");
  const chainId = useCurrentChainId();

  const {
    data: tokenName,
    isFetched,
    isLoading: isLoadingName,
  } = useReadContract({
    abi: ERC20_ABI,
    functionName: "name",
    chainId,
    address: tokenAddressToImport! as Address,
    query: {
      enabled: !!tokenAddressToImport && isAddress(tokenAddressToImport),
    },
  });

  const { data: tokenSymbol, isLoading: isLoadingSymbol } = useReadContract({
    abi: ERC20_ABI,
    functionName: "symbol",
    address: tokenAddressToImport! as Address,
    chainId,
    query: {
      enabled: !!tokenAddressToImport && isAddress(tokenAddressToImport),
    },
  });

  const { data: tokenDecimals, isLoading: isLoadingDecimals } = useReadContract({
    abi: ERC20_ABI,
    functionName: "decimals",
    address: tokenAddressToImport! as Address,
    chainId,
    query: {
      enabled: !!tokenAddressToImport && isAddress(tokenAddressToImport),
    },
  });

  const { data: standard, isLoading: isLoadingStandard } = useReadContract({
    abi: ERC223_ABI,
    functionName: "standard",
    address: tokenAddressToImport as Address,
    chainId,
    query: {
      enabled: !!tokenAddressToImport && isAddress(tokenAddressToImport),
    },
  });

  const { data: isWrapper, isLoading: isLoadingWrapper } = useReadContract({
    abi: TOKEN_CONVERTER_ABI,
    functionName: "isWrapper",
    address: CONVERTER_ADDRESS[chainId],
    args: [tokenAddressToImport as Address],
    chainId,
    query: {
      enabled: !!tokenAddressToImport && isAddress(tokenAddressToImport),
    },
  });

  const otherAddressFunctionName = useMemo(() => {
    if (isWrapper == null) {
      return null;
    }

    if (isWrapper) {
      if (standard === 223) {
        return "getERC20OriginFor";
      }
      return "getERC223OriginFor";
    }

    return "predictWrapperAddress";
  }, [isWrapper, standard]);

  const otherAddressCheckFunctionName = useMemo(() => {
    if (otherAddressFunctionName !== "predictWrapperAddress") {
      return null;
    }

    if (standard === 223) {
      return "getERC20WrapperFor";
    }
    return "getERC223WrapperFor";
  }, [otherAddressFunctionName, standard]);

  const { data: otherAddress, isLoading: isLoadingOtherAddress } = useReadContract({
    abi: TOKEN_CONVERTER_ABI,
    functionName: otherAddressCheckFunctionName!,
    address: CONVERTER_ADDRESS[chainId],
    args: [tokenAddressToImport as Address],
    chainId,
    query: {
      enabled:
        !!tokenAddressToImport &&
        isAddress(tokenAddressToImport) &&
        Boolean(otherAddressCheckFunctionName),
    },
  });

  const { data: predictedOtherAddress, isLoading: isLoadingOtherAddressFunction } = useReadContract(
    {
      abi: TOKEN_CONVERTER_ABI,
      functionName: otherAddressFunctionName!,
      address: CONVERTER_ADDRESS[chainId],
      args: [tokenAddressToImport as Address, standard !== 223],
      chainId,
      query: {
        enabled:
          !!tokenAddressToImport &&
          isAddress(tokenAddressToImport) &&
          Boolean(otherAddressFunctionName),
      },
    },
  );

  const { erc20AddressToImport, erc223AddressToImport, isErc20Exist, isErc223Exist } =
    useMemo(() => {
      if (standard && +standard === 223) {
        return {
          erc20AddressToImport: predictedOtherAddress,
          erc223AddressToImport: tokenAddressToImport,
          isErc20Exist: otherAddress && isAddress(otherAddress) && !isZeroAddress(otherAddress),
          isErc223Exist: true,
        };
      }

      return {
        erc20AddressToImport: tokenAddressToImport,
        erc223AddressToImport: predictedOtherAddress,
        isErc223Exist: otherAddress && isAddress(otherAddress) && !isZeroAddress(otherAddress),
        isErc20Exist: true,
      };
    }, [otherAddress, predictedOtherAddress, standard, tokenAddressToImport]);

  const [checkedUnderstand, setCheckedUnderstand] = useState<boolean>(false);

  const custom = useTokenLists(true);

  const alreadyImported = useMemo(() => {
    return !!(custom && custom?.[0]?.list.tokens.find((v) => v.address0 === tokenAddressToImport));
  }, [custom, tokenAddressToImport]);

  const { isErc777, isLoading: isLoadingErc777 } = useIsErc777(tokenAddressToImport);

  const isTokenLoading = useMemo(() => {
    return (
      isLoadingErc777 ||
      isLoadingStandard ||
      isLoadingDecimals ||
      isLoadingName ||
      isLoadingOtherAddressFunction ||
      isLoadingOtherAddress
    );
  }, [
    isLoadingDecimals,
    isLoadingErc777,
    isLoadingName,
    isLoadingOtherAddress,
    isLoadingOtherAddressFunction,
    isLoadingStandard,
  ]);

  return (
    <>
      <DialogHeader
        onBack={() => setContent("default")}
        onClose={handleClose}
        title={t("import_token")}
      />
      <div className="w-full md:w-[600px] card-spacing min-h-[580px] flex flex-col">
        <TextField
          label={t("import_token")}
          size={InputSize.LARGE}
          value={tokenAddressToImport}
          onChange={(e) => setTokenAddressToImport(e.target.value)}
          placeholder={t("token_address_placeholder")}
          error={
            Boolean(tokenAddressToImport) && !isAddress(tokenAddressToImport)
              ? t("enter_in_correct_format")
              : ""
          }
        />

        <EmptyState
          tokenAddressToImport={tokenAddressToImport}
          isFound={
            !isTokenLoading &&
            Boolean(
              tokenName &&
                typeof tokenDecimals !== "undefined" &&
                tokenSymbol &&
                predictedOtherAddress,
            )
          }
        />

        {isTokenLoading && (
          <div>
            <Preloader size={80} />
          </div>
        )}

        {tokenName &&
          typeof tokenDecimals !== "undefined" &&
          tokenSymbol &&
          predictedOtherAddress && (
            <>
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
                    <span className="text-primary-text">{tokenSymbol}</span>
                    <span className="text-secondary-text">
                      {tokenName} ({t("decimals_amount", { decimals: tokenDecimals })})
                    </span>
                  </div>
                </div>
                {erc223AddressToImport && erc20AddressToImport && (
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
                          text={truncateMiddle(erc20AddressToImport)}
                          href={getExplorerLink(
                            ExplorerLinkType.ADDRESS,
                            erc20AddressToImport,
                            chainId,
                          )}
                          className="justify-between"
                        />
                        <IconButton
                          variant={IconButtonVariant.COPY}
                          buttonSize={IconButtonSize.SMALL}
                          text={erc20AddressToImport}
                        />
                        {!isErc777 && (
                          <>
                            <span className="text-secondary-text flex items-center gap-1">
                              {t("address")}{" "}
                              <Badge variant={BadgeVariant.STANDARD} standard={Standard.ERC223} />
                            </span>
                            {erc223AddressToImport && isErc223Exist && (
                              <>
                                <ExternalTextLink
                                  text={truncateMiddle(erc223AddressToImport)}
                                  href={getExplorerLink(
                                    ExplorerLinkType.ADDRESS,
                                    erc223AddressToImport,
                                    chainId,
                                  )}
                                  className="justify-between"
                                />
                                <IconButton
                                  variant={IconButtonVariant.COPY}
                                  buttonSize={IconButtonSize.SMALL}
                                  text={erc223AddressToImport}
                                />
                              </>
                            )}
                            {erc223AddressToImport && !isErc223Exist && (
                              <>
                                <span></span>
                                <span className="text-tertiary-text text-right flex w-8 items-center justify-center">
                                  —
                                </span>
                              </>
                            )}
                          </>
                        )}
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
                  disabled={!checkedUnderstand || alreadyImported || isErc777}
                  onClick={async () => {
                    if (
                      chainId &&
                      tokenName &&
                      tokenDecimals != null &&
                      tokenSymbol &&
                      predictedOtherAddress &&
                      erc20AddressToImport &&
                      erc223AddressToImport
                    ) {
                      const token = new Token(
                        chainId,
                        erc20AddressToImport as Address,
                        erc223AddressToImport as Address,
                        tokenDecimals,
                        tokenSymbol,
                        tokenName,
                        "/images/tokens/placeholder.svg",
                      );

                      await addCustomToken(token);
                    }
                    setContent("default");
                    addToast(t("imported_successfully"));
                  }}
                >
                  {isErc777
                    ? t("token_not_supported")
                    : alreadyImported
                      ? t("already_imported")
                      : t("import_symbol", { symbol: tokenSymbol })}
                </Button>
              </div>
            </>
          )}
      </div>
    </>
  );
}
