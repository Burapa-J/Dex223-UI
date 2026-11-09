"use client";

import clsx from "clsx";
import { useTranslations } from "next-intl";

import { ChartRange } from "@/hooks/usePoolPriceChart";

const RANGES: ChartRange[] = [7, 30, 90];

export default function ChartRangeToggle({
  value,
  onChange,
}: {
  value: ChartRange;
  onChange: (days: ChartRange) => void;
}) {
  const t = useTranslations("Statistics");

  return (
    <div className="flex gap-1" role="group" aria-label={t("chart_range")}>
      {RANGES.map((days) => {
        const selected = value === days;
        return (
          <button
            key={days}
            type="button"
            aria-pressed={selected}
            aria-label={t("chart_range_days", { days })}
            onClick={() => onChange(days)}
            className={clsx(
              "px-2 h-7 rounded-2 text-12 duration-200",
              selected
                ? "bg-green-bg text-primary-text border border-green"
                : "text-secondary-text hocus:text-primary-text",
            )}
          >
            {days}D
          </button>
        );
      })}
    </div>
  );
}
