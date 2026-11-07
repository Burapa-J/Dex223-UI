import Alert from "@repo/ui/alert";
import { FormikErrors, FormikTouched } from "formik";
import { useTranslations } from "next-intl";
import React from "react";

import {
  DEFAULT_MAINTENANCE_MARGIN_PERCENT,
  maxLeverageForMargin,
} from "@/app/[locale]/margin-trading/hooks/useLenderProtection";
import { ThirdStepValues } from "@/app/[locale]/margin-trading/lending-order/create/stores/useCreateOrderConfigStore";
import TextField from "@/components/atoms/TextField";
import { formatFloat } from "@/functions/formatFloat";

/**
 * Step 3 lender protection (Figma page 11, "New lending order Step 3: lender protection"): the
 * order's maintenance margin and the keeper allowed to complete loss liquidations during the
 * contract's 24-hour lender window.
 */
export default function LenderProtectionConfig({
  values,
  setFieldValue,
  errors,
  touched,
}: {
  values: ThirdStepValues;
  setFieldValue: (field: string, value: any) => unknown;
  errors: FormikErrors<ThirdStepValues>;
  touched: FormikTouched<ThirdStepValues>;
}) {
  const t = useTranslations("Margin");
  const percent = Number(values.maintenanceMarginPercent);
  const validPercent = Number.isFinite(percent) && percent >= 10 && percent <= 50;
  const changed =
    (validPercent && percent !== DEFAULT_MAINTENANCE_MARGIN_PERCENT) ||
    Boolean(values.liquidationKeeper);

  return (
    <div className="mb-6">
      <TextField
        isNumeric
        label={t("maintenance_margin")}
        tooltipText={t("maintenance_margin_tooltip")}
        placeholder={String(DEFAULT_MAINTENANCE_MARGIN_PERCENT)}
        internalText="%"
        value={values.maintenanceMarginPercent}
        onChange={(e) => setFieldValue("maintenanceMarginPercent", e.target.value)}
        error={touched.maintenanceMarginPercent && errors.maintenanceMarginPercent}
        helperText={
          validPercent
            ? t("maintenance_margin_help", {
                percent: formatFloat(percent),
                leverage: formatFloat(maxLeverageForMargin(percent)),
              })
            : undefined
        }
      />

      <TextField
        label={t("liquidation_keeper")}
        tooltipText={t("liquidation_keeper_tooltip")}
        placeholder={t("liquidation_keeper_placeholder")}
        value={values.liquidationKeeper}
        onChange={(e) => setFieldValue("liquidationKeeper", e.target.value.trim())}
        error={touched.liquidationKeeper && errors.liquidationKeeper}
        helperText={t("liquidation_keeper_help")}
      />

      {changed && <Alert type="info" text={t("lender_window_info")} />}
    </div>
  );
}
