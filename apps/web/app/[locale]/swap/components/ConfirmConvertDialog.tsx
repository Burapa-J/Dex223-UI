import Alert from "@repo/ui/alert";
import Preloader from "@repo/ui/preloader";
import Tooltip from "@repo/ui/tooltip";
import clsx from "clsx";
import Image from "next/image";
import { useTranslations } from "next-intl";
import React, { PropsWithChildren, useEffect, useMemo, useState } from "react";
import { NumericFormat } from "react-number-format";
import { Address, formatEther, formatGwei, parseUnits } from "viem";

import SwapDetailsRow from "@/app/[locale]/swap/components/SwapDetailsRow";
import useSwap, { useSwapStatus } from "@/app/[locale]/swap/hooks/useSwap";
import { feePerGasWei } from "@/app/[locale]/swap/lib/feePerGasWei";
import { useConfirmConvertDialogStore } from "@/app/[locale]/swap/stores/useConfirmConvertDialogOpened";
import { useSwapAmountsStore } from "@/app/[locale]/swap/stores/useSwapAmountsStore";
import {
  useSwapGasLimitStore,
  useSwapGasPriceStore,
} from "@/app/[locale]/swap/stores/useSwapGasSettingsStore";
import { useSwapSettingsStore } from "@/app/[locale]/swap/stores/useSwapSettingsStore";
import {
  SwapError,
  SwapStatus,
  useSwapStatusStore,
} from "@/app/[locale]/swap/stores/useSwapStatusStore";
import { useSwapTokensStore } from "@/app/[locale]/swap/stores/useSwapTokensStore";
import DialogHeader from "@/components/atoms/DialogHeader";
import DrawerDialog from "@/components/atoms/DrawerDialog";
import EmptyStateIcon from "@/components/atoms/EmptyStateIcon";
import Input from "@/components/atoms/Input";
import Svg from "@/components/atoms/Svg";
import WhyApproveHint from "@/components/atoms/WhyApproveHint";
import Badge, { BadgeVariant } from "@/components/badges/Badge";
import Button, { ButtonColor, ButtonSize } from "@/components/buttons/Button";
import IconButton from "@/components/buttons/IconButton";
import { networks } from "@/config/networks";
import { clsxMerge } from "@/functions/clsxMerge";
import { formatFloat } from "@/functions/formatFloat";
import { getGasSettings } from "@/functions/gasSettings";
import getExplorerLink, { ExplorerLinkType } from "@/functions/getExplorerLink";
import { useStoreAllowance } from "@/hooks/useAllowance";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { useNativeCurrency } from "@/hooks/useNativeCurrency";
import { useUSDPrice } from "@/hooks/useUSDPrice";
import { CONVERTER_ADDRESS } from "@/sdk_bi/addresses";
import { Currency } from "@/sdk_bi/entities/currency";
import { wrappedTokens } from "@/sdk_bi/entities/weth9";
import { Standard } from "@/sdk_bi/standard";
import { useGlobalFees } from "@/shared/hooks/useGlobalFees";

