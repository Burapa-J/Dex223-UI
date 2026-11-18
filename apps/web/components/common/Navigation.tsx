import clsx from "clsx";
import { useLocale, useTranslations } from "next-intl";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { useMediaQuery } from "react-responsive";

import { IS_SAFE_SEND_LISTED } from "@/app/[locale]/send/config";
import NavigationItem, { NavigationItemWithSubmenu } from "@/components/atoms/NavigationItem";
import Popover from "@/components/atoms/Popover";
import Svg from "@/components/atoms/Svg";
import { IS_REWARDS_ENABLED, isRouteActive, MobileLink } from "@/components/common/MobileMenu";
import { useFeedbackDialogStore } from "@/components/dialogs/stores/useFeedbackDialogStore";
import { IconName } from "@/config/types/IconName";
import { isBorrowLendComingSoon } from "@/hooks/useIsMarginAvailable";
import { usePathname } from "@/i18n/routing";
import { useManageTokensDialogStore } from "@/stores/useManageTokensDialogStore";

// Every route the "More" menu links to, so its trigger lights up on any of them.
const MORE_MENU_ROUTES = [
  "/send",
  "/pay",
  "/converter",
  "/revenue",
  "/governance",
  "/create-token",
  "/blog",
  "/statistics",
  "/markets",
  "/guidelines",
];

function MoreSectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 pb-1 text-12 uppercase tracking-[0.06em] text-tertiary-text">
      {children}
    </div>
  );
}

function MoreExternalRow({
  href,
  text,
  iconName,
}: {
  href: string;
  text: string;
  iconName?: IconName;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 py-2.5 px-4 text-secondary-text hocus:bg-quaternary-bg hocus:text-primary-text duration-200 group"
    >
      {iconName ? (
        <Svg
          iconName={iconName}
          className="text-tertiary-text group-hocus:text-secondary-text duration-200"
        />
      ) : null}
      <span className="flex-grow text-14">{text}</span>
      <Svg
        iconName="forward"
        size={16}
        className="text-tertiary-text group-hocus:text-secondary-text duration-200 shrink-0"
      />
    </a>
  );
}

function MarginTradingSubmenuLink({
  isActive,
  title,
  handleClose,
}: {
  isActive: boolean;
  title: string;
  handleClose: () => void;
}) {
  const comingSoon = isBorrowLendComingSoon();

  return (
    <MobileLink
      disabled={comingSoon}
      isActive={isActive}
      href="/margin-swap"
      iconName="margin-trading"
      title={title}
      handleClose={handleClose}
      className={clsx("min-w-[238px]", comingSoon && "pr-5")}
      comingSoon={comingSoon}
    />
  );
}

const menuItems: Array<
  | {
      label: any;
      submenu: (handleClose: () => void, t: any, pathname?: string) => ReactNode;
      activeFlags: string[];
    }
  | { label: any; href: string; plain?: boolean }
