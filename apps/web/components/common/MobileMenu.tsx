import clsx from "clsx";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useSwipeable } from "react-swipeable";
import { formatGwei } from "viem";

import { IS_SAFE_SEND_LISTED } from "@/app/[locale]/send/config";
import Collapse from "@/components/atoms/Collapse";
import Drawer from "@/components/atoms/Drawer";
import LocaleSwitcher from "@/components/atoms/LocaleSwitcher";
import Svg from "@/components/atoms/Svg";
import Badge from "@/components/badges/Badge";
import Button, { ButtonColor, ButtonSize } from "@/components/buttons/Button";
import IconButton, { IconButtonSize } from "@/components/buttons/IconButton";
import { useFeedbackDialogStore } from "@/components/dialogs/stores/useFeedbackDialogStore";
import { IconName } from "@/config/types/IconName";
import { clsxMerge } from "@/functions/clsxMerge";
import { formatFloat } from "@/functions/formatFloat";
import getExplorerLink, { ExplorerLinkType } from "@/functions/getExplorerLink";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { isBorrowLendComingSoon } from "@/hooks/useIsMarginAvailable";
import { Link, usePathname } from "@/i18n/routing";
import { useGlobalBlockNumber } from "@/shared/hooks/useGlobalBlockNumber";
import { useGlobalFees } from "@/shared/hooks/useGlobalFees";
import { useManageTokensDialogStore } from "@/stores/useManageTokensDialogStore";

/** Exact-or-prefix route match: "/pools" matches "/pools" and "/pools/x", not "/statistics/pools". */
export function isRouteActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

// The Rewards app is served on this domain only when next.config.js rewrites /rewards to
// REWARDS_ORIGIN. Without that rewrite the link 404s, so next.config.js derives
// NEXT_PUBLIC_REWARDS_ENABLED from REWARDS_ORIGIN and the link follows the route.
export const IS_REWARDS_ENABLED = process.env.NEXT_PUBLIC_REWARDS_ENABLED === "true";

export function MobileLink({
  href,
  iconName,
  title,
  handleClose,
  isActive,
  disabled = false,
  className = "",
  linkClassName = "",
  handleClick,
  isMenu = false,
  isExternal = false,
  openInNewTab,
  comingSoon = false,
}: {
  href: string;
  iconName: IconName;
  title: string;
  handleClose: () => void;
  isActive?: boolean;
  disabled?: boolean;
  className?: string;
  linkClassName?: string;
  handleClick?: (e: any) => void;
  isMenu?: boolean;
  isExternal?: boolean;
  /** Defaults to true when isExternal. Set false for first-party sites like blog.dex223.io. */
  openInNewTab?: boolean;
  comingSoon?: boolean;
}) {
  const t = useTranslations("Navigation");
  const shouldOpenInNewTab = openInNewTab ?? isExternal;

  if (isExternal) {
    return (
      <a
        target={shouldOpenInNewTab ? "_blank" : undefined}
        rel={shouldOpenInNewTab ? "noopener noreferrer" : undefined}
        onClick={(e) => {
          if (handleClick) {
            handleClick(e);
          }

          handleClose();
        }}
        href={href}
        className={clsxMerge(
          "flex items-center gap-2 py-3 px-4 duration-200",
          !isActive && "hocus:bg-quaternary-bg text-secondary-text",
          isActive && !isMenu && "text-green pointer-events-none",
          isActive && isMenu && "bg-navigation-active-mobile text-green pointer-events-none",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
      >
        <Svg iconName={iconName} />
        <span className="flex-grow">{title}</span>
        {shouldOpenInNewTab ? (
          <Svg iconName="forward" size={16} className="text-tertiary-text shrink-0" />
        ) : null}
      </a>
    );
  }

  if (disabled) {
    return (
      <div className={clsx("flex items-center gap-2", className)}>
        <span
          aria-disabled="true"
          className={clsxMerge(
            "flex items-center gap-2 py-3 px-4 flex-grow text-secondary-text opacity-50 cursor-default",
            linkClassName,
          )}
        >
          <Svg iconName={iconName} />
          {title}
        </span>
        {comingSoon && <Badge color="green_outline" text={t("coming_soon")} />}
      </div>
    );
  }

  return (
    <div className={clsx("flex items-center gap-2", className)}>
      <Link
        onClick={(e) => {
          if (handleClick) {
            handleClick(e);
          }

          handleClose();
        }}
        href={href}
        className={clsxMerge(
          "flex items-center gap-2 py-3 px-4 duration-200 flex-grow",
          !isActive && "hocus:bg-quaternary-bg text-secondary-text",
          isActive && !isMenu && "text-green pointer-events-none",
          isActive && isMenu && "bg-navigation-active-mobile text-green pointer-events-none",
          linkClassName,
        )}
      >
        <Svg iconName={iconName} />
        {title}
      </Link>
      {comingSoon && <Badge color="green_outline" text={t("coming_soon")} />}
    </div>
  );
}

function NavigationInternalLink({ href, text }: { href: string; text: string }) {
  return (
    <Link className="text-green hocus:text-green-hover duration-200 inline-block py-1" href={href}>
      {text}
    </Link>
  );
}

function NavigationExternalLink({ href, text }: { href: string; text: string }) {
  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        "text-secondary-text hocus:text-primary-text duration-200 inline-flex items-center gap-2 py-1.5",
        href === "#" && "opacity-50 pointer-events-none",
      )}
      href={href}
    >
      <span className="flex-grow">{text}</span>
      <Svg iconName="forward" size={16} className="text-tertiary-text shrink-0" />
    </a>
  );
}

