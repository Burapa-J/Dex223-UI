import { useTranslations } from "next-intl";
import React, { ChangeEvent, useEffect, useMemo } from "react";

import { InputSize } from "@/components/atoms/Input";
import TextField from "@/components/atoms/TextField";
import ErrorsAndWarnings from "@/components/gas-settings/ErrorsAndWarnings";
import { ThemeColors } from "@/config/theme/colors";
import { useColorScheme } from "@/lib/color-scheme";

export default function GasLimitField({
  value,
  setFieldValue,
  onChange,
  onBlur,
  estimatedGas,
  gasLimitError,
}: {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: (e: ChangeEvent<HTMLInputElement>) => void;
  setFieldValue: (value: string) => void;
  estimatedGas: bigint;
  gasLimitError: string | undefined;
}) {
  const t = useTranslations("GasSettings");
  const colorScheme = useColorScheme();
  const gasLimitErrors = useMemo(() => {
    const _errors: string[] = [];

    [gasLimitError].forEach((v) => {
      if (v) {
        _errors.push(v);
      }
    });

    return _errors;
  }, [gasLimitError]);

  return (
    <>
      <TextField
        colorScheme={colorScheme}
        isNumeric
        decimalScale={0}
        placeholder={estimatedGas > 0n ? t("gas_limit") : t("configure_automatically")}
        label={t("gas_limit")}
        name="gasLimit"
        id="gasLimit"
        tooltipText={t("gas_limit_tooltip")}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        isError={!!gasLimitError}
        helperText={
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={estimatedGas <= 0n}
              onClick={(e) => {
                setFieldValue(estimatedGas.toString());
              }}
              className={
                {
                  [ThemeColors.GREEN]: "text-green duration-200 hocus:text-green-hover",
                  [ThemeColors.PURPLE]: "text-purple duration-200 hocus:text-purple-hover",
                }[colorScheme]
              }
            >
              {t("estimated")}
            </button>{" "}
            {estimatedGas > 0n ? estimatedGas.toString() : "—"}
          </div>
        }
        inputSize={InputSize.DEFAULT}
      />
      <ErrorsAndWarnings errors={gasLimitErrors} />
    </>
  );
}
