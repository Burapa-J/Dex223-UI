"use client";

import { useTranslations } from "next-intl";

import Button, { ButtonColor, ButtonSize } from "@/components/buttons/Button";
import { clsxMerge } from "@/functions/clsxMerge";

import { DEMO_TARGET, demoHighlight, DemoHint } from "./DemoUi";
import { StageStatus } from "./stageTypes";

// The big action button at the bottom of a simulated card. It is the click target while
// `isTarget` is set; otherwise it is an inert copy of the live button.
export default function DemoAction({
  label,
  isTarget,
  status,
  pulse,
  stepNumber,
  hint,
  onClick,
  disabledLabel,
  purple,
}: {
  label: string;
  isTarget: boolean;
  status: StageStatus;
  pulse: boolean;
  stepNumber: number;
  hint?: string;
  onClick: () => void;
  // Shown instead of the label (and the button disabled) while the amount is not valid.
  disabledLabel?: string | null;
  purple?: boolean;
}) {
  const t = useTranslations("Demo");
  const active = isTarget && status === "idle" && !disabledLabel;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Button
        type="button"
        fullWidth
        size={ButtonSize.LARGE}
        colorScheme={purple ? ButtonColor.PURPLE : ButtonColor.GREEN}
        disabled={!!disabledLabel}
        isLoading={isTarget && status === "signing"}
        onClick={active ? onClick : undefined}
        {...(active ? DEMO_TARGET : {})}
        className={clsxMerge(
          demoHighlight(active, purple),
          active && pulse && "animate-pulse",
          // An inert copy of the live button: visible, but clearly not the thing to click.
          !isTarget && !disabledLabel && "opacity-50",
        )}
      >
        {disabledLabel ?? (isTarget && status === "signing" ? t("signing") : label)}
      </Button>
      {active && hint && (
        <span className="max-sm:hidden self-end max-w-full">
          <DemoHint step={stepNumber} text={hint} purple={purple} />
        </span>
      )}
    </div>
  );
}
