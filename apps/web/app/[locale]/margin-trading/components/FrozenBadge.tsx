import { useTranslations } from "next-intl";

export default function FrozenBadge() {
  const t = useTranslations("Margin");

  return (
    <span className="inline-flex items-center gap-1 rounded-1 bg-yellow-bg px-1.5 py-0.5 text-12 font-medium leading-4 text-yellow-light">
      <span className="block h-1.5 w-1.5 rounded-full bg-yellow-light" />
      {t("frozen")}
    </span>
  );
}
