import { FormikErrors, FormikTouched } from "formik";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { ThirdStepValues } from "@/app/[locale]/margin-trading/lending-order/create/stores/useCreateOrderConfigStore";
import { InputSize } from "@/components/atoms/Input";
import SelectButton from "@/components/atoms/SelectButton";
import TextField, { InputLabel } from "@/components/atoms/TextField";
import PickTokenDialog from "@/components/dialogs/PickTokenDialog";
import { Currency } from "@/sdk_bi/entities/currency";

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

      <PickTokenDialog
        handlePick={handlePick}
        isOpen={isOpenedTokenPick}
        setIsOpen={setIsOpenedTokenPick}
        simpleForm
      />
    </div>
  );
}