//TODO: refactor approve rows
function ApproveRow({
  logoURI = "",
  isPending = false,
  isLoading = false,
  isSuccess = false,
  isSuccessSwap = false,
  isReverted = false,
  hash,
}: {
  logoURI: string | undefined;
  isLoading?: boolean;
  isPending?: boolean;
  isSuccess?: boolean;
  isSuccessSwap?: boolean;
  isReverted?: boolean;
  hash?: Address | undefined;
}) {
  const t = useTranslations("Swap");
  const chainId = useCurrentChainId();

  return (
    <div
      className={clsx(
        "grid grid-cols-[32px_auto_1fr] gap-2 h-10 before:absolute relative before:left-[15px] before:-bottom-4 before:w-0.5 before:h-3 before:rounded-1",
        isSuccess ? "before:bg-green" : "before:bg-green-bg",
      )}
    >
      <div className="flex items-center">
        <Image
          className={clsx(isSuccess && "", "rounded-full")}
          src={logoURI}
          alt=""
          width={32}
          height={32}
        />
      </div>

      <div className="flex flex-col justify-center">
        <span
          className={clsx(
            isSuccess ? "text-secondary-text text-14" : "text-14",
            isSuccessSwap && "text-primary-text",
          )}
        >
          {(isSuccess || isSuccessSwap) && t("approved")}
          {isPending && t("confirm_in_your_wallet")}
          {isLoading && t("approving")}
          {!isSuccess && !isPending && !isReverted && !isLoading && !isSuccessSwap && t("approve")}
          {isReverted && t("approve_failed")}
        </span>
        {!isSuccess && !isSuccessSwap && !isReverted && <WhyApproveHint />}
      </div>
      <div className="flex items-center gap-2 justify-end">
        {hash && (
          <a
            target="_blank"
            rel="noopener noreferrer"
            href={getExplorerLink(ExplorerLinkType.TRANSACTION, hash, chainId)}
          >
            <IconButton iconName="forward" />
          </a>
        )}
        {isPending && (
          <>
            <Preloader type="linear" />
            <span className="text-secondary-text text-14">{t("proceed_in_your_wallet")}</span>
          </>
        )}
        {isLoading && <Preloader size={20} />}
        {(isSuccess || isSuccessSwap) && <Svg className="text-green" iconName="done" size={20} />}
        {isReverted && <Svg className="text-red-light" iconName="warning" size={20} />}
      </div>
    </div>
  );
}

function SwapRow({
  isPending = false,
  isLoading = false,
  isSuccess = false,
  isSettled = false,
  isReverted = false,
  isDisabled = false,
  hash,
}: {
  isLoading?: boolean;
  isPending?: boolean;
  isSettled?: boolean;
  isSuccess?: boolean;
  isReverted?: boolean;
  isDisabled?: boolean;
  hash?: Address | undefined;
}) {
  const t = useTranslations("Swap");
  const chainId = useCurrentChainId();

  return (
    <div className="grid grid-cols-[32px_auto_1fr] gap-2 h-10">
      <div className="flex items-center h-full">
        <div
          className={clsxMerge(
            "p-1 rounded-full h-8 w-8",
            isDisabled ? "bg-tertiary-bg" : "bg-green-bg",
            isReverted && "bg-red-bg",
          )}
        >
          <Svg
            className={clsxMerge(
              isDisabled ? "text-tertiary-text" : "text-green",
              isReverted && "text-red-light",
            )}
            iconName="convert"
          />
        </div>
      </div>

      <div className="flex flex-col justify-center">
        <span className={clsx("text-14", isDisabled ? "text-tertiary-text" : "text-primary-text")}>
          {(isPending || (!isLoading && !isReverted && !isSuccess)) && t("confirm_conversion")}
          {isLoading && t("conversion_in_progress")}
          {isReverted && t("conversion_failed")}
          {isSuccess && t("conversion_completed")}
        </span>
      </div>
      <div className="flex items-center gap-2 justify-end">
        {hash && (
          <a
            target="_blank"
            rel="noopener noreferrer"
            href={getExplorerLink(ExplorerLinkType.TRANSACTION, hash, chainId)}
          >
            <IconButton iconName="forward" />
          </a>
        )}
        {isPending && (
          <>
            <Preloader type="linear" />
            <span className="text-secondary-text text-14">{t("proceed_in_your_wallet")}</span>
          </>
        )}
        {isLoading && <Preloader size={20} />}
        {isSuccess && <Svg className="text-green" iconName="done" size={20} />}
        {isReverted && <Svg className="text-red-light" iconName="warning" size={20} />}
      </div>
    </div>
  );
}
function Rows({ children }: PropsWithChildren<{}>) {
  return <div className="flex flex-col gap-5">{children}</div>;
}

