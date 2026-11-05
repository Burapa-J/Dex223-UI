"use client";

import clsx from "clsx";
import { useTranslations } from "next-intl";

import Container from "@/components/atoms/Container";
import { Link, usePathname } from "@/i18n/routing";

const TABS = [
  { href: "/statistics", key: "tab_overview" as const, match: (p: string) => p === "/statistics" },
  {
    href: "/statistics/tokens",
    key: "tab_tokens" as const,
    match: (p: string) => p.startsWith("/statistics/tokens"),
  },
  {
    href: "/statistics/pools",
    key: "tab_pools" as const,
    match: (p: string) => p.startsWith("/statistics/pools"),
  },
];

export default function StatisticsShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Statistics");
  const pathname = usePathname();

  return (
    <Container>
      <div className="md:py-5 py-4">
        <h1 className="mb-2 text-24 lg:text-40">{t("title")}</h1>
        <p className="text-secondary-text text-14 md:text-16 mb-4">{t("description")}</p>

        <div
          role="tablist"
          aria-label={t("title")}
          className="grid grid-cols-3 bg-secondary-bg p-1 gap-1 rounded-3 mb-5 max-w-md"
        >
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                role="tab"
                aria-selected={active}
                className={clsx(
                  "flex items-center justify-center h-10 rounded-2 text-14 lg:text-16 border duration-200",
                  active
                    ? "text-primary-text border-green bg-green-bg pointer-events-none"
                    : "text-secondary-text border-transparent bg-primary-bg hocus:bg-green-bg",
                )}
              >
                {t(tab.key)}
              </Link>
            );
          })}
        </div>

        {children}
      </div>
    </Container>
  );
}
