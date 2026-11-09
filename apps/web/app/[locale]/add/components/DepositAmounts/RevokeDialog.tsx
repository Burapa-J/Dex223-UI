import Alert from "@repo/ui/alert";
import Preloader from "@repo/ui/preloader";
import { useTranslations } from "next-intl";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount } from "wagmi";

import { RemoveLiquidityGasSettings } from "@/app/[locale]/remove/[tokenId]/components/RemoveLiquidityGasSettings";
import DialogHeader from "@/components/atoms/DialogHeader";
import DrawerDialog from "@/components/atoms/DrawerDialog";
import Svg from "@/components/atoms/Svg";
import TextField from "@/components/atoms/TextField";
import Badge, { BadgeVariant } from "@/components/badges/Badge";
import Button, { ButtonColor, ButtonSize, ButtonVariant } from "@/components/buttons/Button";
import Erc223ReceiveWarning from "@/components/common/Erc223ReceiveWarning";
import { useTransactionSpeedUpDialogStore } from "@/components/dialogs/stores/useTransactionSpeedUpDialogStore";
import { AllowanceStatus } from "@/hooks/useAllowance";
import useCanReceiveERC223 from "@/hooks/useCanReceiveERC223";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import useRevoke, { useRevokeEstimatedGas } from "@/hooks/useRevoke";
import useWithdraw, { useWithdrawEstimatedGas } from "@/hooks/useWithdraw";
import { NONFUNGIBLE_POSITION_MANAGER_ADDRESS } from "@/sdk_bi/addresses";
import { DexChainId } from "@/sdk_bi/chains";
import { Standard } from "@/sdk_bi/standard";
import { useRecentTransactionsStore } from "@/stores/useRecentTransactionsStore";
import { useRevokeDialogStatusStore } from "@/stores/useRevokeDialogStatusStore";
import { useRevokeStatusStore } from "@/stores/useRevokeStatusStore";

import {
  useRevokeGasLimitStore,
  useRevokeGasModeStore,
  useRevokeGasPrice,
  useRevokeGasPriceStore,
  useWithdrawGasLimitStore,
} from "../../stores/useRevokeGasSettings";

