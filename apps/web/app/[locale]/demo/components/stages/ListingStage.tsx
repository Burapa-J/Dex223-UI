"use client";

import { useTranslations } from "next-intl";

import { clsxMerge } from "@/functions/clsxMerge";

import DemoAction from "../DemoAction";
import { DemoChip } from "../DemoChip";
import { DemoTokenLogo } from "../DemoTokenBox";
import { DEMO_TARGET, DemoCard, DemoDetails, demoHighlight, DemoHint } from "../DemoUi";
import { StageProps } from "../stageTypes";

const ORDERS = [
  { id: 7, offers: "2,500 USDT", interest: 12, leverage: "3x", days: 14 },
  { id: 12, offers: "10,000 USDT", interest: 8, leverage: "5x", days: 30 },
  { id: 19, offers: "800 USDT", interest: 15, leverage: "2x", days: 7 },
];

export default function ListingStage(props: StageProps) {
  const { stepKey, stepNumber, status, pulse, passed, onAction } = props;
  const tf = useTranslations("Demo.flows.listing");

  if (["token", "contract", "list"].includes(stepKey)) {
    const pickingList = stepKey === "contract" && status === "idle";
    const freePicked = passed("contract");
    const lists = [
      { key: "free", title: tf("free_list"), text: tf("free_list_text") },
      { key: "paid", title: tf("paid_list"), text: tf("paid_list_text") },
    ];
    return (
      <DemoCard>
        <h3 className="text-20 font-bold">{tf("token_card")}</h3>
        <div className="bg-secondary-bg rounded-3 p-4 flex flex-wrap items-center gap-3">
          <DemoTokenLogo symbol="DEMO" size={32} />
          <div className="flex min-w-0 flex-1 flex-col break-words">
            <span className="font-medium">{tf("demo_token")}</span>
            <span className="text-12 text-secondary-text">{tf("demo_token_name")}</span>
          </div>
          <DemoChip tone="success" className="ml-auto">
            {tf("pool_exists")}
          </DemoChip>
        </div>
        <span className="text-secondary-text font-medium">{tf("contracts")}</span>
        <div className="grid sm:grid-cols-2 gap-2">
          {lists.map((list) => {
            const isTarget = pickingList && list.key === "free";
            const isSelected = freePicked && list.key === "free";
            return (
              <button
                key={list.key}
                type="button"
                {...(isTarget ? DEMO_TARGET : {})}
                onClick={isTarget ? () => onAction() : undefined}
                aria-pressed={isSelected}
                className={clsxMerge(
                  "text-left rounded-3 p-3 border duration-200",
                  isSelected ? "bg-green-bg border-green" : "bg-secondary-bg border-transparent",
                  demoHighlight(isTarget),
                  isTarget && pulse && "animate-pulse",
                )}
              >
                <span className="block font-medium">{list.title}</span>
                <span className="block text-12 text-secondary-text">{list.text}</span>
              </button>
            );
          })}
        </div>
        {pickingList && (
          <div className="flex justify-end max-sm:hidden">
            <DemoHint step={stepNumber} text={tf("steps.contract.hint")} />
          </div>
        )}
        {passed("list") ? (
          <p className="rounded-3 bg-green-bg text-green p-3 text-center font-medium">
            {tf("listed")}
          </p>
        ) : (
          <DemoAction
            label={tf("list_button")}
            isTarget={stepKey === "list"}
            status={status}
            pulse={pulse}
            stepNumber={stepNumber}
            hint={tf("steps.list.hint")}
            onClick={() => onAction()}
          />
        )}
      </DemoCard>
    );
  }

  if (stepKey === "watch") {
    return (
      <DemoCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-20 font-bold">{tf("position")}</h3>
          <DemoChip tone="purple">{tf("status_open")}</DemoChip>
        </div>
        <DemoDetails
          rows={[
            [tf("position_size"), "~7,500 USDT"],
            [tf("borrowed"), "5,000 USDT"],
            [tf("your_collateral"), tf("collateral_value")],
            [tf("pnl"), "+42.10 USDT", "text-green"],
            [tf("accrued"), "1.30 USDT"],
            [tf("expected_balance"), "5,001.30 USDT"],
            [tf("health"), "1.51", "text-green"],
          ]}
        />
      </DemoCard>
    );
  }

  const pickingOrder = stepKey === "order" && status === "idle";
  const orderPicked = passed("order");
  const order = ORDERS[1];

  return (
    <DemoCard>
      <h3 className="text-20 font-bold">{tf("orders")}</h3>
      <div className="flex flex-col gap-2">
        {ORDERS.map((o) => {
          const isTarget = pickingOrder && o.id === 12;
          const isSelected = orderPicked && o.id === 12;
          return (
            <button
              key={o.id}
              type="button"
              {...(isTarget ? DEMO_TARGET : {})}
              onClick={isTarget ? () => onAction() : undefined}
              aria-pressed={isSelected}
              className={clsxMerge(
                "grid grid-cols-2 sm:grid-cols-4 gap-2 text-left rounded-3 p-3 border duration-200 text-14",
                isSelected ? "bg-purple-bg border-purple" : "bg-secondary-bg border-transparent",
                demoHighlight(isTarget, true),
                isTarget && pulse && "animate-pulse",
              )}
            >
              <span className="font-medium">{tf("order", { id: o.id })}</span>
              <span>{o.offers}</span>
              <span className="text-secondary-text">
                {tf("interest_value", { value: o.interest })}
              </span>
              <span className="text-secondary-text">
                {o.leverage} · {tf("term_value", { days: o.days })}
              </span>
            </button>
          );
        })}
      </div>
      {pickingOrder && (
        <div className="flex justify-end max-sm:hidden">
          <DemoHint step={stepNumber} text={tf("steps.order.hint")} purple />
        </div>
      )}
      {orderPicked && (
        <>
          <DemoDetails
            rows={[
              [tf("offers"), order.offers],
              [tf("interest"), tf("interest_value", { value: order.interest })],
              [tf("max_leverage"), order.leverage],
              [tf("term"), tf("term_value", { days: order.days })],
              [tf("collateral"), "ETH, USDT, D223"],
            ]}
          />
          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              <span className="text-secondary-text font-medium">{tf("leverage")}</span>
              <span className="text-purple font-medium">3x</span>
            </div>
            <div className="h-2 rounded-5 bg-tertiary-bg">
              <div className="h-2 w-3/5 rounded-5 bg-purple" />
            </div>
          </div>
          <DemoDetails
            rows={[
              [tf("your_collateral"), tf("collateral_value")],
              [tf("position_size"), "~7,500 USDT"],
              [tf("expected_at_term", { days: 30 }), "5,400 USDT"],
            ]}
          />
          <DemoAction
            purple
            label={tf("open_button")}
            isTarget={stepKey === "open"}
            status={status}
            pulse={pulse}
            stepNumber={stepNumber}
            hint={tf("steps.open.hint")}
            onClick={() => onAction()}
          />
        </>
      )}
    </DemoCard>
  );
}