function NavigationExternalLinksContainer({
  title,
  links,
}: {
  title: string;
  links: { href: string; text: string; internal?: boolean }[];
}) {
  return (
    <div className="text-primary-text">
      <div className="text-12 uppercase tracking-[0.06em] text-tertiary-text mb-1">{title}</div>
      <div className="flex flex-col">
        {links.map((link) => {
          if (link.internal) {
            return <NavigationInternalLink key={link.text} href={link.href} text={link.text} />;
          }
          return <NavigationExternalLink key={link.text} href={link.href} text={link.text} />;
        })}
      </div>
    </div>
  );
}

const mobileLinks: {
  href: string;
  iconName: IconName;
  title: any;
  marginOnly?: boolean;
  plain?: boolean;
}[] = [
  {
    href: "/swap",
    iconName: "swap",
    title: "swap",
  },
  {
    href: "/margin-swap",
    iconName: "margin-trading",
    title: "margin_trading",
    marginOnly: true,
  },
  {
    href: "/buy-crypto",
    iconName: "fiat",
    title: "buy_crypto",
  },
  {
    href: "/pools",
    iconName: "pools",
    title: "pools",
  },
  {
    href: "/margin-trading",
    iconName: "borrow",
    title: "borrow_lend",
    marginOnly: true,
  },
  {
    href: "/portfolio",
    iconName: "portfolio",
    title: "portfolio",
  },
  {
    href: "/token-listing",
    iconName: "listing",
    title: "token_listing",
  },
  // Served by the DEX223 Rewards app on this domain (next.config.js rewrites).
  // Only listed when NEXT_PUBLIC_REWARDS_ENABLED === "true"; see IS_REWARDS_ENABLED.
  ...(IS_REWARDS_ENABLED
    ? [
        {
          href: "/rewards",
          iconName: "star" as IconName,
          title: "rewards",
          plain: true,
        },
      ]
    : []),
];

type SocialLink = {
  titleKey:
    | "social_telegram_announcements"
    | "social_telegram_discussions"
    | "social_x_account"
    | "social_dex_x_account"
    | "social_discord";
  href: string;
  icon: Extract<IconName, "telegram" | "x" | "discord">;
};

