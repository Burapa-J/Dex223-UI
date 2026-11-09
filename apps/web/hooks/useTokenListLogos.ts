import { useMemo } from "react";

import { useTokens } from "@/hooks/useTokenLists";

export const TOKEN_LOGO_PLACEHOLDER = "/images/tokens/placeholder.svg";

/** Logos from the user's token lists, keyed by lowercased ERC-20 and ERC-223 address. */
export type TokenListLogos = Map<string, string>;

/**
 * Logo of every token in the current chain's token lists, so tokens that arrive from a subgraph or
 * from the chain (which carry no logo) can show the listed one. Keys are lowercased because lists,
 * subgraphs and contract reads spell addresses differently.
 */
export function useTokenListLogos(): TokenListLogos {
  const tokens = useTokens();

  return useMemo(() => {
    const map: TokenListLogos = new Map();
    tokens.forEach((token) => {
      if (!("address0" in token) || !token.logoURI || token.logoURI === TOKEN_LOGO_PLACEHOLDER) {
        return;
      }
      map.set(token.address0.toLowerCase(), token.logoURI);
      map.set(token.address1.toLowerCase(), token.logoURI);
    });
    return map;
  }, [tokens]);
}

/** Listed logo for a token given either of its addresses, or the placeholder. */
export function listedLogo(
  logos: TokenListLogos | undefined,
  ...addresses: (string | null | undefined)[]
): string {
  for (const address of addresses) {
    const logo = address ? logos?.get(address.toLowerCase()) : undefined;
    if (logo) return logo;
  }
  return TOKEN_LOGO_PLACEHOLDER;
}