function ConvertActionButton({
  amountToApprove,
  isEditApproveActive,
}: {
  amountToApprove: string;
  isEditApproveActive: boolean;
}) {
  const t = useTranslations("Swap");
  const { tokenA, tokenB, tokenAStandard } = useSwapTokensStore();
  const { typedValue } = useSwapAmountsStore();
  const { setIsOpen } = useConfirmConvertDialogStore();

  const { handleSwap } = useSwap();

  const {
    isPendingApprove,
    isLoadingApprove,
    isPendingSwap,
    isLoadingSwap,
    isSuccessSwap,
    isSettledSwap,
    isRevertedSwap,
    isRevertedApprove,
  } = useSwapStatus();

  const { swapHash, approveHash, errorType } = useSwapStatusStore();

  if (!tokenA || !tokenB) {
    return (
      <Button fullWidth disabled>
        {t("select_tokens")}
      </Button>
    );
  }

  if (!typedValue) {
    return (
      <Button fullWidth disabled>
        {t("enter_amount")}
      </Button>
    );
  }

  if (tokenA.isToken && tokenAStandard === Standard.ERC20) {
    if (isPendingApprove) {
      return (
        <Rows>
          <ApproveRow isPending logoURI={tokenA.logoURI} />
          <SwapRow isDisabled />
        </Rows>
      );
    }

    if (isLoadingApprove) {
      return (
        <Rows>
          <ApproveRow hash={approveHash} isLoading logoURI={tokenA.logoURI} />
          <SwapRow isDisabled />
        </Rows>
      );
    }

    if (isRevertedApprove) {
      return (
        <>
          <Rows>
            <ApproveRow hash={approveHash} isReverted logoURI={tokenA.logoURI} />
            <SwapRow isDisabled />
          </Rows>
          <div className="flex flex-col gap-5 mt-4">
            <Alert
              withIcon={false}
              type="error"
              text={
                <span>
                  {t.rich("tx_failed_gas_or_contract", {
                    discord: (chunks) => (
                      <a
                        href="https://discord.gg/t5bdeGC5Jk"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green hocus:underline"
                      >
                        {chunks}
                      </a>
                    ),
                  })}
                </span>
              }
            />
            <Button
              fullWidth
              onClick={() => {
                setIsOpen(false);
              }}
            >
              {t("try_again")}
            </Button>
          </div>
        </>
      );
    }
  }

  if (isPendingSwap) {
    return (
      <Rows>
        {tokenA.isToken && tokenAStandard === Standard.ERC20 && (
          <ApproveRow hash={approveHash} isSuccess logoURI={tokenA.logoURI} />
        )}
        <SwapRow isPending />
      </Rows>
    );
  }

  if (isLoadingSwap) {
    return (
      <Rows>
        {tokenA.isToken && tokenAStandard === Standard.ERC20 && (
          <ApproveRow hash={approveHash} isSuccess logoURI={tokenA.logoURI} />
        )}
        <SwapRow hash={swapHash} isLoading />
      </Rows>
    );
  }

  if (isSuccessSwap) {
    return (
      <Rows>
        {tokenA.isToken && tokenAStandard === Standard.ERC20 && (
          <ApproveRow hash={approveHash} isSuccessSwap logoURI={tokenA.logoURI} />
        )}
        <SwapRow hash={swapHash} isSettled isSuccess />
      </Rows>
    );
  }

  if (isRevertedSwap) {
    return (
      <>
        <Rows>
          {tokenA.isToken && tokenAStandard === Standard.ERC20 && (
            <ApproveRow hash={approveHash} isSuccess logoURI={tokenA.logoURI} />
          )}
          <SwapRow hash={swapHash} isSettled isReverted />
        </Rows>
        <div className="flex flex-col gap-5 mt-4">
          <Alert
            withIcon={false}
            type="error"
            text={
              errorType === SwapError.UNKNOWN ? (
                <span>
                  {t.rich("tx_failed_gas_or_contract", {
                    discord: (chunks) => (
                      <a
                        href="https://discord.gg/t5bdeGC5Jk"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green hocus:underline"
                      >
                        {chunks}
                      </a>
                    ),
                  })}
                </span>
              ) : (
                <span>{t("tx_failed_out_of_gas")}</span>
              )
            }
          />
          <Button
            fullWidth
            onClick={() => {
              setIsOpen(false);
            }}
          >
            {t("try_again")}
          </Button>
        </div>
      </>
    );
  }

  return (
    <Button disabled={isEditApproveActive} onClick={() => handleSwap(amountToApprove)} fullWidth>
      {t("confirm_conversion")}
    </Button>
  );
}
export function ReadonlyTokenAmountCard({
  token,
  amount,
  amountUSD,
  standard,
  title,
}: {
  token: Currency | undefined;
  amount: string;
  amountUSD: string | undefined;
  standard: Standard;
  title: string;
}) {
  const t = useTranslations("Swap");

  return (
    <div className="rounded-3 bg-tertiary-bg py-4 px-5 flex flex-col gap-1">
      <p className="text-secondary-text text-14">{title}</p>
      <div className="flex justify-between items-center text-20">
        <span>{amount}</span>
        <div className="flex items-center gap-2">
          <Image
            src={token?.logoURI || "/images/tokens/placeholder.svg"}
            alt=""
            width={32}
            height={32}
          />
          {token?.symbol}
          {token?.isNative ? (
            <Badge color="green" text={t("native")} />
          ) : (
            <Badge variant={BadgeVariant.STANDARD} standard={standard} />
          )}
        </div>
      </div>
      <p className="text-secondary-text text-14">${amountUSD}</p>
    </div>
  );
}