export const RevokeDialog = () => {
  const { status } = useRevokeStatusStore();

  const t = useTranslations("Liquidity");
  const {
    isOpenedRevokeDialog: isOpen,
    setIsOpenedRevokeDialog: setIsOpen,
    token,
    standard,
    contractAddress,
  } = useRevokeDialogStatusStore();

  const [localValue, setLocalValue] = useState(undefined as undefined | string);
  const tSwap = useTranslations("Swap");
  const { address } = useAccount();
  const canReceiveERC223 = useCanReceiveERC223(address);
  // Withdrawing an ERC-223 deposit delivers ERC-223 back; a smart account (EIP-7702) can't take it.
  const cannotReceive = standard === Standard.ERC223 && !canReceiveERC223;
  const localValueBigInt = useMemo(() => {
    if (!token || !localValue) return undefined;
    return parseUnits(localValue, token?.decimals);
  }, [localValue, token]);

  const { withdrawHandler, currentDeposit, withdrawHash } = useWithdraw({
    token: token,
    contractAddress: contractAddress,
  });
  const {
    revokeHandler: rHandler,
    currentAllowance: revokeAllowance,
    revokeHash,
  } = useRevoke({
    token: token,
    contractAddress: contractAddress,
  });

  const currentAllowance =
    standard === Standard.ERC20 ? revokeAllowance || BigInt(0) : currentDeposit || BigInt(0);
  const currentHash = standard === Standard.ERC20 ? revokeHash : withdrawHash;
  const revokeHandler = standard === Standard.ERC20 ? rHandler : withdrawHandler;

  const [error, setError] = useState("");
  const updateValue = useCallback(
    (value: string) => {
      setLocalValue(value);
      const valueBigInt = token ? parseUnits(value, token.decimals) : undefined;

      if (!valueBigInt) {
        if (standard === Standard.ERC20) {
          setError(t("no_value_to_revoke"));
          return;
        }
        setError(t("enter_withdraw_amount"));

        return;
      }

      if (valueBigInt > currentAllowance && standard === Standard.ERC223) {
        setError(
          t("max_withdraw", {
            amount: formatUnits(currentAllowance, token?.decimals || 18),
            symbol: token?.symbol,
          }),
        );
        return;
      }

      setError("");
    },
    [currentAllowance, standard, token, t],
  );

  const {
    gasPriceOption,
    gasPriceSettings,
    setGasPriceOption,
    setGasPriceSettings,
    updateDefaultState,
  } = useRevokeGasPriceStore();
  const { estimatedGas, customGasLimit, setEstimatedGas, setCustomGasLimit } =
    useRevokeGasLimitStore();

  const {
    estimatedGas: wEstimatedGas,
    customGasLimit: wCustomGasLimit,
    setEstimatedGas: wSetEstimatedGas,
    setCustomGasLimit: wSetCustomGasLimit,
  } = useWithdrawGasLimitStore();

  const { address: accountAddress } = useAccount();
  const { transactions } = useRecentTransactionsStore();
  const { handleSpeedUp, handleCancel, replacement } = useTransactionSpeedUpDialogStore();

  const recentTransaction = useMemo(() => {
    if (currentHash && accountAddress) {
      const txs = transactions[accountAddress];
      for (let tx of txs) {
        if (tx.hash === currentHash) {
          return tx;
        }
      }
    }
  }, [accountAddress, currentHash, transactions]);

  const { isAdvanced, setIsAdvanced } = useRevokeGasModeStore();

  const gasPrice: bigint | undefined = useRevokeGasPrice();

  const chainId = useCurrentChainId();
  useEffect(() => {
    updateDefaultState(chainId);
  }, [chainId, updateDefaultState]);

  useRevokeEstimatedGas({
    token: token,
    contractAddress: NONFUNGIBLE_POSITION_MANAGER_ADDRESS[chainId as DexChainId],
  });
  useWithdrawEstimatedGas({
    token: token,
    contractAddress: NONFUNGIBLE_POSITION_MANAGER_ADDRESS[chainId as DexChainId],
  });

  const inputDisabled = [
    AllowanceStatus.LOADING,
    AllowanceStatus.PENDING,
    AllowanceStatus.SUCCESS,
  ].includes(status);

  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      {token && (
        <DrawerDialog isOpen={isOpen} setIsOpen={setIsOpen}>
          <DialogHeader
            onClose={() => setIsOpen(false)}
            title={standard === Standard.ERC20 ? t("revoke") : t("withdraw")}
          />
          <div className="w-full md:w-[570px] card-spacing gap-1">
            <div className="flex justify-between items-center">
              <div className="flex gap-2 py-2 items-center text-secondary-text">
                {standard === Standard.ERC20 ? (
                  <span>{`${t("approve")} 0 ${token.symbol}`}</span>
                ) : (
                  <span>{`${t("withdraw")} ${token.symbol}`}</span>
                )}

                <Badge variant={BadgeVariant.STANDARD} standard={standard} className="mr-auto" />
              </div>
              <div className="flex items-center gap-2 justify-end ml-2 ">
                {/* Speed Up button */}
                {recentTransaction && status === AllowanceStatus.LOADING && (
                  <Button
                    className="relative hidden md:block"
                    colorScheme={ButtonColor.LIGHT_GREEN}
                    variant={ButtonVariant.CONTAINED}
                    size={ButtonSize.EXTRA_SMALL}
                    onClick={() => handleSpeedUp(recentTransaction)}
                  >
                    {recentTransaction.replacement === "repriced" && (
                      <span className="absolute -top-1.5 right-0.5 text-green">
                        <Svg size={16} iconName="speed-up" />
                      </span>
                    )}
                    <span className="text-12 font-medium pb-[3px] pt-[1px] flex items-center flex-row text-nowrap">
                      {t("speed_up")}
                    </span>
                  </Button>
                )}

                {status === AllowanceStatus.PENDING && (
                  <>
                    <Preloader type="linear" />
                    <span className="text-secondary-text text-nowrap text-14">
                      {t("status_pending")}
                    </span>
                  </>
                )}
                {status === AllowanceStatus.LOADING && <Preloader size={20} />}
                {(currentAllowance === BigInt(0) || status === AllowanceStatus.SUCCESS) && (
                  <Svg className="text-green" iconName="done" size={20} />
                )}
              </div>
            </div>

            {/* Speed Up button - on Mobile */}
            {recentTransaction && status === AllowanceStatus.LOADING && (
              <Button
                className="relative md:hidden rounded-5"
                fullWidth
                colorScheme={ButtonColor.LIGHT_GREEN}
                variant={ButtonVariant.CONTAINED}
                size={ButtonSize.SMALL}
                onClick={() => handleSpeedUp(recentTransaction)}
              >
                {recentTransaction.replacement === "repriced" && (
                  <span className="absolute -top-2 right-4 text-green">
                    <Svg size={20} iconName="speed-up" />
                  </span>
                )}
                <span className="text-14 font-medium pb-[5px] pt-[5px] flex items-center flex-row text-nowrap">
                  {t("speed_up")}
                </span>
              </Button>
            )}

            {standard === "ERC-20" ? (
              <div className="mt-2">
                <Alert
                  type="info"
                  text={
                    <span>
                      You are about to revoke a token approval. This will reset the amount of tokens
                      that the DEX contract can operate on your behalf for the current wallet. Make
                      sure that you have removed this permissions for contracts you are not planning
                      to interact with as this will protect your wallet from possible attacks.
                    </span>
                  }
                />
              </div>
            ) : (
              <>
                <TextField
                  label=""
                  value={
                    typeof localValue === "undefined"
                      ? formatUnits(currentAllowance || BigInt(0), token.decimals)
                      : localValue
                  }
                  onValueChange={(values) => {
                    updateValue(values.value);
                  }}
                  isNumeric
                  disabled={inputDisabled}
                  decimalScale={token.decimals}
                  placeholder="0"
                  internalText={t("amount", { symbol: token.symbol })}
                  allowNegative={false}
                  error={error}
                />
              </>
            )}

            <div className="mt-3">
              <RemoveLiquidityGasSettings
                gasPriceOption={gasPriceOption}
                gasPriceSettings={gasPriceSettings}
                setGasPriceOption={setGasPriceOption}
                setGasPriceSettings={setGasPriceSettings}
                estimatedGas={standard === Standard.ERC20 ? estimatedGas : wEstimatedGas}
                customGasLimit={standard === Standard.ERC20 ? customGasLimit : wCustomGasLimit}
                setEstimatedGas={standard === Standard.ERC20 ? setEstimatedGas : wSetEstimatedGas}
                setCustomGasLimit={
                  standard === Standard.ERC20 ? setCustomGasLimit : wSetCustomGasLimit
                }
                isAdvanced={isAdvanced}
                setIsAdvanced={setIsAdvanced}
                gasPrice={gasPrice}
                disabledEdit={status !== AllowanceStatus.INITIAL}
              />
            </div>

            {cannotReceive && status === AllowanceStatus.INITIAL && (
              <Erc223ReceiveWarning className="mt-4" />
            )}
            <div className="mt-4">
              {cannotReceive && status === AllowanceStatus.INITIAL ? (
                <Button fullWidth disabled>
                  {tSwap("wallet_cannot_receive_erc223")}
                </Button>
              ) : !!error ? (
                <Button fullWidth disabled>
                  <span className="flex items-center gap-2">{t("enter_correct_values")}</span>
                </Button>
              ) : [AllowanceStatus.INITIAL].includes(status) ? (
                <Button
                  onClick={() => {
                    revokeHandler(localValueBigInt).then();
                  }}
                  fullWidth
                >
                  {standard === Standard.ERC20 ? t("revoke") : t("withdraw")}
                </Button>
              ) : AllowanceStatus.PENDING === status ? (
                <Button fullWidth disabled>
                  <span className="flex items-center gap-2">
                    <Preloader size={20} color="green" type="linear" />
                  </span>
                </Button>
              ) : AllowanceStatus.LOADING === status ? (
                <Button fullWidth isLoading={true}>
                  {standard === Standard.ERC20 ? t("revoke") : t("withdraw")}
                  <span className="flex items-center gap-2">
                    <Preloader size={20} color="black" />
                  </span>
                </Button>
              ) : [AllowanceStatus.SUCCESS].includes(status) ? (
                <Button onClick={() => setIsOpen(false)} fullWidth>
                  {t("close")}
                </Button>
              ) : null}
            </div>
          </div>
        </DrawerDialog>
      )}
    </div>
  );
};
