import Checkbox from "@repo/ui/checkbox";
import { Formik, useFormikContext } from "formik";
import React, { useMemo, useState } from "react";

import ConfirmCreateTokenDialog from "@/app/[locale]/create-token/components/ConfirmCreateTokenDialog";
import { useCreateTokenDialogStore } from "@/app/[locale]/create-token/hooks/useCreateTokenDialogStore";
import TextField from "@/components/atoms/TextField";
import Button from "@/components/buttons/Button";
import GasSettingsBlock from "@/components/common/GasSettingsBlock";

const initialCreateTokenSettings = {
  name: "",
  symbol: "",
  totalSupply: "",
  imageURL: "",
  allowMintForOwner: false,
  createERC20: false,
};

import { useTranslations } from "next-intl";
import { useAccount } from "wagmi";
import * as Yup from "yup";

import { useCreateTokenEstimatedGas } from "@/app/[locale]/create-token/hooks/useCreateToken";
import NetworkFeeConfigDialog from "@/components/dialogs/NetworkFeeConfigDialog";
import { useConnectWalletDialogStateStore } from "@/components/dialogs/stores/useConnectWalletStore";
import { getFormattedGasPrice } from "@/functions/gasSettings";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { ERC223_TOKEN_DEPLOYER_ADDRESS, ZERO_ADDRESS } from "@/sdk_bi/addresses";
import { useGlobalFees } from "@/shared/hooks/useGlobalFees";

import {
  useCreateTokenGasLimitStore,
  useCreateTokenGasModeStore,
  useCreateTokenGasPriceStore,
} from "../stores/useCreateTokenGasSettingsStore";

