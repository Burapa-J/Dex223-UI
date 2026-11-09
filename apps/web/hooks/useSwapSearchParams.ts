import { useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { useSwapTokensStore } from "@/app/[locale]/swap/stores/useSwapTokensStore";
import { currencyToQueryParam, findCurrencyByQuery } from "@/functions/findCurrencyByQuery";
import { getDefaultStandard } from "@/functions/getDefaultStandard";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { usePathname } from "@/i18n/routing";
import { DexChainId } from "@/sdk_bi/chains";
import { Token } from "@/sdk_bi/entities/token";

import { useSwapTokens } from "./useTokenLists";

enum SwapQueryParams {
  tokenA = "tokenA",
  tokenB = "tokenB",
}

// Pair preselected on the swap page when the URL names no tokens, so the trading chart shows right
// away: the chain's native coin against this token. Sepolia RED is an open-mint test token with a live
// WETH pool on the v4 factory. It is spelled out here because otherwise it only arrives through the
// core subgraph, which Studio often rate-limits.
const DEFAULT_SWAP_TOKEN_B: Partial<Record<DexChainId, Token>> = {
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

export const useSwapSearchParams = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const locale = useLocale();
  const _pathname = usePathname();
  const pathname = `/${locale}${_pathname}`;
  const searchParams = useSearchParams();
  const chainId = useCurrentChainId();
  const { tokens, isLoading: arePoolTokensLoading } = useSwapTokens();

  const { tokenA, tokenB, setTokenA, setTokenB, setTokenAStandard, setTokenBStandard, reset } =
    useSwapTokensStore();
  const previousChainId = useRef(chainId);
  // A chain change must not reuse the previous chain's tokenA/tokenB query.
  const ignoreQueryRef = useRef(false);

  const currentPath = useMemo(() => {
    return searchParams.toString() ? pathname + "?" + searchParams.toString() : pathname;
  }, [searchParams, pathname]);

  const updatedPath = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    const tokenAParam = currencyToQueryParam(tokenA);
    const tokenBParam = currencyToQueryParam(tokenB);
    if (tokenAParam) {
      params.set(SwapQueryParams.tokenA, tokenAParam);
    } else {
      params.delete(SwapQueryParams.tokenA);
    }
    if (tokenBParam) {
      params.set(SwapQueryParams.tokenB, tokenBParam);
    } else {
      params.delete(SwapQueryParams.tokenB);
    }

    return pathname + "?" + params.toString();
  }, [pathname, searchParams, tokenA, tokenB]);

  useEffect(() => {
    const chainChanged = previousChainId.current !== chainId;
    if (chainChanged) {
      previousChainId.current = chainId;
      ignoreQueryRef.current = true;
      reset();
      if (isInitialized) {
        setIsInitialized(false);
        return;
      }
    }

    // Wait for pool tokens too, so a pair linked from the Pools page resolves even when a token
    // is in no enabled list.
    if (!isInitialized && tokens.length > 1 && !arePoolTokensLoading) {
      const ignoreQuery = ignoreQueryRef.current;
      ignoreQueryRef.current = false;
      const queryTokenA = ignoreQuery ? null : searchParams.get(SwapQueryParams.tokenA);
      const queryTokenB = ignoreQuery ? null : searchParams.get(SwapQueryParams.tokenB);

      const defaultTokenB = DEFAULT_SWAP_TOKEN_B[chainId];
      if (!queryTokenA && !queryTokenB && defaultTokenB) {
        const native = tokens.find((t) => t.isNative);
        const listed = tokens.find((t) => t.isToken && t.equals(defaultTokenB));
        if (native) {
          setTokenA(native);
          setTokenAStandard(getDefaultStandard(native));
          setTokenB(listed || defaultTokenB);
          setTokenBStandard(getDefaultStandard(listed || defaultTokenB));
        }
      }

      if (queryTokenA) {
        const token = findCurrencyByQuery(tokens, queryTokenA);
        if (token) {
          setTokenA(token);
          setTokenAStandard(getDefaultStandard(token));
        }
      }
      if (queryTokenB) {
        const token = findCurrencyByQuery(tokens, queryTokenB);
        if (token && queryTokenA?.toLowerCase() !== queryTokenB.toLowerCase()) {
          setTokenB(token);
          setTokenBStandard(getDefaultStandard(token));
        }
      }

      setIsInitialized(true);
    }
  }, [
    searchParams,
    chainId,
    tokens,
    setTokenA,
    setTokenB,
    setTokenAStandard,
    setTokenBStandard,
    reset,
    isInitialized,
    arePoolTokensLoading,
  ]);
  useEffect(() => {
    if (isInitialized) {
      if (currentPath !== updatedPath) {
        window.history.replaceState(null, "", updatedPath);
      }
    }
  }, [currentPath, updatedPath, isInitialized]);
};
