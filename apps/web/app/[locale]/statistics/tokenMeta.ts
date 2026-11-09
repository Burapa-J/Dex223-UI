import { useCallback, useMemo } from "react";
import { getAddress } from "viem";

import useCurrentChainId from "@/hooks/useCurrentChainId";
import { useTokenListLogos } from "@/hooks/useTokenListLogos";
import { DexChainId } from "@/sdk_bi/chains";

const PLACEHOLDER = "/images/tokens/placeholder.svg";

type SubgraphToken = { id: string; symbol: string; addressERC223?: string | null };

export function tokenMeta(
  token: SubgraphToken,
  chainId: number,
  listLogos?: Map<string, string>,
): {
  symbol: string;
  image: string;
} {
  let symbol = token.symbol;
  let image =
    listLogos?.get(token.id.toLowerCase()) ??
    (token.addressERC223 ? listLogos?.get(token.addressERC223.toLowerCase()) : undefined) ??
    PLACEHOLDER;

  // Trust Wallet only hosts Ethereum mainnet logos. Other chains 404 there.
  if (image === PLACEHOLDER && chainId === DexChainId.MAINNET) {
    try {
      image = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${getAddress(token.id)}/logo.png`;
    } catch {
      // invalid address: keep placeholder
    }
  }

  const d223 = "0x0908078Da2935A14BC7a17770292818C85b580dd";
  if (token.addressERC223 === d223.toLowerCase()) {
    symbol = "D223";
    image = "/images/tokens/DEX.svg";
  }

  const weth9 = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
  if (token.id === weth9.toLowerCase()) {
    symbol = "ETH";
    image = "/images/tokens/ETH.svg";
  }

  return { symbol, image };
}

// Resolves subgraph tokens against the token lists for the current chain,
// so testnet tokens get their listed logo instead of a missing mainnet one.
export function useTokenMeta() {
  const chainId = useCurrentChainId();

  const listLogos = useTokenListLogos();

  return useCallback(
    (token: SubgraphToken) => tokenMeta(token, chainId, listLogos),
    [chainId, listLogos],
  );
}
