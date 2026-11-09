import Alert from "@repo/ui/alert";
import { FormikErrors, FormikTouched } from "formik";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { formatEther, formatGwei, parseUnits } from "viem";

import { ThirdStepValues } from "@/app/[locale]/margin-trading/lending-order/create/stores/useCreateOrderConfigStore";
import { InputSize } from "@/components/atoms/Input";
import SelectButton from "@/components/atoms/SelectButton";
import TextField, { InputLabel } from "@/components/atoms/TextField";
import PickTokenDialog from "@/components/dialogs/PickTokenDialog";
import { formatFloat } from "@/functions/formatFloat";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { useUSDPrice } from "@/hooks/useUSDPrice";
import { Currency } from "@/sdk_bi/entities/currency";
import { wrappedTokens } from "@/sdk_bi/entities/weth9";
import { useGlobalFees } from "@/shared/hooks/useGlobalFees";

// One liquidation is two transactions, freeze then sale. Measured on Sepolia: freeze 116k-363k gas,
// completed sale 336k-638k (one asset sold); positions holding more assets cost more.
const LIQUIDATION_GAS = BigInt(900_000);
// A gas spike is at least 100 gwei, or 5x the current price if that is higher.
const SPIKE_GAS_PRICE_FLOOR = BigInt(100_000_000_000);
const SPIKE_MULTIPLIER = BigInt(5);

const eth = (wei: bigint) => formatFloat(formatEther(wei));
const gwei = (wei: bigint) => formatFloat(formatGwei(wei));

/**
 * What one liquidation costs in gas, next to the reward the lender offers liquidators, with a
 * warning when the reward would not cover it (Figma page 11, "New lending order Step 3: liquidation
 * gas vs reward"). Liquidators skip positions that cost more to liquidate than they pay, and gas
 * spikes when markets move fast, which is when lenders need liquidations most.
 */
function LiquidationGasHint({ token, amount }: { token?: Currency; amount?: string | number }) {
  const t = useTranslations("Margin");
  const chainId = useCurrentChainId();
  const { gasPrice, baseFee } = useGlobalFees();
  const wrappedNative = wrappedTokens[chainId];
  const isEthLike = Boolean(
    token && (token.isNative || (wrappedNative && token.wrapped.equals(wrappedNative))),
  );
  const { price: tokenUsd } = useUSDPrice(isEthLike ? undefined : token?.wrapped.address0);
  const { price: ethUsd } = useUSDPrice(isEthLike ? undefined : wrappedNative?.address0);

  const price = gasPrice ?? baseFee;
  const costs = useMemo(() => {
    if (!price) return undefined;
    const spikePrice =
      price * SPIKE_MULTIPLIER > SPIKE_GAS_PRICE_FLOOR
        ? price * SPIKE_MULTIPLIER
        : SPIKE_GAS_PRICE_FLOOR;
    return { now: LIQUIDATION_GAS * price, spike: LIQUIDATION_GAS * spikePrice, spikePrice };
  }, [price]);

  // The reward in ETH wei, or undefined when it can't be compared.
  const rewardWei = useMemo(() => {
    const value = Number(amount);
    if (!token || !amount || !Number.isFinite(value) || value <= 0) return undefined;
    if (isEthLike) return parseUnits(String(amount), 18);
    if (!tokenUsd || !ethUsd || +tokenUsd <= 0 || +ethUsd <= 0) return undefined;
    return parseUnits(((value * +tokenUsd) / +ethUsd).toFixed(18), 18);
  }, [amount, ethUsd, isEthLike, token, tokenUsd]);

  if (!costs || !price) return null;

  const canCompare = rewardWei !== undefined;
  const belowNow = canCompare && rewardWei! < costs.now;
  const belowSpike = canCompare && !belowNow && rewardWei! < costs.spike;
  const reward = `${formatFloat(String(amount))} ${token?.symbol ?? ""}`;

  return (
    <div className="flex flex-col gap-3 mt-2">
      <span className="text-12 text-secondary-text">
        {t("liquidation_gas_hint", {
          now: eth(costs.now),
          gwei: gwei(price),
          spike: eth(costs.spike),
          spikeGwei: gwei(costs.spikePrice),
        })}
        {!isEthLike && token && amount && !canCompare
          ? ` ${t("liquidation_gas_no_price", { symbol: token.symbol ?? "" })}`
          : ""}
      </span>
      {belowNow && (
        <Alert
          type="error"
          text={t("liquidation_reward_below_now", { reward, now: eth(costs.now) })}
        />
      )}
      {belowSpike && (
        <Alert
          type="warning"
          text={t("liquidation_reward_below_spike", {
            reward,
            spike: eth(costs.spike),
            spikeGwei: gwei(costs.spikePrice),
          })}
        />
      )}
    </div>
  );
}

export default function LiquidationFeeConfig({
  values,
  setFieldValue,
  errors,
  touched,
}: {
  values: ThirdStepValues;
  setFieldValue: (
    field: string,
    value: any,
    shouldValidate?: boolean,
  ) => Promise<void | FormikErrors<ThirdStepValues>>;
  errors: FormikErrors<ThirdStepValues>;
  touched: FormikTouched<ThirdStepValues>;
}) {
  const t = useTranslations("Margin");
  const [isOpenedTokenPick, setIsOpenedTokenPick] = useState(false);

  const handlePick = useCallback(
    (token: Currency) => {
      setFieldValue("liquidationFeeToken", token);

      setIsOpenedTokenPick(false);
    },
    [setFieldValue],
  );

  return (
    <div className="mt-4 mb-6">
      <InputLabel inputSize={InputSize.LARGE} label={t("liquidation_fee_token")} />
      <SelectButton
        type="button"
        className="bg-quaternary-bg mb-6 pl-5"
        size={"medium"}
        fullWidth
        onClick={() => setIsOpenedTokenPick(true)}
      >
        <span className=" flex items-center gap-2">
          <Image
            src={values.liquidationFeeToken?.logoURI || "/images/tokens/placeholder.svg"}
            width={24}
            height={24}
            alt=""
          />
          {values.liquidationFeeToken?.symbol || t("select_token")}
        </span>
      </SelectButton>

      <TextField
        isNumeric
        label={t("fee_for_liquidator")}
        tooltipText={t("fee_for_liquidator_tooltip")}
        placeholder={t("fee_for_liquidator")}
        internalText={values.liquidationFeeToken?.symbol}
        value={values.liquidationFeeForLiquidator}
        onChange={(e) => setFieldValue("liquidationFeeForLiquidator", e.target.value)}
        error={touched.liquidationFeeForLiquidator && errors.liquidationFeeForLiquidator}
      />
      <LiquidationGasHint
        token={values.liquidationFeeToken}
        amount={values.liquidationFeeForLiquidator}
      />

      <PickTokenDialog
        handlePick={handlePick}
        isOpen={isOpenedTokenPick}
        setIsOpen={setIsOpenedTokenPick}
        simpleForm
      />
    </div>
  );
}
