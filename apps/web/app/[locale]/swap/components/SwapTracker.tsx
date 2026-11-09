"use client";

import Preloader from "@repo/ui/preloader";
import clsx from "clsx";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { useConfirmSwapDialogStore } from "@/app/[locale]/swap/stores/useConfirmSwapDialogOpened";
import { SwapStatus, useSwapStatusStore } from "@/app/[locale]/swap/stores/useSwapStatusStore";
import { useSwapTrackerStore } from "@/app/[locale]/swap/stores/useSwapTrackerStore";
import Svg from "@/components/atoms/Svg";
import getExplorerLink, { ExplorerLinkType } from "@/functions/getExplorerLink";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { usePathname, useRouter } from "@/i18n/routing";

const AUTO_HIDE_MS = 6000;

type StepState = "idle" | "waiting" | "loading" | "done" | "failed";

function StepIcon({ state }: { state: StepState }) {
  if (state === "waiting" || state === "loading") return <Preloader size={20} />;
  if (state === "done") return <Svg iconName="check" size={20} className="text-green" />;
  if (state === "failed") return <Svg iconName="warning" size={20} className="text-red-light" />;
  return <span className="w-5 h-5 rounded-full border-2 border-secondary-border block" />;
}

function Step({ label, hint, state }: { label: string; hint?: string; state: StepState }) {
  return (
    <div className="flex items-center gap-3 min-h-10">
      <span className="w-6 h-6 flex items-center justify-center flex-shrink-0">
        <StepIcon state={state} />
      </span>
      <span
        className={clsx(
          "text-14 flex-grow",
          state === "idle" ? "text-tertiary-text" : "text-primary-text",
        )}
      >
        {label}
      </span>
      {hint && <span className="text-12 text-tertiary-text whitespace-nowrap">{hint}</span>}
    </div>
  );
}

function PairLogos({ logoA, logoB }: { logoA?: string; logoB?: string }) {
  return (
    <span className="flex flex-shrink-0">
      <Image
        src={logoA || "/images/tokens/placeholder.svg"}
        alt=""
        width={28}
        height={28}
        className="rounded-full bg-primary-bg"
      />
      <Image
        src={logoB || "/images/tokens/placeholder.svg"}
        alt=""
        width={28}
        height={28}
        className="rounded-full bg-primary-bg -ml-2"
      />
    </span>
  );
}

/**
 * Compact, non-blocking view of a swap whose review dialog was closed mid-flow. Sits in the
 * bottom-right corner on every page; clicking it reopens the full review dialog.
 */
