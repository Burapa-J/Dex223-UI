import { useEffect, useState } from "react";

import { useMarginSwapTokensStore } from "@/app/[locale]/margin-swap/stores/useMarginSwapTokensStore";
import { getDefaultStandard } from "@/functions/getDefaultStandard";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { useSwapTokens } from "@/hooks/useTokenLists";
import { DexChainId } from "@/sdk_bi/chains";
import { Token } from "@/sdk_bi/entities/token";

// Pair preselected on the margin swap page when no tokens are picked yet, so the trading chart shows
// right away: the chain's native coin against this token. Sepolia RED has a live WETH pool on the v4
// factory, and the margin oracle prices it. It is
// spelled out here because otherwise it only arrives through the core subgraph, which Studio often
// rate-limits.
const DEFAULT_MARGIN_SWAP_TOKEN_B: Partial<Record<DexChainId, Token>> = {
  [DexChainId.SEPOLIA]: new Token(
    DexChainId.SEPOLIA,
    "0x1DEf777468F76ed1E74fC87bD32334d3Ccb520d0",
    "0x0a67Cc4D3Ac29a133a597b5Bef3fe9A6028ACad2",
    18,
    "RED",
    "RED (test)",
    "/images/tokens/placeholder.svg",
  ),
};

export function useMarginSwapDefaultPair() {
  const [isInitialized, setIsInitialized] = useState(false);
  const chainId = useCurrentChainId();
  const { tokens, isLoading } = useSwapTokens();
  const { tokenA, tokenB, setTokenA, setTokenB, setTokenAStandard, setTokenBStandard } =
    useMarginSwapTokensStore();

  useEffect(() => {
    if (isInitialized || tokens.length < 1 || isLoading) return;
    setIsInitialized(true);

    const defaultTokenB = DEFAULT_MARGIN_SWAP_TOKEN_B[chainId];
    if (tokenA || tokenB || !defaultTokenB) return;

    const native = tokens.find((t) => t.isNative);
    if (!native) return;

    const listed = tokens.find((t) => t.isToken && t.equals(defaultTokenB));
    setTokenA(native);
    setTokenAStandard(getDefaultStandard(native));
    setTokenB(listed || defaultTokenB);
    setTokenBStandard(getDefaultStandard(listed || defaultTokenB));
  }, [
    chainId,
    isInitialized,
    isLoading,
    setTokenA,
    setTokenAStandard,
    setTokenB,
    setTokenBStandard,
    tokenA,
    tokenB,
    tokens,
  ]);
}
