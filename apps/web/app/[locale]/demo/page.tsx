"use client";

import { useTranslations } from "next-intl";
import React, { useState } from "react";

import Container from "@/components/atoms/Container";
import Svg from "@/components/atoms/Svg";
import Button, { ButtonColor, ButtonSize, ButtonVariant } from "@/components/buttons/Button";
import ButtonLink from "@/components/buttons/ButtonLink";
import { Link, useRouter } from "@/i18n/routing";

import { DemoChip } from "./components/DemoChip";
import { DemoTokenLogo } from "./components/DemoTokenBox";
import { DemoBanner, useDemoNumber } from "./components/DemoUi";
import { DEMO_FLOWS, DemoFlow, nextUnfinishedFlow } from "./flows";
import { useHydratedDemoStore } from "./stores/useDemoStore";

const TEST_APP_URL = "https://test-app.dex223.io";

function FlowCard({ flow, completed }: { flow: DemoFlow; completed: boolean }) {
  const t = useTranslations("Demo");
  const router = useRouter();
  return (
    <div className="bg-primary-bg rounded-5 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-green-bg p-3 text-green">
          <Svg iconName={flow.icon} />
        </span>
        {completed && (
          <DemoChip
            tone="success"
            leading={<span aria-hidden className="w-1.5 h-1.5 rounded-full bg-green" />}
          >
            {t("completed")}
          </DemoChip>
        )}
      </div>
      <h2 className="text-18 font-bold">{t(`flows.${flow.id}.title`)}</h2>
      <p className="text-14 text-secondary-text flex-grow">{t(`flows.${flow.id}.description`)}</p>
      <span className="text-12 font-medium text-tertiary-text">{t(`flows.${flow.id}.meta`)}</span>
      <Button
        size={ButtonSize.MEDIUM}
        colorScheme={ButtonColor.LIGHT_GREEN}
        fullWidth
        onClick={() => router.push(`/demo/${flow.id}`)}
      >
        {completed ? t("replay") : t("start")}
      </Button>
    </div>
  );
}

export default function DemoHubPage() {
  const t = useTranslations("Demo");
  const router = useRouter();
  const format = useDemoNumber();
  const { completed, balances, reset } = useHydratedDemoStore();
  const [balancesOpen, setBalancesOpen] = useState(false);

  const next = nextUnfinishedFlow(completed);
  const primary = next ?? DEMO_FLOWS[0];
  const primaryLabel = !next
    ? t("replay_all")
    : completed.length
      ? t("continue_with", { flow: t(`flows.${next.id}.short`) })
      : t("start_with", { flow: t(`flows.${next.id}.short`) });

  const wallet: Array<[string, string, string]> = [
    ["USDT", `${format(balances.usdt20, 4)} USDT`, "ERC-20"],
    ["USDT", `${format(balances.usdt223, 4)} USDT`, "ERC-223"],
    ["ETH", `${format(balances.eth, 4)} ETH`, "Native"],
    ["D223", `${format(balances.d223)} D223`, "ERC-223"],
  ];

  return (
    <>
      <DemoBanner />
      <Container>
        <div className="py-5 md:py-10 flex flex-col gap-6 md:gap-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <nav className="flex gap-2 text-14" aria-label="Breadcrumb">
                <Link href="/guidelines" className="text-secondary-text hocus:text-primary-text">
                  {t("breadcrumb_guidelines")}
                </Link>
                <span className="text-tertiary-text">/</span>
                <span className="font-medium">{t("title")}</span>
              </nav>
              <h1 className="text-24 lg:text-40 font-bold">{t("title")}</h1>
              <p className="text-secondary-text text-14 md:text-16">{t("description")}</p>
            </div>
            <Button size={ButtonSize.LARGE} onClick={() => router.push(`/demo/${primary.id}`)}>
              {primaryLabel}
            </Button>
          </div>

          <div className="bg-primary-bg rounded-5 px-4 md:px-5 py-3 md:py-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-8">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-medium">
                <Svg iconName="wallet" className="text-secondary-text" />
                <span className="md:hidden">{t("wallet_summary", { count: wallet.length })}</span>
                <span className="max-md:hidden">{t("wallet")}</span>
              </span>
              <button
                type="button"
                className="md:hidden text-14 font-medium text-green"
                aria-expanded={balancesOpen}
                onClick={() => setBalancesOpen(!balancesOpen)}
              >
                {t("balances")}
              </button>
            </div>
            <ul
              className={`${balancesOpen ? "flex" : "max-md:hidden flex"} flex-col md:flex-row md:flex-wrap gap-3 md:gap-8`}
            >
              {wallet.map(([symbol, amount, standard]) => (
                <li key={`${symbol}-${standard}`} className="flex items-center gap-2">
                  <DemoTokenLogo symbol={symbol} />
                  <span className="font-medium">{amount}</span>
                  <DemoChip className="min-h-5 px-1.5">{standard}</DemoChip>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={reset}
              className="md:ml-auto self-start md:self-auto text-green hocus:text-green-hover font-medium duration-200"
            >
              {t("reset")}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {DEMO_FLOWS.map((flow) => (
              <FlowCard key={flow.id} flow={flow} completed={completed.includes(flow.id)} />
            ))}
          </div>

          <div className="bg-secondary-bg rounded-5 p-5 flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex flex-col gap-1 flex-grow">
              <h2 className="text-18 font-bold">{t("ready_title")}</h2>
              <p className="text-14 text-secondary-text">{t("ready_text")}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 md:shrink-0">
              <ButtonLink
                href={TEST_APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                size={ButtonSize.MEDIUM}
                variant={ButtonVariant.OUTLINED}
              >
                {t("open_test_app")}
              </ButtonLink>
              <Button
                size={ButtonSize.MEDIUM}
                variant={ButtonVariant.CONTAINED}
                onClick={() => router.push("/swap")}
              >
                {t("go_to_swap")}
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </>
  );
}