export default function SwapTracker() {
  const t = useTranslations("Swap");
  const chainId = useCurrentChainId();
  const router = useRouter();
  const pathname = usePathname();

  const { snapshot, startedAt, hide } = useSwapTrackerStore();
  const { status, swapHash, approveHash, setStatus, isReceiptUnavailable } = useSwapStatusStore();
  const { setIsOpen: setConfirmOpen } = useConfirmSwapDialogStore();
  const [finishedIn, setFinishedIn] = useState<number | null>(null);

  const isSuccess = status === SwapStatus.SUCCESS;
  const isFailed = status === SwapStatus.ERROR || status === SwapStatus.APPROVE_ERROR;

  // Reset the shared swap state once the tracker is gone, the way closing the dialog would.
  const dismiss = () => {
    hide();
    setFinishedIn(null);
    if (isSuccess || isFailed || isReceiptUnavailable) setStatus(SwapStatus.INITIAL);
  };

  useEffect(() => {
    if (!snapshot) return;
    // Rejected in the wallet: the flow went back to the start, nothing left to track.
    if (status === SwapStatus.INITIAL) {
      hide();
      setFinishedIn(null);
      return;
    }
    if (isSuccess && finishedIn === null) {
      setFinishedIn(Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
    }
  }, [snapshot, status, isSuccess, finishedIn, startedAt, hide]);

  useEffect(() => {
    if (!snapshot || !isSuccess) return;
    const timer = setTimeout(() => {
      hide();
      setFinishedIn(null);
      setStatus(SwapStatus.INITIAL);
    }, AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [snapshot, isSuccess, hide, setStatus]);

  if (!snapshot) return null;

  const reopen = () => {
    hide();
    setFinishedIn(null);
    setConfirmOpen(true);
    if (!pathname.endsWith("/swap")) router.push("/swap");
  };

  const container =
    "fixed z-[86] right-4 left-4 bottom-[80px] md:left-auto md:right-6 md:bottom-6 md:w-[400px] rounded-3 bg-primary-bg border border-secondary-border shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)]";

  if (isSuccess) {
    return (
      <div role="status" className={clsx(container, "p-4 flex items-center gap-3")}>
        <span className="w-10 h-10 rounded-full bg-green-bg flex items-center justify-center flex-shrink-0">
          <Svg iconName="check" className="text-green" />
        </span>
        <div className="flex flex-col flex-grow min-w-0">
          <span className="text-16 text-primary-text break-words">
            {t("tracker_swapped", {
              amountIn: snapshot.amountIn,
              symbolA: snapshot.symbolA,
              amountOut: snapshot.amountOut,
              symbolB: snapshot.symbolB,
            })}
          </span>
          <span className="text-12 text-tertiary-text">
            {t("tracker_received", { seconds: finishedIn ?? 1 })}
          </span>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("tracker_hide")}
          className="text-tertiary-text hocus:text-primary-text duration-200 flex-shrink-0"
        >
          <Svg iconName="close" size={20} />
        </button>
      </div>
    );
  }

  const approveState: StepState = (() => {
    switch (status) {
      case SwapStatus.PENDING_APPROVE:
        return "waiting";
      case SwapStatus.LOADING_APPROVE:
        return "loading";
      case SwapStatus.APPROVE_ERROR:
        return "failed";
      default:
        return "done";
    }
  })();

  const swapState: StepState = (() => {
    switch (status) {
      case SwapStatus.PENDING:
        return "waiting";
      case SwapStatus.LOADING:
        return "loading";
      case SwapStatus.ERROR:
        return "failed";
      default:
        return "idle";
    }
  })();

  const steps = snapshot.withApprove ? 2 : 1;
  const progress = (() => {
    const swapProgress =
      status === SwapStatus.PENDING ? 0.25 : status === SwapStatus.LOADING ? 0.65 : 0;
    if (!snapshot.withApprove) return swapProgress || 0.1;
    if (status === SwapStatus.PENDING_APPROVE) return 0.1;
    if (status === SwapStatus.LOADING_APPROVE) return 0.3;
    return 1 / steps + swapProgress / steps;
  })();

  const activeHash = swapHash || approveHash;
  const hintFor = (state: StepState) =>
    state === "waiting" ? t("waiting_for_confirmation") : undefined;

  return (
    <div role="status" className={clsx(container, "p-4")}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={reopen}
          className="flex items-center gap-2 flex-grow min-w-0 text-left"
          aria-label={t("tracker_reopen")}
        >
          <PairLogos logoA={snapshot.logoA} logoB={snapshot.logoB} />
          <span
            className={clsx("text-16 truncate", isFailed ? "text-red-light" : "text-primary-text")}
          >
            {isFailed
              ? t("swap_failed")
              : t("tracker_swapping", {
                  amountIn: snapshot.amountIn,
                  symbolA: snapshot.symbolA,
                  symbolB: snapshot.symbolB,
                })}
          </span>
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("tracker_hide")}
          className="text-tertiary-text hocus:text-primary-text duration-200 flex-shrink-0"
        >
          <Svg iconName="close" size={20} />
        </button>
      </div>

      {!isFailed && (
        <div
          className="h-1 rounded-full bg-tertiary-bg mt-3 overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            className="h-full bg-green rounded-full transition-[width] duration-500"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}

      <div className="mt-2">
        {snapshot.withApprove && (
          <Step
            label={t("tracker_approve_step", { symbol: snapshot.symbolA })}
            hint={hintFor(approveState)}
            state={approveState}
          />
        )}
        <Step label={t("tracker_swap_step")} hint={hintFor(swapState)} state={swapState} />
      </div>

      <div className="flex items-center justify-between mt-1 text-12">
        {isFailed ? (
          <button type="button" onClick={reopen} className="text-green hocus:text-green-hover">
            {t("tracker_failed_details")}
          </button>
        ) : (
          <span className="text-tertiary-text">{t("tracker_eta")}</span>
        )}
        {activeHash && (
          <a
            href={getExplorerLink(ExplorerLinkType.TRANSACTION, activeHash, chainId)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green hocus:text-green-hover"
          >
            {t("tracker_explorer")}
          </a>
        )}
      </div>
    </div>
  );
}
