import { useCallback } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import useCurrentChainId from "@/hooks/useCurrentChainId";
import { Currency } from "@/sdk_bi/entities/currency";

// `showFirst` follows the position page's toggle: true quotes prices in token0 per 1 token1,
// false in token1 per 1 token0. The choice is kept per position, so the positions list shows each
// range the way its owner last read it on the position page.
interface PriceOrientationStore {
  showFirstByPosition: Record<string, boolean>;
  setShowFirst: (key: string, showFirst: boolean) => void;
}

const usePriceOrientationStore = create<PriceOrientationStore>()(
  persist(
    (set, get) => ({
      showFirstByPosition: {},
      setShowFirst: (key, showFirst) =>
        set({ showFirstByPosition: { ...get().showFirstByPosition, [key]: showFirst } }),
    }),
    { name: "position-price-orientation" },
  ),
);

const STABLE = /^(d|t|w)?(USDT|USDC|DAI|BUSD|TUSD|FDUSD|USDE|PYUSD|USDS|USD)\d*$/i;
const ETH_LIKE = /^(W?ETH|sepETH|WSEPETH)$/i;

/** How natural `token` is as the unit of a price: stablecoins first, then ETH, then anything. */
function quoteRank(token: Currency | undefined): number {
  if (!token) return 0;
  const symbol = token.symbol ?? "";
  if (STABLE.test(symbol)) return 2;
  if (token.isNative || ETH_LIKE.test(symbol)) return 1;
  return 0;
}

/**
 * Default orientation before the user picks one: quote in whichever token reads like money
 * (dUSDT before T110526 gives "0.001–0.003 dUSDT", not "991.9–330.2 T110526"). Ties keep token0,
 * which was the only orientation before.
 */
export function defaultShowFirst(token0: Currency | undefined, token1: Currency | undefined) {
  return quoteRank(token0) >= quoteRank(token1);
}

export default function usePositionPriceOrientation({
  tokenId,
  token0,
  token1,
}: {
  tokenId: bigint | string | number | undefined;
  token0: Currency | undefined;
  token1: Currency | undefined;
}): [boolean, (showFirst: boolean) => void] {
  const chainId = useCurrentChainId();
  const key = tokenId !== undefined ? `${chainId}:${tokenId.toString()}` : undefined;
  const stored = usePriceOrientationStore((s) => (key ? s.showFirstByPosition[key] : undefined));
  const setStored = usePriceOrientationStore((s) => s.setShowFirst);

  const set = useCallback(
    (showFirst: boolean) => {
      if (key) setStored(key, showFirst);
    },
    [key, setStored],
  );

  return [stored ?? defaultShowFirst(token0, token1), set];
}
