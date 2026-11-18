import Alert from "@repo/ui/alert";
import ExternalTextLink from "@repo/ui/external-text-link";
import { useTranslations } from "next-intl";
import React from "react";

import getExplorerLink, { ExplorerLinkType } from "@/functions/getExplorerLink";
import type { MarginRevert } from "@/functions/marginRevert";
import useCurrentChainId from "@/hooks/useCurrentChainId";

/**
 * Plain-language reason for a failed margin action, with the contract code and transaction link
 * underneath for support. Figma page 11, "Margin: readable errors, one-step liquidation, lender
 * close".
 */
export default function MarginRevertReason({ revert }: { revert?: MarginRevert }) {
  const t = useTranslations("MarginErrors");
  const chainId = useCurrentChainId();

  if (!revert || (!revert.code && !revert.shortMessage && !revert.hash)) {
    return null;
  }

  const known = revert.code && t.has(revert.code as never);
  const sentence = known ? t(revert.code as never) : (revert.shortMessage ?? t("unknown"));

  return (
    <Alert
      type="error"
      withIcon={false}
      className="mb-4"
      text={
        <span className="flex flex-col gap-1">
          <span>{sentence}</span>
          {(revert.code || revert.hash) && (
            <span className="text-12 text-secondary-text flex flex-wrap gap-x-2">
              {revert.code && <span>{t("contract_code", { code: revert.code })}</span>}
              {revert.hash && (
                <ExternalTextLink
                  text={t("view_transaction")}
                  href={getExplorerLink(ExplorerLinkType.TRANSACTION, revert.hash, chainId)}
                />
              )}
            </span>
          )}
        </span>
      }
    />
  );
}
