"use client";

import Button, { getButtonClassName } from "@/components/buttons/Button";
import { Link } from "@/i18n/routing";
import { useManageTokensDialogStore } from "@/stores/useManageTokensDialogStore";

const ctaClassName = getButtonClassName({ className: "inline-flex w-fit" });

export default function GuideCta({
  href,
  label,
  action,
}: {
  href: string;
  label: string;
  action?: "token-lists";
}) {
  const openTokenLists = useManageTokensDialogStore((state) => state.openTokenLists);

  if (action === "token-lists") {
    return (
      <Button type="button" className="inline-flex w-fit" onClick={openTokenLists}>
        {label}
      </Button>
    );
  }

  return (
    <Link href={href} className={ctaClassName}>
      {label}
    </Link>
  );
}
