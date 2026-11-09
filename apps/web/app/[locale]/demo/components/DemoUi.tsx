"use client";

import { useLocale, useTranslations } from "next-intl";
import { ReactNode } from "react";

import Svg from "@/components/atoms/Svg";
import { clsxMerge } from "@/functions/clsxMerge";

import { DemoChip, DemoChipButton } from "./DemoChip";

// The one control a step wants clicked. Clicks on anything else inside the stage show the
// "click the highlighted control" toast (see DemoStage).
export const DEMO_TARGET = { "data-demo-target": "" } as const;

export function demoHighlight(active: boolean, purple = false) {
  if (!active) return "";
  return purple
    ? "ring-2 ring-purple ring-offset-2 ring-offset-primary-bg shadow-[0_0_24px_-4px_rgba(165,174,231,0.6)]"
    : "ring-2 ring-green ring-offset-2 ring-offset-primary-bg shadow-[0_0_24px_-4px_rgba(165,231,197,0.6)]";
}

export function useDemoNumber() {
  const locale = useLocale();
  return (value: number, maximumFractionDigits = 1) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
}

export function DemoHint({ step, text, purple }: { step: number; text: string; purple?: boolean }) {
  return (
    <DemoChip
      tone={purple ? "solid-purple" : "solid-success"}
      size="medium"
      className="pl-1 shrink whitespace-normal text-left break-words"
      leading={
        <span className="flex shrink-0 items-center justify-center rounded-full bg-white w-6 h-6 text-12">
          {step}
        </span>
      }
    >
      {text}
    </DemoChip>
  );
}

export function DemoCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsxMerge(
        "w-full max-w-[600px] bg-primary-bg rounded-5 p-4 md:p-5 flex flex-col gap-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DemoDetails({ rows }: { rows: Array<[string, string, string?]> }) {
  return (
    <div className="bg-secondary-bg rounded-3 px-4 py-3 flex flex-col gap-2">
      {rows.map(([label, value, className]) => (
        <div key={label} className="flex justify-between gap-3 text-14">
          <span className="text-secondary-text">{label}</span>
          <span className={clsxMerge("font-medium text-right", className)}>{value}</span>
        </div>
      ))}
    </div>
  );
}

export function DemoBanner({ onExit }: { onExit?: () => void }) {
  const t = useTranslations("Demo");
  return (
    <div className="bg-yellow-bg border-b border-yellow/40">
      <div className="max-w-[1920px] mx-auto px-4 md:px-5 lg:px-10 py-2 min-h-[44px] flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-14 md:text-16">
          <Svg iconName="info" className="text-yellow flex-shrink-0 max-md:hidden" />
          <span className="text-yellow font-medium max-md:hidden">{t("banner_label")}</span>
          <span className="max-md:hidden">{t("banner_text")}</span>
          <span className="md:hidden text-yellow font-medium">{t("banner_text_short")}</span>
        </p>
        {onExit && (
          <DemoChipButton onClick={onExit} size="medium" className="flex-shrink-0 px-4">
            <span className="max-md:hidden">{t("exit")}</span>
            <span className="md:hidden">{t("exit_short")}</span>
          </DemoChipButton>
        )}
      </div>
    </div>
  );
}