> = [
  {
    label: "trade",
    submenu: (handleClose, t, pathname) => (
      <div className="flex flex-col py-1 bg-primary-bg rounded-2 shadow-popover shadow-black/70">
        <MobileLink
          isActive={pathname === "/swap"}
          href="/swap"
          iconName="swap"
          title={t("swap")}
          handleClose={handleClose}
          className="min-w-[238px]"
        />
        <MarginTradingSubmenuLink
          isActive={pathname === "/margin-swap"}
          title={t("margin_trading")}
          handleClose={handleClose}
        />
        <MobileLink
          isActive={pathname === "/buy-crypto"}
          href="/buy-crypto"
          iconName="fiat"
          title={t("buy_crypto")}
          handleClose={handleClose}
          className="min-w-[238px]"
        />
        {/* <MobileLink
          isActive={pathname === "/multisig"}
          href="/multisig"
          iconName="high-trust"
          title={t("multisig")}
          handleClose={handleClose}
          className="min-w-[238px]"
        /> */}
      </div>
    ),
    activeFlags: ["/swap", "/margin-swap", "/buy-crypto"],
  },
  {
    label: "pools",
    href: "/pools",
  },
  {
    label: "borrow_lend",
    href: "/margin-trading",
  },
  {
    label: "portfolio",
    href: "/portfolio",
  },
  // Served by the DEX223 Rewards app on this domain (next.config.js rewrites).
  // Only listed when NEXT_PUBLIC_REWARDS_ENABLED === "true"; see IS_REWARDS_ENABLED.
  ...(IS_REWARDS_ENABLED
    ? [
        {
          label: "rewards",
          href: "/rewards",
          plain: true,
        },
      ]
    : []),
  {
    label: "token_listing",
    href: "/token-listing",
  },
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

function NavigationMoreDropdown() {
  const [isSubmenuOpened, setSubmenuOpened] = useState(false);
  const t = useTranslations("Navigation");
  const locale = useLocale();
  const pathname = usePathname();
  const { setIsOpen } = useFeedbackDialogStore();
  const openTokenLists = useManageTokensDialogStore((state) => state.openTokenLists);

  const active = useMemo(() => {
    return MORE_MENU_ROUTES.some((route) => isRouteActive(pathname, route));
  }, [pathname]);

  const isSmallScreen = useMediaQuery({ query: "(max-width: 1280px)" });

  useEffect(() => {
    if (isSmallScreen) {
      setSubmenuOpened(false);
    }
  }, [isSmallScreen]);

  return (
    <Popover
      isOpened={isSubmenuOpened}
      setIsOpened={setSubmenuOpened}
      placement="bottom-end"
      customOffset={12}
      trigger={
        <button
          onClick={() => setSubmenuOpened(!isSubmenuOpened)}
          aria-expanded={isSubmenuOpened}
          aria-label={t("more")}
          className={clsx(
            "px-3 py-5 inline-flex items-center gap-1 duration-200 group",
            isSubmenuOpened || active
              ? "bg-navigation-active text-green shadow-green/60 text-shadow"
              : "hocus:bg-navigation-hover hocus:text-green hocus:shadow-green/60 hocus:text-shadow text-secondary-text",
          )}
        >
          <Svg
            className={clsx(
              "group-hocus:drop-shadow-[0_0_2px_var(--tw-shadow-color)] group-hocus:shadow-green/60",
              isSubmenuOpened ? "rotate-180" : "",
              (active || isSubmenuOpened) &&
                "drop-shadow-[0_0_2px_var(--tw-shadow-color)] shadow-green/60",
            )}
            iconName="small-expand-arrow"
          />
        </button>
      }
    >
      <div className="bg-tertiary-bg rounded-2 shadow-popover shadow-black/70 overflow-hidden min-w-[640px]">
        <div className="grid grid-cols-[1.15fr_1fr_0.95fr]">
          <div className="flex flex-col py-3 border-r border-secondary-border">
            <MoreSectionLabel>{t("more_product")}</MoreSectionLabel>
            {IS_SAFE_SEND_LISTED && (
              <MobileLink
                isActive={
                  pathname === "/send" || pathname.startsWith("/send/") || pathname === "/pay"
                }
                href="/send"
                iconName="wallet"
                title={t("send")}
                handleClose={() => setSubmenuOpened(false)}
              />
            )}
            <MobileLink
              isActive={pathname === "/converter"}
              href="/converter"
              iconName="convert"
              title={t("useful_converter")}
              handleClose={() => setSubmenuOpened(false)}
            />
            <MobileLink
              isActive={pathname === "/revenue"}
              href="/revenue"
              iconName="staked"
              title={t("revenue")}
              handleClose={() => setSubmenuOpened(false)}
            />
            <MobileLink
              isActive={pathname === "/governance"}
              href="/governance"
              iconName="listing"
              title={t("governance")}
              handleClose={() => setSubmenuOpened(false)}
              comingSoon
            />
            <MobileLink
              isActive={pathname === "/create-token"}
              href="/create-token"
              iconName="list-tokens"
              title={t("create_token")}
              handleClose={() => setSubmenuOpened(false)}
            />
            <MobileLink
              href="#"
              iconName="list"
              title={t("token_lists")}
              handleClose={() => setSubmenuOpened(false)}
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
              handleClose={() => setSubmenuOpened(false)}
            />
            <MobileLink
              isActive={pathname.startsWith("/markets")}
              href="/markets"
              iconName="price-change"
              title={t("markets")}
              handleClose={() => setSubmenuOpened(false)}
            />
            <MobileLink
              isActive={pathname === "/guidelines"}
              href="/guidelines"
              iconName="guidelines"
              title={t("guidelines")}
              handleClose={() => setSubmenuOpened(false)}
            />
            <MobileLink
              href={`https://blog.dex223.io/${locale}`}
              iconName="blog"
              title={t("blog")}
              handleClose={() => setSubmenuOpened(false)}
              isExternal
              openInNewTab={false}
            />
            <MobileLink
              href="#"
              iconName="star"
              title={t("feedback")}
              handleClose={() => setSubmenuOpened(false)}
              handleClick={(e) => {
                e.preventDefault();
                setIsOpen(true);
              }}
            />
          </div>

          <div className="flex flex-col py-3 border-r border-secondary-border">
            <MoreSectionLabel>{t("more_resources")}</MoreSectionLabel>
            <MoreExternalRow
              href="https://dexaran.github.io/erc20-losses/"
              text={t("useful_losses_calculator")}
            />
            <MoreExternalRow
              href="https://dexaran.github.io/erc223/"
              text={t("useful_front_page")}
            />
            <MoreExternalRow
              href="https://github.com/EthereumCommonwealth/Dex223-UI"
              text={t("useful_page_source_codes")}
            />
            <div className="mt-3 pt-3 border-t border-secondary-border">
              <MoreSectionLabel>{t("partners")}</MoreSectionLabel>
              <MoreExternalRow href="https://blockzhub.io/" text={t("partners_eos_support")} />
            </div>
          </div>

          <div className="flex flex-col py-3">
            <MoreSectionLabel>{t("social_media")}</MoreSectionLabel>
            {socialLinks.map((link) => (
              <a
                key={link.href}
                target="_blank"
                rel="noopener noreferrer"
                href={link.href}
                className="flex gap-2 items-center text-secondary-text py-2.5 px-4 hocus:bg-quaternary-bg hocus:text-primary-text duration-200 group"
              >
                <Svg
                  className="text-tertiary-text group-hocus:text-secondary-text duration-200"
                  iconName={link.icon}
                />
                <span className="text-14 flex-grow">{t(link.titleKey)}</span>
                <Svg
                  iconName="forward"
                  size={16}
                  className="text-tertiary-text group-hocus:text-secondary-text duration-200 shrink-0"
                />
              </a>
            ))}
          </div>
        </div>
      </div>
    </Popover>
  );
}

export default function Navigation() {
  const t = useTranslations("Navigation");
  const locale = useLocale();

  const pathname = usePathname();

  return (
    <ul className="hidden xl:flex items-center">
      {menuItems.map((menuItem, index) => {
        if ("submenu" in menuItem) {
          return (
            <li key={menuItem.label + index}>
              <NavigationItemWithSubmenu
                title={menuItem.label ? t(menuItem.label) : ""}
                submenu={menuItem.submenu}
                active={menuItem.activeFlags.some((flag) => pathname.startsWith(flag))}
              />
            </li>
          );
        }

        return (
          <li key={menuItem.label}>
            <NavigationItem
              id={menuItem.label}
              title={t(menuItem.label)}
              href={
                "plain" in menuItem && menuItem.plain ? `${menuItem.href}/${locale}` : menuItem.href
              }
              plain={"plain" in menuItem && menuItem.plain}
              active={isRouteActive(pathname, menuItem.href)}
            />
          </li>
        );
      })}
      <li>
        <NavigationMoreDropdown />
      </li>
    </ul>
  );
}