const socialLinks: SocialLink[] = [
  {
    titleKey: "social_telegram_announcements",
    href: "https://t.me/Dex_223",
    icon: "telegram",
  },
  {
    titleKey: "social_telegram_discussions",
    href: "https://t.me/Dex223_defi",
    icon: "telegram",
  },
  {
    titleKey: "social_x_account",
    href: "https://x.com/Dex_223",
    icon: "x",
  },
  {
    titleKey: "social_dex_x_account",
    href: "https://x.com/Dexaran",
    icon: "x",
  },
  {
    titleKey: "social_discord",
    href: "https://discord.gg/t5bdeGC5Jk",
    icon: "discord",
  },
];
export default function MobileMenu() {
  const t = useTranslations("Navigation");
  const locale = useLocale();
  const tFeedback = useTranslations("Feedback");
  const tA11y = useTranslations("A11y");

  const [mobileMenuOpened, setMobileMenuOpened] = useState(false);
  const [moreOpened, setMoreOpened] = useState(false);
  const pathname = usePathname();
  const borrowLendComingSoon = isBorrowLendComingSoon();
  const { setIsOpen: setOpenFeedbackDialog } = useFeedbackDialogStore();
  const openTokenLists = useManageTokensDialogStore((state) => state.openTokenLists);

  const handlers = useSwipeable({
    onSwipedLeft: (eventData) => {
      setMobileMenuOpened(false);
    },
  });

  const tFooter = useTranslations("Footer");

  const chainId = useCurrentChainId();

  const { gasPrice } = useGlobalFees();
  const { blockNumber } = useGlobalBlockNumber();

  return (
    <div className="xl:hidden">
      <Drawer
        handlers={handlers}
        placement="left"
        isOpen={mobileMenuOpened}
        setIsOpen={setMobileMenuOpened}
      >
        <div className="flex flex-col justify-between h-full min-w-[300px]">
          <div className="py-6 grid gap-1">
            {[
              mobileLinks.map(({ href, iconName, title, marginOnly, plain }) => {
                return (
                  <MobileLink
                    isMenu
                    key={href}
                    href={plain ? `${href}/${locale}` : href}
                    isExternal={plain}
                    openInNewTab={false}
                    iconName={iconName}
                    title={t(title)}
                    handleClose={() => setMobileMenuOpened(false)}
                    isActive={isRouteActive(pathname, href)}
                    disabled={marginOnly && borrowLendComingSoon}
                    comingSoon={marginOnly && borrowLendComingSoon}
                    className={marginOnly && borrowLendComingSoon ? "justify-between pr-4" : ""}
                  />
                );
              }),
            ]}
            <div>
              <button
                onClick={() => setMoreOpened(!moreOpened)}
                className={clsx(
                  "flex w-full items-center justify-between py-3 px-4 hocus:text-green duration-200 text-secondary-text",
                  moreOpened && "bg-navigation-active-mobile text-green",
                )}
              >
                <span className="flex gap-2">
                  <Svg iconName="more" />
                  {t("more")}
                </span>
                <Svg
                  className={clsx(moreOpened && "-rotate-180", "duration-200")}
                  iconName="small-expand-arrow"
                />
              </button>
              <Collapse open={moreOpened}>
                <div className="py-2 border-b border-secondary-border">
                  <div className="px-4 pb-1 text-12 uppercase tracking-[0.06em] text-tertiary-text">
                    {t("more_product")}
                  </div>
                  {IS_SAFE_SEND_LISTED && (
                    <MobileLink
                      isActive={
                        pathname === "/send" || pathname.startsWith("/send/") || pathname === "/pay"
                      }
                      href="/send"
                      iconName="wallet"
                      title={t("send")}
                      handleClose={() => setMobileMenuOpened(false)}
                    />
                  )}
                  <MobileLink
                    isActive={pathname === "/converter"}
                    href="/converter"
                    iconName="convert"
                    title={t("useful_converter")}
                    handleClose={() => setMobileMenuOpened(false)}
                  />
                  <MobileLink
                    isActive={pathname === "/revenue"}
                    href="/revenue"
                    iconName="staked"
                    title={t("revenue")}
                    handleClose={() => setMobileMenuOpened(false)}
                  />
                  <MobileLink
                    isActive={pathname === "/governance"}
                    href="/governance"
                    iconName="listing"
                    title={t("governance")}
                    handleClose={() => setMobileMenuOpened(false)}
                    comingSoon
                  />
                  <MobileLink
                    href="/create-token"
                    iconName="list-tokens"
                    title={t("create_token")}
                    handleClose={() => setMobileMenuOpened(false)}
                  />
                  <MobileLink
                    href="#"
                    iconName="list"
                    title={t("token_lists")}
                    handleClose={() => setMobileMenuOpened(false)}
                    handleClick={(e) => {
                      e.preventDefault();
                      openTokenLists();
                    }}
                  />
                  <MobileLink
                    isActive={pathname === "/statistics"}
                    href="/statistics"
                    iconName="statistics"
                    title={t("token_statistics")}
                    handleClose={() => setMobileMenuOpened(false)}
                  />
                  <MobileLink
                    isActive={pathname.startsWith("/markets")}
                    href="/markets"
                    iconName="price-change"
                    title={t("markets")}
                    handleClose={() => setMobileMenuOpened(false)}
                  />
                  <MobileLink
                    isActive={pathname === "/guidelines"}
                    href="/guidelines"
                    iconName="guidelines"
                    title={t("guidelines")}
                    handleClose={() => setMobileMenuOpened(false)}
                  />
                  <MobileLink
                    href={`https://blog.dex223.io/${locale}`}
                    iconName="blog"
                    title={t("blog")}
                    handleClose={() => setMobileMenuOpened(false)}
                    isExternal
                    openInNewTab={false}
                  />
                  <MobileLink
                    href="#"
                    iconName="star"
                    title={t("feedback")}
                    handleClose={() => setMobileMenuOpened(false)}
                    handleClick={(e) => {
                      e.preventDefault();
                      setOpenFeedbackDialog(true);
                    }}
                  />
                </div>
                <div className="flex flex-col py-4 px-4 bg-primary-bg gap-4">
                  <NavigationExternalLinksContainer
                    title={t("more_resources")}
                    links={[
                      {
                        href: "https://dexaran.github.io/erc20-losses/",
                        text: t("useful_losses_calculator"),
                      },
                      {
                        href: "https://dexaran.github.io/erc223/",
                        text: t("useful_front_page"),
                      },
                      {
                        href: "https://github.com/EthereumCommonwealth/Dex223-UI",
                        text: t("useful_page_source_codes"),
                      },
                    ]}
                  />

                  <NavigationExternalLinksContainer
                    title={t("partners")}
                    links={[
                      {
                        href: "https://blockzhub.io/",
                        text: t("partners_eos_support"),
                      },
                    ]}
                  />
                </div>
                <div className="flex flex-col mt-2 pt-3 px-4 border-t border-secondary-border pb-2">
                  <h4 className="text-12 uppercase tracking-[0.06em] text-tertiary-text mb-1">
                    {t("social_media")}
                  </h4>

                  {socialLinks.map((link) => {
                    return (
                      <a
                        key={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        href={link.href}
                        className="flex gap-2 items-center text-secondary-text py-2 hocus:text-primary-text duration-200"
                      >
                        <Svg iconName={link.icon} className="text-tertiary-text" />
                        <span className="flex-grow">{t(link.titleKey)}</span>
                        <Svg iconName="forward" size={16} className="text-tertiary-text shrink-0" />
                      </a>
                    );
                  })}
                </div>
              </Collapse>
            </div>
          </div>
          <div className="flex flex-grow items-end gap-4 px-4 pb-4">
            <div className="flex flex-col gap-4 flex-grow">
              <div className="flex gap-2">
                <div className="flex items-center gap-1 text-12 text-secondary-text">
                  <Svg size={16} className="text-tertiary-text" iconName="gas" />
                  <span>
                    {tFooter("gas")}{" "}
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green"
                      href={getExplorerLink(ExplorerLinkType.GAS_TRACKER, "", chainId)}
                    >
                      {gasPrice ? formatFloat(formatGwei(gasPrice)) : ""} GWEI
                    </a>
                  </span>
                </div>
                <div className="bg-primary-border w-[1px] h-3" />
                <div className="flex items-center gap-1.5 text-12 group relative">
                  {blockNumber ? (
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green"
                      href={getExplorerLink(
                        ExplorerLinkType.BLOCK,
                        blockNumber.toString(),
                        chainId,
                      )}
                    >
                      {blockNumber.toString()}
                    </a>
                  ) : null}
                  <div className="w-1.5 h-1.5 rounded-full bg-green" />

                  <div className="z-[1000] whitespace-nowrap text-14 opacity-0 pointer-events-none px-5 py-4 absolute group-hocus:opacity-100 duration-200 bottom-9 rounded-3 right-0 bg-primary-bg border border-secondary-border before:w-2.5 before:h-2.5 before:-bottom-[6px] before:bg-primary-bg before:absolute before:right-9 before:rotate-45 before:border-secondary-border before:border-r before:border-b">
                    <p>{tFooter("most_recent_block")}</p>
                    <p>{tFooter("prices_update_on_every_block")}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 w-full flex-grow">
                <LocaleSwitcher isMobile={true} />
                <Button
                  size={ButtonSize.MEDIUM}
                  fullWidth
                  className="flex-grow"
                  colorScheme={ButtonColor.LIGHT_GREEN}
                  endIcon="star"
                  onClick={() => {
                    setMobileMenuOpened(false);
                    setOpenFeedbackDialog(true);
                  }}
                >
                  {tFeedback("feedback")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Drawer>
      <IconButton
        buttonSize={IconButtonSize.LARGE}
        iconName="menu"
        aria-label={tA11y("menu")}
        aria-expanded={mobileMenuOpened}
        aria-haspopup="dialog"
        onClick={() => setMobileMenuOpened(true)}
      />
    </div>
  );
}