export default function ConfirmConvertDialog() {
  const t = useTranslations("Swap");
  const {
    tokenA,
    tokenB,
    tokenAStandard,
    tokenBStandard,
    reset: resetTokens,
  } = useSwapTokensStore();
  const { typedValue, reset: resetAmounts } = useSwapAmountsStore();
  const chainId = useCurrentChainId();

  const { isOpen, setIsOpen } = useConfirmConvertDialogStore();

  const { slippage, deadline: _deadline } = useSwapSettingsStore();
  const {
    isPendingSwap,
    isLoadingSwap,
    isSuccessSwap,
    isLoadingApprove,
    isPendingApprove,
    isRevertedSwap,
    isSettledSwap,
    isRevertedApprove,
  } = useSwapStatus();

  const {
    status: swapStatus,
    setStatus: setSwapStatus,
    isReceiptUnavailable,
  } = useSwapStatusStore();

  const { estimatedGas, customGasLimit } = useSwapGasLimitStore();

  const isProcessing = useMemo(() => {
    return (
      isPendingSwap ||
      isLoadingSwap ||
      isSettledSwap ||
      isLoadingApprove ||
      isPendingApprove ||
      isRevertedApprove
    );
  }, [
    isLoadingApprove,
    isLoadingSwap,
    isPendingApprove,
    isPendingSwap,
    isRevertedApprove,
    isSettledSwap,
  ]);

  const [amountToApprove, setAmountToApprove] = useState(typedValue);
  // const { gasOption, gasPrice, gasLimit } = useSwapGasSettingsStore();

  useEffect(() => {
    if (typedValue) {
      setAmountToApprove(typedValue);
    }
  }, [typedValue]);

  const { gasPriceSettings, gasPriceOption } = useSwapGasPriceStore();
  const { baseFee, priorityFee, gasPrice } = useGlobalFees();
  const nativeCurrency = useNativeCurrency();

  const gasUnits = customGasLimit ?? estimatedGas + BigInt(30000);

  const feePerGas = useMemo(() => {
    return feePerGasWei(
      getGasSettings({
        baseFee,
        chainId,
        gasPrice,
        priorityFee,
        gasPriceOption,
        gasPriceSettings,
      }),
      baseFee,
    );
  }, [baseFee, chainId, gasPrice, gasPriceOption, gasPriceSettings, priorityFee]);

  const computedGasSpending = feePerGas !== undefined ? formatFloat(formatGwei(feePerGas)) : "0";
  const computedGasSpendingETH =
    feePerGas !== undefined ? formatFloat(formatEther(feePerGas * gasUnits)) : "0";

  const isConversion = useMemo(() => tokenB && tokenA?.equals(tokenB), [tokenA, tokenB]);

  useEffect(() => {
    if (isSuccessSwap && !isOpen && isConversion) {
      resetAmounts();
    }
  }, [isSuccessSwap, resetAmounts, isOpen, isConversion]);

  useEffect(() => {
    if (isReceiptUnavailable && !isOpen && isConversion) {
      setSwapStatus(SwapStatus.INITIAL);
      return;
    }
    if ((isSuccessSwap || isRevertedSwap || isRevertedApprove) && !isOpen && isConversion) {
      setTimeout(() => {
        setSwapStatus(SwapStatus.INITIAL);
      }, 400);
    }
  }, [
    isReceiptUnavailable,
    isConversion,
    isOpen,
    isRevertedApprove,
    isRevertedSwap,
    isSuccessSwap,
    setSwapStatus,
    swapStatus,
  ]);

  const [isEditApproveActive, setEditApproveActive] = useState(false);

  const { isAllowed: isAllowedA } = useStoreAllowance({
    token: tokenA,
    contractAddress: CONVERTER_ADDRESS[chainId],
    amountToCheck: parseUnits(typedValue, tokenA?.decimals ?? 18),
  });

  const { price: priceA } = useUSDPrice(tokenA?.wrapped.address0);

  const { price: priceNative } = useUSDPrice(wrappedTokens[chainId]?.address0);

  return (
    <DrawerDialog
      isOpen={isOpen}
      setIsOpen={(isOpen) => {
        setIsOpen(isOpen);
      }}
    >
      <div className="bg-primary-bg rounded-5 w-full sm:w-[600px]">
        <DialogHeader
          onClose={() => {
            setIsOpen(false);
          }}
          title={t("review_conversion")}
        />
        <div className="card-spacing">
          {!isSettledSwap && !isRevertedApprove && (
            <div className="flex flex-col gap-3">
              <ReadonlyTokenAmountCard
                token={tokenA}
                amount={typedValue}
                amountUSD={priceA ? formatFloat(priceA * +typedValue) : ""}
                standard={tokenAStandard}
                title={t("you_convert")}
              />
              <ReadonlyTokenAmountCard
                token={tokenB}
                amount={typedValue}
                amountUSD={priceA ? formatFloat(priceA * +typedValue) : ""}
                standard={tokenBStandard}
                title={t("you_receive")}
              />
            </div>
          )}
          {(isSettledSwap || isRevertedApprove) && (
            <div>
              <div className="mx-auto w-[80px] h-[80px] flex items-center justify-center relative mb-5">
                {(isRevertedSwap || isRevertedApprove) && <EmptyStateIcon iconName="warning" />}

                {isSuccessSwap && (
                  <>
                    <div className="w-[54px] h-[54px] rounded-full border-[7px] blur-[8px] opacity-80 border-green" />
                    <Svg
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-green"
                      iconName={"success"}
                      size={65}
                    />
                  </>
                )}
              </div>

              <div className="flex justify-center mb-1">
                <span className="text-20 font-bold text-primary-text mb-1">
                  {isRevertedSwap && t("conversion_failed")}
                  {isSuccessSwap && t("conversion_completed")}
                  {isRevertedApprove && t("approve_failed")}
                </span>
              </div>

              <div className="flex justify-center gap-2 mb-2">
                <Image
                  src={tokenA?.logoURI || "/images/tokens/placeholder.svg"}
                  alt=""
                  width={24}
                  height={24}
                />
                <span>
                  {tokenA?.symbol} {typedValue}
                </span>
              </div>

              <div className="flex justify-center gap-2 items-center">
                <Badge variant={BadgeVariant.STANDARD} standard={tokenAStandard} />
                <Svg className="text-tertiary-text" iconName="next" />
                <Badge variant={BadgeVariant.STANDARD} standard={tokenBStandard} />
              </div>
            </div>
          )}
          {!isProcessing && (
            <div className="pb-4 flex flex-col gap-2 rounded-b-3 text-14 mt-4">
              <SwapDetailsRow
                title={t("network_fee")}
                value={
                  <div>
                    <span className="text-secondary-text mr-1 text-14">
                      {computedGasSpending} GWEI
                    </span>{" "}
                    {computedGasSpendingETH !== "0" && (
                      <span className="text-secondary-text mr-1 text-14">
                        {computedGasSpendingETH} {nativeCurrency.symbol}
                      </span>
                    )}{" "}
                    <span className="mr-1 text-14">
                      {priceNative &&
                        computedGasSpendingETH !== "0" &&
                        `~$${formatFloat(priceNative * +computedGasSpendingETH)}`}
                    </span>
                  </div>
                }
                tooltipText={t("network_fee_tooltip", {
                  networkName: networks.find((n) => n.chainId === chainId)?.name,
                })}
              />

              <SwapDetailsRow
                title={t("gas_limit")}
                value={
                  customGasLimit
                    ? customGasLimit.toString()
                    : (estimatedGas + BigInt(30000)).toString() || t("loading")
                }
                tooltipText={t("gas_limit_tooltip")}
              />

              {tokenA?.isToken && tokenAStandard === Standard.ERC20 && !isAllowedA && (
                <div
                  className={clsx(
                    "bg-tertiary-bg rounded-3 flex items-center px-5 py-2 min-h-12 mt-2 gap-2",
                    +amountToApprove < +typedValue && "sm:pb-[26px]",
                  )}
                >
                  <div className="sm:items-center sm:justify-between sm:gap-5 flex-grow flex flex-col gap-1 sm:flex-row">
                    <div className="flex items-center gap-1 text-secondary-text whitespace-nowrap sm:flex-row-reverse">
                      <span>{t("approve_amount")}</span>
                      <Tooltip text={t("approve_amount_tooltip")} />
                    </div>

                    {!isEditApproveActive ? (
                      <span>
                        {amountToApprove} {tokenA.symbol}
                      </span>
                    ) : (
                      <div className="flex-grow">
                        <div className="relative w-full flex-grow">
                          <NumericFormat
                            inputMode="decimal"
                            allowedDecimalSeparators={[","]}
                            isError={+amountToApprove < +typedValue}
                            className="h-8 pl-3"
                            value={amountToApprove}
                            onValueChange={(values) => {
                              setAmountToApprove(values.value);
                            }}
                            customInput={Input}
                            allowNegative={false}
                            type="text"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-tertiary-text">
                            {tokenA.symbol}
                          </span>
                        </div>
                        {+amountToApprove < +typedValue && (
                          <span className="text-red-light sm:absolute text-12 sm:translate-y-0.5">
                            {t("approve_must_be_at_least", { amount: typedValue })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center">
                    {!isEditApproveActive ? (
                      <Button
                        size={ButtonSize.EXTRA_SMALL}
                        mobileSize={ButtonSize.SMALL}
                        colorScheme={ButtonColor.LIGHT_GREEN}
                        onClick={() => setEditApproveActive(true)}
                        className="!rounded-20"
                      >
                        {t("edit")}
                      </Button>
                    ) : (
                      <Button
                        disabled={+amountToApprove < +typedValue}
                        size={ButtonSize.EXTRA_SMALL}
                        mobileSize={ButtonSize.SMALL}
                        colorScheme={ButtonColor.LIGHT_GREEN}
                        onClick={() => setEditApproveActive(false)}
                        className="!rounded-20 disabled:bg-quaternary-bg"
                      >
                        {t("save")}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {isProcessing && <div className="h-px w-full bg-secondary-border mb-4 mt-5" />}
          <ConvertActionButton
            isEditApproveActive={isEditApproveActive}
            amountToApprove={amountToApprove}
          />
        </div>
      </div>
    </DrawerDialog>
  );
}
