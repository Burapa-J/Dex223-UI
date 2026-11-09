"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import Svg from "@/components/atoms/Svg";
import Button, { ButtonColor, ButtonSize } from "@/components/buttons/Button";
import { clsxMerge } from "@/functions/clsxMerge";

import { DemoChip } from "./DemoChip";

type Props = {
  flowTitle: string;
  stepNumber: number;
  total: number;
  title: string;
  body: string;
  tip?: string;
  nextLabel: string;
  nextDisabled: boolean;
  onBack?: () => void;
  onNext: () => void;
};

function Progress({ stepNumber, total }: { stepNumber: number; total: number }) {
  return (
    <div className="flex gap-1" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={clsxMerge(
            "h-2 rounded-5",
            i + 1 === stepNumber ? "w-6" : "w-2",
            i + 1 <= stepNumber ? "bg-green" : "bg-tertiary-bg",
          )}
        />
      ))}
    </div>
  );
}

function CoachTip({ children }: { children: string }) {
  return (
    <p className="flex gap-2 rounded-3 bg-green-bg p-3 text-14">
      <Svg iconName="check" size={20} className="text-green flex-shrink-0" />
      {children}
    </p>
  );
}

function Actions({
  nextLabel,
  nextDisabled,
  onBack,
  onNext,
}: Omit<Props, "flowTitle" | "stepNumber" | "total" | "title" | "body" | "tip">) {
  const t = useTranslations("Demo");
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        size={ButtonSize.MEDIUM}
        colorScheme={ButtonColor.LIGHT_GREEN}
        disabled={!onBack}
        onClick={onBack}
      >
        {t("back")}
      </Button>
      <Button size={ButtonSize.MEDIUM} disabled={nextDisabled} onClick={onNext}>
        {nextLabel}
      </Button>
    </div>
  );
}

// Desktop: a card beside the simulated screen. Below lg: a bottom sheet above the app's
// fixed mobile bar, collapsible to its title row.
export default function CoachPanel(props: Props) {
  const t = useTranslations("Demo");
  const { flowTitle, stepNumber, total, title, body, tip } = props;
  const [collapsed, setCollapsed] = useState(false);
  const mobileCoachRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const coach = mobileCoachRef.current;
    if (!coach) return;

    let frame: number | undefined;
    const keepTargetVisible = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const target = document.querySelector<HTMLElement>("[data-demo-target]");
        if (!target || !coach.getClientRects().length) return;

        const targetRect = target.getBoundingClientRect();
        const coachTop = coach.getBoundingClientRect().top;
        const gap = 16;

        if (targetRect.top < gap) {
          window.scrollBy({ top: targetRect.top - gap, behavior: "auto" });
        } else if (targetRect.bottom > coachTop - gap) {
          window.scrollBy({ top: targetRect.bottom - coachTop + gap, behavior: "auto" });
        }
      });
    };

    keepTargetVisible();
    window.addEventListener("resize", keepTargetVisible);
    const observer =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(keepTargetVisible);
    observer?.observe(coach);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", keepTargetVisible);
      observer?.disconnect();
    };
  }, [collapsed, stepNumber]);

  return (
    <>
      <aside
        aria-live="polite"
        className="max-lg:hidden w-[320px] xl:w-[400px] flex-shrink-0 sticky top-5 bg-primary-bg rounded-5 p-5 flex flex-col gap-4 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-14 font-medium text-secondary-text">{flowTitle}</span>
          <DemoChip>{t("step_of", { current: stepNumber, total })}</DemoChip>
        </div>
        <h2 className="text-20 font-bold">{title}</h2>
        <p className="text-secondary-text">{body}</p>
        {tip && <CoachTip>{tip}</CoachTip>}
        <Progress stepNumber={stepNumber} total={total} />
        <Actions {...props} />
      </aside>

      <aside
        ref={mobileCoachRef}
        aria-live="polite"
        className="lg:hidden fixed inset-x-0 bottom-[64px] md:bottom-0 z-[86] max-h-[calc(100dvh-64px)] md:max-h-[100dvh] overflow-y-auto overscroll-contain bg-primary-bg rounded-t-5 px-4 pt-2 pb-4 flex flex-col gap-3 shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.8)]"
      >
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex flex-col items-center gap-2 w-full"
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("show_coach") : t("hide_coach")}
        >
          <span className="h-1 w-10 rounded-5 bg-tertiary-bg" />
          <span className="flex w-full items-center justify-between gap-3 text-left">
            <span className="text-18 font-bold">{title}</span>
            <DemoChip>{t("step_short", { current: stepNumber, total })}</DemoChip>
          </span>
        </button>
        {!collapsed && (
          <>
            <p className="text-14 text-secondary-text">{body}</p>
            {tip && <CoachTip>{tip}</CoachTip>}
            <Actions {...props} />
          </>
        )}
      </aside>
    </>
  );
}
