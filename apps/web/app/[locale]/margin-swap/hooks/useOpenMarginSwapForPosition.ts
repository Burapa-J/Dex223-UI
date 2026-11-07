import { useCallback } from "react";

import { useMarginSwapPositionStore } from "@/app/[locale]/margin-swap/stores/useMarginSwapPositionStore";
import { useMarginSwapTokensStore } from "@/app/[locale]/margin-swap/stores/useMarginSwapTokensStore";
import { MarginPosition } from "@/app/[locale]/margin-trading/types";
import { getDefaultStandard } from "@/functions/getDefaultStandard";
import { useRouter } from "@/i18n/routing";
import { Currency } from "@/sdk_bi/entities/currency";

/**
 * The pair the margin swap should open on for `position`: sell what the position holds (the loan
 * asset while it still has a balance, otherwise the first asset that does) and buy the first other
 * token the order allows for trading.
 */
export function getPositionTradePair(position: MarginPosition): {
  tokenA: Currency | undefined;
  tokenB: Currency | undefined;
} {
  const held = position.assetsWithBalances.filter(
    ({ balance }) => !!balance && balance > BigInt(0),
  );
  const loanHeld = held.find(({ asset }) => asset.equals(position.loanAsset));
  const tokenA = loanHeld?.asset ?? held[0]?.asset ?? position.loanAsset;
  const tokenB = position.order.allowedTradingAssets.find((asset) => !asset.equals(tokenA));

  return { tokenA, tokenB };
}

/** Opens the margin swap page for `position`, with the position and its trading pair preselected. */
export function useOpenMarginSwapForPosition() {
  const router = useRouter();
  const { setMarginSwapPositionId } = useMarginSwapPositionStore();
  const { setTokenA, setTokenB, setTokenAStandard, setTokenBStandard } = useMarginSwapTokensStore();

  return useCallback(
    (position: MarginPosition) => {
      const { tokenA, tokenB } = getPositionTradePair(position);
      setMarginSwapPositionId(position.id);
      setTokenA(tokenA);
      setTokenAStandard(getDefaultStandard(tokenA));
      setTokenB(tokenB);
      setTokenBStandard(getDefaultStandard(tokenB));
      router.push("/margin-swap");
    },
    [router, setMarginSwapPositionId, setTokenA, setTokenAStandard, setTokenB, setTokenBStandard],
  );
}
