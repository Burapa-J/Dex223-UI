import clsx from "clsx";
import { useFormik } from "formik";
import { useTranslations } from "next-intl";
import React, { ReactNode, useCallback, useMemo, useState } from "react";
import {
  ContractFunctionExecutionError,
  formatEther,
  formatGwei,
  parseGwei,
  TransactionExecutionError,
  UserRejectedRequestError,
} from "viem";
import { useAccount, useWalletClient } from "wagmi";

import DialogHeader from "@/components/atoms/DialogHeader";
import DrawerDialog from "@/components/atoms/DrawerDialog";
import Button, { ButtonColor } from "@/components/buttons/Button";
import RecentTransaction from "@/components/common/RecentTransaction";
import { useTransactionSpeedUpDialogStore } from "@/components/dialogs/stores/useTransactionSpeedUpDialogStore";
import EIP1559Fields from "@/components/gas-settings/EIP1559Fields";
import GasOptionRadioButton from "@/components/gas-settings/GasOptionRadioButton";
import useRepriceGasValidation from "@/components/gas-settings/hooks/useRepriceGasValidation";
import LegacyField from "@/components/gas-settings/LegacyField";
import { baseFeeMultipliers, SCALING_FACTOR } from "@/config/constants/baseFeeMultipliers";
import { add10PercentsToBigInt } from "@/functions/addPercentsToBigInt";
import { formatFloat } from "@/functions/formatFloat";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { useNativeCurrency } from "@/hooks/useNativeCurrency";
import { useUSDPrice } from "@/hooks/useUSDPrice";
import addToast from "@/other/toast";
import { wrappedTokens } from "@/sdk_bi/entities/weth9";
import { useGlobalFees } from "@/shared/hooks/useGlobalFees";
import { GasOption } from "@/stores/factories/createGasPriceStore";
import { useConfirmInWalletAlertStore } from "@/stores/useConfirmInWalletAlertStore";
import {
  GasFeeModel,
  RecentTransactionStatus,
  stringifyObject,
  useRecentTransactionsStore,
} from "@/stores/useRecentTransactionsStore";

export enum SpeedUpOption {
  AUTO_INCREASE,
  CHEAP,
  FAST,
  CUSTOM,
}

const speedUpOptionTitle: Record<SpeedUpOption, string> = {
  [SpeedUpOption.AUTO_INCREASE]: "+10% increase",
  [SpeedUpOption.CHEAP]: "Cheaper",
  [SpeedUpOption.FAST]: "Faster",
  [SpeedUpOption.CUSTOM]: "Custom",
};

const speedUpOptionIcon: Record<
  SpeedUpOption,
  "auto-increase" | "cheap-gas" | "fast-gas" | "custom-gas"
> = {
  [SpeedUpOption.AUTO_INCREASE]: "auto-increase",
  [SpeedUpOption.CHEAP]: "cheap-gas",
  [SpeedUpOption.FAST]: "fast-gas",
  [SpeedUpOption.CUSTOM]: "custom-gas",
};

const speedUpOptions = [
  SpeedUpOption.AUTO_INCREASE,
  SpeedUpOption.CHEAP,
  SpeedUpOption.FAST,
  SpeedUpOption.CUSTOM,
];

type ConvertableSpeedUpOption = Exclude<
  SpeedUpOption,
  SpeedUpOption.AUTO_INCREASE | SpeedUpOption.CUSTOM
>;
type GasOptionWithoutCustom = Exclude<GasOption, GasOption.CUSTOM>;

const gasPriceOptionMap: Record<ConvertableSpeedUpOption, GasOptionWithoutCustom> = {
  [SpeedUpOption.CHEAP]: GasOption.CHEAP,
  [SpeedUpOption.FAST]: GasOption.FAST,
};

function pickLargerBigInt(a: bigint, b: bigint) {
  return a > b ? a : b;
}

const tooltipTextMap: Record<SpeedUpOption, string> = {
  [SpeedUpOption.AUTO_INCREASE]:
    "GAS values will be increased by 10% compared to the values currently specified for the pending transaction you are trying to speed up.",
  [SpeedUpOption.CHEAP]:
    "GAS values will be set to minimize the fee you are going to pay. It might result in the transaction being pending for longer before confirming.",
  [SpeedUpOption.FAST]:
    "GAS values will be set to minimize the amount of time your transaction will take to confirm. It might result in higher gas fee payment.",
  [SpeedUpOption.CUSTOM]:
    "With custom transaction configuration you can set the gas values manually.",
};