const isValidHttpsUrl = (value?: string) => {
  try {
    if (!value) return true; // handled by required on other fields
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
};

const isValidIpfsUrl = (value?: string) => {
  if (!value) return true;
  return /^ipfs:\/\/.+/i.test(value);
};

function getCreateTokenSchema(t: ReturnType<typeof useTranslations>) {
  return Yup.object({
    name: Yup.string().trim().required(t("name_required")),
    symbol: Yup.string().trim().required(t("symbol_required")),
    totalSupply: Yup.string().trim().required(t("supply_required")),
    imageURL: Yup.string()
      .trim()
      .notRequired()
      .test(
        "ipfs-or-https",
        t("image_invalid"),
        (val) => !val || isValidIpfsUrl(val) || isValidHttpsUrl(val),
      ),
  });
}

function CreateTokenGasEstimator() {
  const { values } = useFormikContext<typeof initialCreateTokenSettings>();
  useCreateTokenEstimatedGas(values);
  return null;
}

export default function CreateTokenForm() {
  const chainId = useCurrentChainId();
  const isDeployerAvailable = ERC223_TOKEN_DEPLOYER_ADDRESS[chainId] !== ZERO_ADDRESS;
  const { isOpen, setIsOpen } = useCreateTokenDialogStore();
  const [createTokenSettings, setCreateTokenSettings] = useState(initialCreateTokenSettings);
  const { isConnected, chainId: walletChainId } = useAccount();
  const isWalletChainMatched = walletChainId === chainId;

  const t = useTranslations("CreateToken");
  const tWallet = useTranslations("Wallet");
  const tManage = useTranslations("ManageTokens");
  const { setIsOpened: setWalletConnectOpened } = useConnectWalletDialogStateStore();

  const {
    gasPriceOption,
    gasPriceSettings,
    setGasPriceOption,
    setGasPriceSettings,
    updateDefaultState,
  } = useCreateTokenGasPriceStore();
  const { estimatedGas, customGasLimit, setEstimatedGas, setCustomGasLimit } =
    useCreateTokenGasLimitStore();
  const { isAdvanced, setIsAdvanced } = useCreateTokenGasModeStore();

  const [isOpenedFee, setIsOpenedFee] = useState(false);
  const { baseFee, gasPrice, priorityFee } = useGlobalFees();

  const formattedGasPrice = useMemo(() => {
    return getFormattedGasPrice({
      baseFee,
      chainId,
      gasPrice,
      gasPriceOption,
      gasPriceSettings,
    });
  }, [baseFee, chainId, gasPrice, gasPriceOption, gasPriceSettings]);

  return (
    <>
      <Formik
        initialValues={createTokenSettings}
        onSubmit={(values) => {
          if (!isDeployerAvailable || !isWalletChainMatched) return;

          setCreateTokenSettings({
            ...values,
            name: values.name.trim(),
            symbol: values.symbol.trim(),
          });
          setIsOpen(true);
        }}
        validationSchema={getCreateTokenSchema(t)}
      >
        {(props) => (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              props.handleSubmit();
            }}
          >
            <CreateTokenGasEstimator />
            <div className="flex flex-col gap-1 mb-3">
              <TextField
                label={t("token_name")}
                tooltipText={t("name_tooltip")}
                placeholder={t("name_placeholder")}
                value={props.values.name}
                error={props.touched.name && props.errors.name}
                onChange={(e) => props.setFieldValue("name", e.target.value)}
              />
              <TextField
                label={tManage("symbol")}
                tooltipText={t("symbol_tooltip")}
                placeholder={t("symbol_placeholder")}
                value={props.values.symbol}
                error={props.touched.symbol && props.errors.symbol}
                onChange={(e) => props.setFieldValue("symbol", e.target.value)}
              />
              <TextField
                label={t("total_supply")}
                isNumeric
                tooltipText={t("supply_tooltip")}
                placeholder={t("supply_placeholder")}
                value={props.values.totalSupply}
                error={props.touched.totalSupply && props.errors.totalSupply}
                onChange={(e) => props.setFieldValue("totalSupply", e.target.value)}
              />
              <TextField
                label={t("image_url")}
                tooltipText={t("image_tooltip")}
                placeholder={t("image_placeholder")}
                value={props.values.imageURL}
                error={props.touched.imageURL && props.errors.imageURL}
                onChange={(e) => props.setFieldValue("imageURL", e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-4 mb-5">
              <Checkbox
                checked={props.values.allowMintForOwner}
                label={t("allow_mint")}
                handleChange={() =>
                  props.setFieldValue("allowMintForOwner", !props.values.allowMintForOwner)
                }
                id="allow-issue-new-tokens"
              />
              <Checkbox
                label={t("make_erc20")}
                checked={props.values.createERC20}
                handleChange={() => props.setFieldValue("createERC20", !props.values.createERC20)}
                id="make-erc20-version"
              />
            </div>

            <GasSettingsBlock
              customGasLimit={customGasLimit}
              estimatedGas={estimatedGas}
              formattedGasPrice={formattedGasPrice}
              handleClick={() => setIsOpenedFee(true)}
            />

            {isConnected ? (
              <Button
                disabled={
                  !isDeployerAvailable ||
                  !isWalletChainMatched ||
                  (Object.keys(props.touched).length > 0 && Object.keys(props.errors).length > 0)
                }
                fullWidth
              >
                {t("create_token")}
              </Button>
            ) : (
              <Button type="button" onClick={() => setWalletConnectOpened(true)} fullWidth>
                {tWallet("connect_wallet")}
              </Button>
            )}
          </form>
        )}
      </Formik>
      <ConfirmCreateTokenDialog createTokenSettings={createTokenSettings} />
      <NetworkFeeConfigDialog
        isAdvanced={isAdvanced}
        setIsAdvanced={setIsAdvanced}
        estimatedGas={estimatedGas}
        setEstimatedGas={setEstimatedGas}
        gasPriceSettings={gasPriceSettings}
        gasPriceOption={gasPriceOption}
        customGasLimit={customGasLimit}
        setCustomGasLimit={setCustomGasLimit}
        setGasPriceOption={setGasPriceOption}
        setGasPriceSettings={setGasPriceSettings}
        isOpen={isOpenedFee}
        setIsOpen={setIsOpenedFee}
      />
    </>
  );
}
