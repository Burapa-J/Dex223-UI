import { getTranslations, setRequestLocale } from "next-intl/server";

import Container from "@/components/atoms/Container";
import Svg from "@/components/atoms/Svg";
import LandingSwapPreview from "@/components/landing/LandingSwapPreview";
import { pageMetadata } from "@/config/seo";
import { IconName } from "@/config/types/IconName";
import { clsxMerge } from "@/functions/clsxMerge";
import { formatNumberKilos } from "@/functions/formatFloat";
import { Link, type Locale } from "@/i18n/routing";
import { GATEWAY_SUBGRAPHS } from "@/lib/subgraphTargets";
import { DexChainId } from "@/sdk_bi/chains";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return pageMetadata(locale, "home", "");
}

// Stats are cached for five minutes so the page stays static-fast for crawlers.
export const revalidate = 300;

type ProtocolStats = { tvlUSD: number; volumeUSD: number; poolCount: number; txCount: number };

/**
 * Mainnet protocol totals, from the same subgraph entity the /statistics page reads.
 * Returns null on any failure, or before mainnet has a pool, so the band is hidden
 * rather than advertising zeros or test-network numbers.
 */
async function getProtocolStats(): Promise<ProtocolStats | null> {
  try {
    // Server-side, so it calls the gateway directly with the server-only key.
    if (!process.env.GRAPH_API_KEY) return null;
    const res = await fetch(GATEWAY_SUBGRAPHS["exchange-mainnet"], {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.GRAPH_API_KEY}`,
      },
      body: JSON.stringify({
        query: "{ factories(first: 1) { poolCount txCount totalVolumeUSD totalValueLockedUSD } }",
      }),
      next: { revalidate },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const factory = (await res.json())?.data?.factories?.[0];
    if (!factory) return null;
    const stats = {
      tvlUSD: Number(factory.totalValueLockedUSD) || 0,
      volumeUSD: Number(factory.totalVolumeUSD) || 0,
      poolCount: Number(factory.poolCount) || 0,
      txCount: Number(factory.txCount) || 0,
    };
    return stats.poolCount > 0 ? stats : null;
  } catch {
    return null;
  }
}

// Shared look of the in-app Button, applied to links: a <button> inside an <a> is invalid.
const linkButton = {
  primary:
    "inline-flex items-center justify-center gap-2 min-h-12 px-6 rounded-3 text-16 font-medium bg-green text-black hocus:bg-green-hover duration-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]",
  outlined:
    "inline-flex items-center justify-center gap-2 min-h-12 px-6 rounded-3 text-16 font-medium border border-green text-primary-text hocus:bg-green-bg duration-200",
  light:
    "inline-flex items-center justify-center gap-2 min-h-10 px-4 rounded-2 text-16 font-medium bg-green-bg text-primary-text border border-transparent hocus:border-green duration-200",
};

const FEATURES: {
  key: "swap" | "convert" | "earn" | "margin" | "list" | "launch";
  icon: IconName;
  href: string;
}[] = [
  { key: "swap", icon: "swap", href: "/swap" },
  { key: "convert", icon: "convert", href: "/converter" },
  { key: "earn", icon: "pools", href: "/add" },
  { key: "margin", icon: "margin-trading", href: "/margin-trading" },
  { key: "list", icon: "listing", href: "/token-listing" },
  { key: "launch", icon: "deploy-token", href: "/create-token" },
];

const COMPARISON = ["lost", "approval", "deposit"] as const;
const FAQ = ["what", "need_erc223", "list", "custodial", "fees"] as const;

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Landing" });
  const stats = await getProtocolStats();

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((key) => ({
      "@type": "Question",
      name: t(`faq.${key}.q`),
      acceptedAnswer: { "@type": "Answer", text: t(`faq.${key}.a`) },
    })),
  };

  return (
    <main>
      <script
        type="application/ld+json"
        // Static, server-built JSON from our own message files; no user input reaches it.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero */}
      <section className="bg-[radial-gradient(ellipse_at_70%_20%,#3C4C4A_0%,#1D1E1E_45%,#0F0F0F_100%)]">
        <Container className="grid lg:grid-cols-[1fr_440px] gap-10 lg:gap-[80px] items-center py-12 lg:py-[96px]">
          <div className="flex flex-col gap-6">
            <span className="self-start flex items-center gap-2 rounded-20 border border-green/50 bg-green-bg/40 px-3 py-1 text-12 text-secondary-text">
              <Svg iconName="shield" size={16} className="text-green" />
              {t("hero.eyebrow")}
            </span>
            <h1 className="text-[40px] leading-[48px] lg:text-[64px] lg:leading-[72px] font-bold text-primary-text tracking-[-0.02em]">
              {t("hero.title")}
            </h1>
            <p className="text-16 lg:text-18 text-secondary-text max-w-[540px]">
              {t("hero.subtitle")}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/swap" className={linkButton.primary}>
                {t("cta.launch")}
              </Link>
              <Link href="/guidelines" className={linkButton.outlined}>
                {t("cta.guide")}
              </Link>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-14 text-secondary-text">
              {(["audited", "non_custodial", "open_source"] as const).map((key) => (
                <li key={key} className="flex items-center gap-1.5">
                  <Svg iconName="check" size={16} className="text-green" />
                  {t(`hero.trust.${key}`)}
                </li>
              ))}
            </ul>
          </div>

          <LandingSwapPreview />
        </Container>
      </section>

      {/* Live stats */}
      {stats && (
        <section aria-label={t("stats.label")} className="bg-secondary-bg">
          <Container>
            <dl className="grid grid-cols-2 lg:grid-cols-4 gap-6 py-10">
              {[
                { key: "tvl", value: `$${formatNumberKilos(stats.tvlUSD)}` } as const,
                { key: "volume", value: `$${formatNumberKilos(stats.volumeUSD)}` } as const,
                { key: "pools", value: stats.poolCount.toLocaleString("en-US") } as const,
                { key: "transactions", value: stats.txCount.toLocaleString("en-US") } as const,
              ].map(({ key, value }) => (
                <div key={key} className="flex flex-col-reverse gap-1">
                  <dt className="text-14 text-secondary-text">{t(`stats.${key}`)}</dt>
                  <dd className="text-32 font-bold text-primary-text">{value}</dd>
                </div>
              ))}
            </dl>
          </Container>
        </section>
      )}

      {/* Features */}
      <section className="bg-secondary-bg py-[64px] lg:py-[96px]">
        <Container>
          <h2 className="text-24 lg:text-32 font-bold text-primary-text mb-8 lg:mb-10">
            {t("features.title")}
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            {FEATURES.map(({ key, icon, href }) => (
              <Link
                key={key}
                href={href}
                className="group flex flex-col gap-3 rounded-5 bg-primary-bg p-6 lg:p-7 border border-transparent hocus:border-green-bg duration-200"
              >
                <span className="w-12 h-12 rounded-3 bg-green-bg flex items-center justify-center text-green">
                  <Svg iconName={icon} />
                </span>
                <h3 className="text-20 font-bold text-primary-text">
                  {t(`features.${key}.title`)}
                </h3>
                <p className="text-16 text-secondary-text">{t(`features.${key}.body`)}</p>
                <span className="mt-auto flex items-center gap-1 text-green group-hocus:text-green-hover">
                  {t(`features.${key}.link`)}
                  <Svg iconName="next" size={20} />
                </span>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      {/* Why ERC-223 */}
      <section className="bg-[linear-gradient(100deg,#1D1E1E_0%,#262B28_55%,#3C4C4A_100%)] py-[64px] lg:py-[80px]">
        <Container className="grid lg:grid-cols-2 gap-10 lg:gap-[64px] items-center">
          <div className="flex flex-col gap-4">
            <span className="text-12 uppercase tracking-[0.08em] text-green">
              {t("why.eyebrow")}
            </span>
            <h2 className="text-24 lg:text-32 font-bold text-primary-text">{t("why.title")}</h2>
            <p className="text-16 text-secondary-text">{t("why.body")}</p>
            <a
              href="https://dexaran.github.io/erc20-losses/"
              target="_blank"
              rel="noopener noreferrer"
              className={clsxMerge(linkButton.light, "self-start")}
            >
              {t("why.calculator")}
              <Svg iconName="forward" size={20} />
            </a>
          </div>
          <div className="rounded-5 bg-primary-bg overflow-hidden">
            <table className="w-full text-14">
              <caption className="sr-only">{t("why.table_caption")}</caption>
              <thead className="bg-tertiary-bg text-secondary-text">
                <tr>
                  <th scope="col" className="text-left font-normal px-5 py-3">
                    <span className="sr-only">{t("why.feature")}</span>
                  </th>
                  <th scope="col" className="text-left font-medium px-5 py-3">
                    ERC-20
                  </th>
                  <th scope="col" className="text-left font-medium px-5 py-3">
                    ERC-223
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((key) => (
                  <tr key={key} className="border-t border-secondary-border">
                    <th scope="row" className="text-left font-normal text-secondary-text px-5 py-3">
                      {t(`why.rows.${key}.label`)}
                    </th>
                    <td className="px-5 py-3 text-red-light">{t(`why.rows.${key}.erc20`)}</td>
                    <td className="px-5 py-3 text-green">{t(`why.rows.${key}.erc223`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </section>

      {/* FAQ */}
      <section className="bg-secondary-bg py-[64px] lg:py-[96px]">
        <Container>
          <h2 className="text-24 lg:text-32 font-bold text-primary-text mb-8">{t("faq.title")}</h2>
          <div className="flex flex-col gap-3">
            {FAQ.map((key, i) => (
              <details
                key={key}
                open={i === 0}
                className="group rounded-3 bg-primary-bg px-5 lg:px-6 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex items-center justify-between gap-4 py-5 cursor-pointer list-none text-16 lg:text-18 font-medium text-primary-text">
                  {t(`faq.${key}.q`)}
                  <Svg
                    iconName="expand-arrow"
                    size={20}
                    className="flex-shrink-0 text-tertiary-text duration-200 group-open:rotate-180"
                  />
                </summary>
                <p className="pb-5 -mt-1 text-16 text-secondary-text">{t(`faq.${key}.a`)}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      {/* Final CTA */}
      <section className="bg-[radial-gradient(ellipse_at_50%_120%,#3C4C4A_0%,#0F0F0F_60%)] py-[64px] lg:py-[80px]">
        <Container className="flex flex-col items-center text-center gap-4">
          <h2 className="text-24 lg:text-32 font-bold text-primary-text">{t("final.title")}</h2>
          <p className="text-16 text-secondary-text">{t("final.body")}</p>
          <Link href="/swap" className={clsxMerge(linkButton.primary, "mt-2")}>
            {t("cta.launch")}
          </Link>
        </Container>
      </section>
    </main>
  );
}
