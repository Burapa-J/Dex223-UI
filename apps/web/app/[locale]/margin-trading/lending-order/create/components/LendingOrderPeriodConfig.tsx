import { useTranslations } from "next-intl";
import React from "react";

import {
  LendingOrderPeriod,
  LendingOrderPeriodErrors,
} from "@/app/[locale]/margin-trading/lending-order/create/steps/types";
import DateTimePicker from "@/components/atoms/DateTimePicker";
import TextField from "@/components/atoms/TextField";

export default function LendingOrderPeriodConfig({
  values,
  setValues,
  errors,
}: {
  values: LendingOrderPeriod;
  setValues: (values: LendingOrderPeriod) => void;
  errors?: LendingOrderPeriodErrors;
}) {
  const t = useTranslations("Margin");
  return (
    <div className="mb-4">
      <DateTimePicker
        label={t("order_deadline")}
        tooltipText={t("order_deadline_tooltip")}
        placeholder="DD.MM.YYYY hh:mm:ss aa"
        value={values.lendingOrderDeadline}
        onChange={(e) =>
          setValues({
            ...values,
            lendingOrderDeadline: e.target.value,
          })
        }
        error={errors?.lendingOrderDeadline}
      />
      <TextField
        internalText={t("days")}
        label={t("margin_positions_duration")}
        placeholder={"0"}
        tooltipText={t("position_duration_tooltip")}
        value={values.positionDuration}
        onChange={(e) =>
          setValues({
            ...values,
            positionDuration: e.target.value,
          })
        }
        error={errors?.positionDuration}
      />
    </div>
  );
}