export default function TransactionSpeedUpDialog() {
  const { transaction, isOpen, handleClose, replacement } = useTransactionSpeedUpDialogStore();
  const chainId = useCurrentChainId();
  const [speedUpOption, setSpeedUpOption] = useState<SpeedUpOption>(SpeedUpOption.AUTO_INCREASE);
  const { updateTransactionGasSettings, updateTransactionHash } = useRecentTransactionsStore();

  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const { openConfirmInWalletAlert, closeConfirmInWalletAlert } = useConfirmInWalletAlertStore();
  const { priorityFee, baseFee, gasPrice } = useGlobalFees();

  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations("Swap");

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      maxFeePerGas:
        transaction?.gas.model === GasFeeModel.EIP1559 && transaction.gas.maxFeePerGas
          ? formatGwei(add10PercentsToBigInt(transaction.gas.maxFeePerGas))
          : "",
      maxPriorityFeePerGas:
        transaction?.gas.model === GasFeeModel.EIP1559 && transaction.gas.maxPriorityFeePerGas
          ? formatGwei(add10PercentsToBigInt(transaction.gas.maxPriorityFeePerGas))
          : "",
      gasPrice:
        transaction?.gas.model === GasFeeModel.LEGACY && transaction.gas.gasPrice
          ? formatGwei(add10PercentsToBigInt(transaction.gas.gasPrice))
          : "",
      speedUpOption,
    },
    onSubmit: async (values, formikHelpers) => {
      if (!transaction?.params || transaction.nonce === undefined || !walletClient || !address) {
        return;
      }

      let gasPriceFormatted = {};

      switch (transaction.gas.model) {
        case GasFeeModel.LEGACY:
          if (!transaction.gas.gasPrice) {
            return;
          }

          const minimumAllowedGasPrice = add10PercentsToBigInt(transaction.gas.gasPrice);

          switch (values.speedUpOption) {
            case SpeedUpOption.AUTO_INCREASE:
              gasPriceFormatted = {
                gasPrice: minimumAllowedGasPrice,
              };
              break;
            case SpeedUpOption.CHEAP:
            case SpeedUpOption.FAST:
              if (!gasPrice) {
                return;
              }
              const _option = gasPriceOptionMap[values.speedUpOption];
              const multiplier = baseFeeMultipliers[chainId][_option];

              const increasedGasPrice = (gasPrice * multiplier) / SCALING_FACTOR;

              gasPriceFormatted = {
                gasPrice: pickLargerBigInt(minimumAllowedGasPrice, increasedGasPrice),
              };
              break;

            case SpeedUpOption.CUSTOM:
              if (!values.gasPrice) {
                return;
              }

              gasPriceFormatted = {
                gasPrice: parseGwei(values.gasPrice),
              };

              break;
          }
          break;
        case GasFeeModel.EIP1559:
          if (!transaction.gas.maxFeePerGas || !transaction.gas.maxPriorityFeePerGas) {
            return;
          }

          const minimumAllowedMaxFeePerGas = add10PercentsToBigInt(transaction.gas.maxFeePerGas);
          const minimumAllowedMaxPriorityFeePerGas = add10PercentsToBigInt(
            transaction.gas.maxPriorityFeePerGas,
          );

          switch (values.speedUpOption) {
            case SpeedUpOption.AUTO_INCREASE:
              gasPriceFormatted = {
                maxFeePerGas: minimumAllowedMaxFeePerGas,
                maxPriorityFeePerGas: minimumAllowedMaxPriorityFeePerGas,
              };
              break;
            case SpeedUpOption.CHEAP:
            case SpeedUpOption.FAST:
              if (!priorityFee || !baseFee) {
                return;
              }
              const _option = gasPriceOptionMap[values.speedUpOption];
              const multiplier = baseFeeMultipliers[chainId][_option];

              const increasedMaxPriorityFeePerGas = (priorityFee * multiplier) / SCALING_FACTOR;
              const increasedMaxFeePerGas = (baseFee * multiplier) / SCALING_FACTOR;

              gasPriceFormatted = {
                maxFeePerGas: pickLargerBigInt(minimumAllowedMaxFeePerGas, increasedMaxFeePerGas),
                maxPriorityFeePerGas: pickLargerBigInt(
                  minimumAllowedMaxPriorityFeePerGas,
                  increasedMaxPriorityFeePerGas,
                ),
              };
              break;

            case SpeedUpOption.CUSTOM:
              if (!values.maxFeePerGas || !values.maxPriorityFeePerGas) {
                return;
              }

              gasPriceFormatted = {
                maxPriorityFeePerGas: parseGwei(values.maxPriorityFeePerGas),
                maxFeePerGas: parseGwei(values.maxFeePerGas),
              };

              break;
          }
          break;
      }

      try {
        openConfirmInWalletAlert(t("confirm_action_in_your_wallet_alert"));
        setIsLoading(true);

        if (replacement === "reprice" && transaction.replacement !== "cancelled") {
          const hash = await walletClient.writeContract({
            nonce: transaction.nonce,
            ...gasPriceFormatted,
            ...transaction.params,
          });
          addToast("Transaction sped up successfully");
          updateTransactionHash(transaction.id, hash, address, "repriced");
        }

        if (replacement === "cancel" || transaction.replacement === "cancelled") {
          const hash = await walletClient.sendTransaction({
            nonce: transaction.nonce,
            ...gasPriceFormatted,
            value: BigInt(0),
            to: address,
            account: address,
          });
          addToast("Transaction cancellation submitted");
          updateTransactionHash(transaction.id, hash, address, "cancelled");
        }

        updateTransactionGasSettings(
          transaction.id,
          { model: transaction.gas.model, ...stringifyObject(gasPriceFormatted) },
          address,
        );

        handleClose();
      } catch (e) {
        if (e instanceof ContractFunctionExecutionError) {
          if (e.cause instanceof TransactionExecutionError) {
            if (e.cause.cause instanceof UserRejectedRequestError) {
              return;
            }
          }
        }

        addToast("Error while speeding up the transaction ", "error");
        handleClose();
      } finally {
        setIsLoading(false);

        closeConfirmInWalletAlert();
      }
    },
  });

  const { handleChange, handleBlur, touched, values, setFieldValue, handleSubmit, handleReset } =
    formik;

  const {
    maxFeePerGasError,
    maxFeePerGasWarning,
    maxPriorityFeePerGasError,
    maxPriorityFeePerGasWarning,
    legacyGasPriceError,
    legacyGasPriceWarning,
  } = useRepriceGasValidation({ transaction, ...values });

  const getGasPriceGwei = useCallback(
    (speedUpOption: SpeedUpOption) => {
      if (!baseFee) {
        return BigInt(0);
      }

      switch (speedUpOption) {
        case SpeedUpOption.AUTO_INCREASE:
          if (transaction?.gas.model === GasFeeModel.EIP1559 && transaction.gas.maxFeePerGas) {
            return add10PercentsToBigInt(transaction.gas.maxFeePerGas);
          }

          if (transaction?.gas.model === GasFeeModel.LEGACY && transaction.gas.gasPrice) {
            return add10PercentsToBigInt(transaction.gas.gasPrice);
          }

          return BigInt(0);
        case SpeedUpOption.CUSTOM:
          if (transaction?.gas.model === GasFeeModel.LEGACY) {
            return parseGwei(values.gasPrice);
          }

          if (transaction?.gas.model === GasFeeModel.EIP1559) {
            return parseGwei(values.maxFeePerGas);
          }
          return BigInt(0);
        case SpeedUpOption.CHEAP:
        case SpeedUpOption.FAST:
          return (
            (baseFee * baseFeeMultipliers[chainId][gasPriceOptionMap[speedUpOption]]) /
            SCALING_FACTOR
          );
      }
    },
    [baseFee, chainId, transaction?.gas, values.gasPrice, values.maxFeePerGas],
  );

  const nativeCurrency = useNativeCurrency();

  const title = useMemo(() => {
    if (transaction?.replacement === "cancelled" && replacement === "reprice") {
      return "Speed up cancellation";
    }

    if (replacement === "cancel") {
      return "Transaction cancellation";
    }

    return "Speed up";
  }, [transaction, replacement]);
  const { price } = useUSDPrice(wrappedTokens[chainId]?.address0);

  if (!transaction) {
    return null;
  }

  return (
    <DrawerDialog isOpen={isOpen} setIsOpen={handleClose}>
      <div className="w-full md:w-[600px]">
        <DialogHeader onClose={handleClose} title={title} />
        <div className="px-4 pb-4 md:px-10 md:pb-10">
          <RecentTransaction
            isWaitingForProceeding={
              isLoading && transaction.status === RecentTransactionStatus.PENDING
            }
            view={"transparent"}
            transaction={transaction}
            showSpeedUp={false}
          />
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2 mt-5">
              {speedUpOptions.map((_speedUpOption) => {
                const gasPriceETH = formatFloat(
                  formatEther(getGasPriceGwei(_speedUpOption) * BigInt(transaction.gas.gas)),
                );

                const gasPriceUSD = price
                  ? `~ $${formatFloat(price * +gasPriceETH)}`
                  : "Uknkown price";

                return (
                  <GasOptionRadioButton
                    key={_speedUpOption}
                    gasPriceGWEI={`${formatFloat(formatGwei(getGasPriceGwei(_speedUpOption)))} GWEI`}
                    gasPriceCurrency={`${gasPriceETH} ${nativeCurrency.symbol}`}
                    gasPriceUSD={gasPriceUSD}
                    tooltipText={tooltipTextMap[_speedUpOption]}
                    title={speedUpOptionTitle[_speedUpOption]}
                    iconName={speedUpOptionIcon[_speedUpOption]}
                    isActive={values.speedUpOption === _speedUpOption}
                    onClick={() => setFieldValue("speedUpOption", _speedUpOption)}
                    customContent={
                      _speedUpOption === SpeedUpOption.CUSTOM ? (
                        <div
                          className={clsx(
                            "pt-1",
                            values.speedUpOption !== SpeedUpOption.CUSTOM &&
                              "opacity-30 pointer-events-none",
                          )}
                        >
                          {transaction.gas.model === GasFeeModel.EIP1559 && (
                            <div className={clsx("px-5 pb-4")}>
                              <EIP1559Fields
                                maxPriorityFeePerGas={values.maxPriorityFeePerGas}
                                maxFeePerGas={values.maxFeePerGas}
                                setMaxFeePerGasValue={(value) =>
                                  setFieldValue("maxFeePerGas", value)
                                }
                                setMaxPriorityFeePerGasValue={(value) =>
                                  setFieldValue("maxPriorityFeePerGas", value)
                                }
                                currentMaxFeePerGas={
                                  (BigInt(transaction?.gas.maxFeePerGas || 0) * BigInt(110)) /
                                  SCALING_FACTOR
                                }
                                currentMaxPriorityFeePerGas={
                                  (BigInt(transaction?.gas.maxPriorityFeePerGas || 0) *
                                    BigInt(110)) /
                                  SCALING_FACTOR
                                }
                                handleChange={handleChange}
                                handleBlur={handleBlur}
                                maxFeePerGasError={maxFeePerGasError}
                                maxPriorityFeePerGasError={maxPriorityFeePerGasError}
                                maxFeePerGasWarning={maxFeePerGasWarning}
                                maxPriorityFeePerGasWarning={maxPriorityFeePerGasWarning}
                                helperButtonText={
                                  <>
                                    <span className="md:hidden">Required</span>
                                    <span className="hidden md:inline">Min. required</span>
                                  </>
                                }
                              />
                            </div>
                          )}

                          {transaction.gas.model === GasFeeModel.LEGACY && (
                            <div className={clsx("px-5 pb-4")}>
                              <LegacyField
                                value={values.gasPrice}
                                onChange={(e) => {
                                  handleChange(e);
                                }}
                                onBlur={(e) => {
                                  handleBlur(e);
                                }}
                                gasPrice={gasPrice}
                                setFieldValue={(value) => setFieldValue("gasPrice", value)}
                                legacyGasPriceError={legacyGasPriceError}
                                legacyGasPriceWarning={legacyGasPriceWarning}
                              />
                            </div>
                          )}
                        </div>
                      ) : undefined
                    }
                    disabled={isLoading || transaction.status !== RecentTransactionStatus.PENDING}
                  />
                );
              })}
            </div>
            {replacement === "reprice" && (
              <div className="grid grid-cols-2 gap-2 mt-5">
                <Button
                  type="button"
                  colorScheme={ButtonColor.LIGHT_GREEN}
                  onClick={() => handleClose()}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  fullWidth
                  disabled={
                    isLoading ||
                    transaction.status !== RecentTransactionStatus.PENDING ||
                    (values.speedUpOption === SpeedUpOption.CUSTOM &&
                      (!!maxFeePerGasError || !!maxPriorityFeePerGasError))
                  }
                >
                  Apply
                </Button>
              </div>
            )}
            {replacement === "cancel" && (
              <div className="mt-5">
                <Button
                  type="submit"
                  fullWidth
                  disabled={isLoading || transaction.status !== RecentTransactionStatus.PENDING}
                >
                  Confirm cancellation
                </Button>
              </div>
            )}
          </form>
        </div>
      </div>
    </DrawerDialog>
  );
}
