"use client";

import { notFound, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import React, { MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import Container from "@/components/atoms/Container";
import Toast from "@/components/atoms/Toast";
import { useRouter } from "@/i18n/routing";

import CoachPanel from "../components/CoachPanel";
import DemoCompletion from "../components/DemoCompletion";
import { DemoBanner, useDemoNumber } from "../components/DemoUi";
import ConvertStage from "../components/stages/ConvertStage";
import LiquidityStage from "../components/stages/LiquidityStage";
import ListingStage from "../components/stages/ListingStage";
import SwapStage from "../components/stages/SwapStage";
import { StageProps, StageStatus } from "../components/stageTypes";
import { DEMO_SIGNING_MS, DemoFlowId, getDemoFlow } from "../flows";
import { DemoBalances, useHydratedDemoStore } from "../stores/useDemoStore";

const stages: Record<DemoFlowId, React.ComponentType<StageProps>> = {
  swap: SwapStage,
  convert: ConvertStage,
  liquidity: LiquidityStage,
  listing: ListingStage,
};

// Which demo balance an action step spends the typed amount from, if any.
function spendLimit(flow: DemoFlowId, stepKey: string, balances: DemoBalances) {
  if (flow === "swap" && ["choose", "approve", "swap"].includes(stepKey)) {
    return { balance: balances.usdt20, symbol: "USDT (ERC-20)" };
  }
  if (flow === "convert" && ["pick", "convert"].includes(stepKey)) {
    return { balance: balances.usdt20, symbol: "USDT (ERC-20)" };
  }
  if (flow === "convert" && stepKey === "back") {
    return { balance: balances.usdt223, symbol: "USDT (ERC-223)" };
  }
  return null;
}

export default function DemoFlowPage() {
  const params = useParams<{ flow: string }>();
  const flow = getDemoFlow(params.flow);
  if (!flow) notFound();
  return <DemoRunner key={flow.id} flowId={flow.id} />;
}

function DemoRunner({ flowId }: { flowId: DemoFlowId }) {
  const t = useTranslations("Demo");
  const tFlow = useTranslations(`Demo.flows.${flowId}`);
  // Step keys come from flows.ts, which mirrors the message file.
  type FlowKey = Parameters<typeof tFlow>[0];
  const router = useRouter();
  const formatNumber = useDemoNumber();
  const flow = getDemoFlow(flowId)!;
  const { balances, canChangeBalances, changeBalances, completeFlow } = useHydratedDemoStore();

  const [index, setIndex] = useState(0);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<StageStatus>(flow.steps[0].action ? "idle" : "done");
  const [finished, setFinished] = useState(false);
  const [amount, setAmount] = useState("100");
  const [toast, setToast] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const cancelPendingTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => cancelPendingTimers, [cancelPendingTimers]);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const step = flow.steps[index];
  const total = flow.steps.length;

  const goTo = useCallback(
    (next: number) => {
      cancelPendingTimers();
      const target = flow.steps[next];
      setIndex(next);
      setStatus(!target.action || doneSteps.has(next) ? "done" : "idle");
      setToast(null);
      setPulse(false);
    },
    [cancelPendingTimers, doneSteps, flow.steps],
  );

  const limit = status === "idle" ? spendLimit(flowId, step.key, balances) : null;
  const parsedAmount = Number(amount);
  const amountInvalid = !!limit && (!amount || !Number.isFinite(parsedAmount) || parsedAmount <= 0);
  const overBalance = limit && parsedAmount > limit.balance ? limit : null;

  const onAction = useCallback(
    (delta?: Partial<DemoBalances>) => {
      if (status !== "idle" || overBalance) return;
      if (amountInvalid) {
        setToast(t("enter_amount"));
        setPulse(true);
        later(() => setPulse(false), 1000);
        later(() => setToast(null), 3000);
        return;
      }
      if (delta && !canChangeBalances(delta)) return;

      setToast(null);
      setPulse(false);
      const finish = () => {
        // The wallet may have changed while the simulated signature was pending.
        if (delta && !changeBalances(delta)) {
          setStatus("idle");
          return;
        }
        setDoneSteps((prev) => new Set(prev).add(index));
        setStatus("done");
      };
      if (step.sign) {
        setStatus("signing");
        later(finish, DEMO_SIGNING_MS);
      } else {
        finish();
      }
    },
    [
      status,
      overBalance,
      amountInvalid,
      t,
      later,
      step.sign,
      canChangeBalances,
      changeBalances,
      index,
    ],
  );

  const passed = useCallback(
    (key: string) => {
      const i = flow.steps.findIndex((s) => s.key === key);
      return doneSteps.has(i) || (i < index && !flow.steps[i].action);
    },
    [doneSteps, flow.steps, index],
  );

  // Clicks on inert controls inside the stage explain what to click instead.
  const handleStageClick = (e: MouseEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    if (el.closest("[data-demo-target],[data-demo-free]")) return;
    if (!el.closest("button,input,a,[role='button']")) return;
    e.preventDefault();
    e.stopPropagation();
    setToast(step.action && status === "idle" ? t("wrong_click") : t("wrong_click_next"));
    setPulse(true);
    later(() => setPulse(false), 1000);
    later(() => setToast(null), 3000);
  };

  const handleNext = () => {
    if (index < total - 1) {
      goTo(index + 1);
      return;
    }
    completeFlow(flowId);
    setFinished(true);
  };

  const coach = useMemo(() => {
    if (overBalance) {
      const balance = formatNumber(overBalance.balance, 4);
      return {
        title: t("too_high_title"),
        body: t("too_high_body", { balance, symbol: overBalance.symbol }),
        tip: undefined,
      };
    }
    return {
      title: tFlow(`steps.${step.key}.title` as FlowKey),
      body: tFlow(`steps.${step.key}.body` as FlowKey),
      tip: tFlow(`steps.${step.key}.tip` as FlowKey),
    };
  }, [overBalance, step.key, t, tFlow, formatNumber]);

  const Stage = stages[flowId];

  return (
    <>
      <DemoBanner onExit={() => router.push("/demo")} />
      <Container>
        {finished ? (
          <DemoCompletion flow={flow} />
        ) : (
          <div className="py-5 lg:py-10 max-lg:pb-[280px] flex gap-8 items-start">
            <CoachPanel
              flowTitle={tFlow("title")}
              stepNumber={index + 1}
              total={total}
              title={coach.title}
              body={coach.body}
              tip={coach.tip}
              nextLabel={index === total - 1 ? t("finish") : t("next")}
              nextDisabled={status !== "done"}
              onBack={index > 0 ? () => goTo(index - 1) : undefined}
              onNext={handleNext}
            />
            <div
              onClickCapture={handleStageClick}
              className="flex-1 min-w-0 rounded-5 border border-dashed border-secondary-border bg-secondary-bg/50 p-3 sm:p-4 md:p-8 lg:p-4 xl:p-8 flex flex-col items-center gap-3"
            >
              {toast && (
                // Sticks to the top of the stage while scrolling, so it never covers the
                // banner or the coach panel.
                <div
                  data-demo-free=""
                  role="status"
                  className="sticky top-4 z-10 self-stretch md:self-end md:w-[420px] -mb-3 h-0 overflow-visible"
                >
                  <Toast type="warning" text={toast} onDismiss={() => setToast(null)} />
                </div>
              )}
              <p className="text-12 text-tertiary-text text-center">{t("simulated")}</p>
              <Stage
                stepKey={step.key}
                stepNumber={index + 1}
                status={status}
                pulse={pulse}
                balances={balances}
                amount={amount}
                setAmount={setAmount}
                overBalance={overBalance}
                amountInvalid={amountInvalid}
                passed={passed}
                onAction={onAction}
              />
            </div>
          </div>
        )}
      </Container>
    </>
  );
}
