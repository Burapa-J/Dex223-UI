import Alert from "@repo/ui/alert";
import { useTranslations } from "next-intl";
import React from "react";

// Non-breaking hyphens keep "ERC-223" from splitting across lines.
const nb = (text: string) => text.replace(/ERC-(\d+)/g, "ERC‑$1");

/**
 * Warning shown wherever the app would deliver ERC-223 tokens to the connected wallet while that
 * wallet is an EIP-7702 smart account that cannot receive them (see useCanReceiveERC223). The
 * transfer would revert on chain, so the caller also disables its action.
 *
 * With `onUseErc20` the fix is a link that switches the output to ERC-20 (swap, claim fees). Without
 * it (converter to ERC-223) the only fix is switching the wallet back to a standard account.
 * Figma: page 02 / page 06, "Smart account (EIP-7702) can't receive ERC-223".
 */
export default function Erc223ReceiveWarning({
  onUseErc20,
  className,
}: {
  onUseErc20?: () => void;
  className?: string;
}) {
  const t = useTranslations("Swap");

  return (
    <div className={className}>
      <Alert
        type="warning"
        text={
          <span className="flex flex-col gap-2">
            <span className="font-medium text-primary-text">{nb(t("eip7702_title"))}</span>
            <span>{nb(t("eip7702_warning"))}</span>
            <span>
              {onUseErc20
                ? t.rich("eip7702_fix", {
                    receive: (chunks) => (
                      <button
                        type="button"
                        className="text-green underline hocus:text-green-hover duration-200"
                        onClick={onUseErc20}
                      >
                        {chunks}
                      </button>
                    ),
                  })
                : nb(t("eip7702_fix_switch"))}
            </span>
          </span>
        }
      />
    </div>
  );
}
