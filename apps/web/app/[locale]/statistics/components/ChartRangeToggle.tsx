"use client";

import clsx from "clsx";

import { ChartRange } from "@/hooks/usePoolPriceChart";

const RANGES: ChartRange[] = [7, 30, 90];

export default function ChartRangeToggle({
  value,
  onChange,
}: {
  value: ChartRange;
  onChange: (days: ChartRange) => void;
}) {
  return (
    <div className="flex gap-1" role="group" aria-label="Chart range">
      {RANGES.map((days) => {
        const selected = value === days;
        return (
          <button
            key={days}
            type="button"
            aria-pressed={selected}
            aria-label={`${days} day chart range`}
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
