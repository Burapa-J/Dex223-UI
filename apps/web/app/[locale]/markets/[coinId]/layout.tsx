import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PropsWithChildren } from "react";

import { MARKET_API_URL } from "@/components/trading-chart/datafeed/marketApi";
import { pageMetadata } from "@/config/seo";
import { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; coinId: string }>;
}): Promise<Metadata> {
  const p = await params;
  const metadata = await pageMetadata(p.locale, "markets", `markets/${p.coinId}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${MARKET_API_URL}/v1/coins/${encodeURIComponent(p.coinId)}`, {
      signal: controller.signal,
      next: { revalidate: 60 },
    });
    if (!response.ok) return metadata;
    const coin = (await response.json()) as { name?: unknown; symbol?: unknown };
    if (typeof coin.name !== "string" || typeof coin.symbol !== "string" || !coin.name) {
      return metadata;
    }
    const t = await getTranslations({ locale: p.locale, namespace: "Markets" });
    const title = t("coin_title", { name: coin.name, symbol: coin.symbol });
    const description = t("coin_description", { name: coin.name });
    return {
      ...metadata,
      title,
      description,
      openGraph: { ...metadata.openGraph, title, description },
      twitter: { ...metadata.twitter, title, description },
    };
  } catch {
    return metadata;
  } finally {
    clearTimeout(timeout);
  }
}

export default function Layout({ children }: PropsWithChildren) {
  return children;
}
