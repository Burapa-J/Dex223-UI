import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { Address } from "viem";

import { Check, OtherListCheck, Rate, TrustRateCheck } from "@/components/badges/TrustBadge";
import { db, TokenList, TokenListId } from "@/db/db";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { usePoolTokens } from "@/hooks/usePoolTokens";
import { DexChainId } from "@/sdk_bi/chains";
import { Currency } from "@/sdk_bi/entities/currency";
import { NativeCoin } from "@/sdk_bi/entities/ether";
import { Token } from "@/sdk_bi/entities/token";

export async function fetchTokenList(url: string) {
  const data = await fetch(url);
  return await data.json();
}

function getDefaultListCheckResult(
  token: Token,
  tokenLists: TokenList[],
  chainId: DexChainId,
): Pick<Rate, Check.DEFAULT_LIST> {
  const defaultTokenList = tokenLists.find((t) => t.id === `default-${chainId}`);

  const isTokenInDefaultList =
    defaultTokenList &&
    defaultTokenList.list.tokens.find(
      (t) => t.address0.toLowerCase() === token.address0.toLowerCase(),
    );
  return {
    [Check.DEFAULT_LIST]: isTokenInDefaultList ? TrustRateCheck.TRUE : TrustRateCheck.FALSE,
  };
}

function getOtherListCheckResult(
  token: Token,
  tokenLists: TokenList[],
  chainId: DexChainId,
): Pick<Rate, Check.OTHER_LIST> | undefined {
  if (tokenLists.length === 1) {
    return;
  }

  let timesTokenFoundInAllLists = 0;

  tokenLists.forEach((tokenList) => {
    if (
      tokenList.list.tokens.find(
        (t) =>
          t.address0.toLowerCase() === token.address0.toLowerCase() &&
          t.address1.toLowerCase() === token.address1.toLowerCase() &&
          t.name?.toLowerCase() === token.name?.toLowerCase(),
      )
    ) {
      timesTokenFoundInAllLists++;
    }
  });

  if (timesTokenFoundInAllLists > tokenLists.length / 2) {
    return { [Check.OTHER_LIST]: OtherListCheck.FOUND_IN_MORE_THAN_A_HALF };
  }

  if (timesTokenFoundInAllLists >= 2) {
    return { [Check.OTHER_LIST]: OtherListCheck.FOUND_IN_ONE };
  }

  return { [Check.OTHER_LIST]: OtherListCheck.NOT_FOUND };
}

function getSameNameInDefaultListCheckResult(
  token: Token,
  tokenLists: TokenList[],
  chainId: DexChainId,
): Pick<Rate, Check.SAME_NAME_IN_DEFAULT_LIST> {
  const defaultTokenList = tokenLists.find((t) => t.id === `default-${chainId}`);

  if (defaultTokenList) {
    const isDifferentTokenWithSameNameInDefaultList = defaultTokenList.list.tokens.find(
      (t) => t.address0.toLowerCase() !== token.address0.toLowerCase() && t.name === token.name,
    );

    if (isDifferentTokenWithSameNameInDefaultList) {
      return { [Check.SAME_NAME_IN_DEFAULT_LIST]: TrustRateCheck.TRUE };
    }
  }

  return {
    [Check.SAME_NAME_IN_DEFAULT_LIST]: TrustRateCheck.FALSE,
  };
}

function getSameNameInOtherListsCheckResult(
  token: Token,
  tokenLists: TokenList[],
  chainId: DexChainId,
): Pick<Rate, Check.SAME_NAME_IN_OTHER_LIST> | undefined {
  const tokensWithSameAddress: Token[] = [];
  const defaultTokenList = tokenLists.find((t) => t.id === `default-${chainId}`);
  if (
    defaultTokenList?.list.tokens.find(
      (t) =>
        t.address0.toLowerCase() === token.address0.toLowerCase() &&
        t.name?.toLowerCase() === token.name?.toLowerCase(),
    )
  ) {
    return;
  }

  const otherTokenLists = tokenLists.filter((t) => t.id !== `default-${chainId}`);

  otherTokenLists.map((otherTokenList) => {
    const tokenWithSameAddress = otherTokenList.list.tokens.find(
      (t) => t.address0.toLowerCase() === token.address0.toLowerCase(),
    );
    if (tokenWithSameAddress) {
      tokensWithSameAddress.push(tokenWithSameAddress);
    }
  });

  const isDifferentTokenWithSameNameInOtherList = tokensWithSameAddress.find(
    (t) => t.name?.toLowerCase() !== token.name?.toLowerCase(),
  );

  if (isDifferentTokenWithSameNameInOtherList) {
    return { [Check.SAME_NAME_IN_OTHER_LIST]: TrustRateCheck.TRUE };
  }

  return {
    [Check.SAME_NAME_IN_OTHER_LIST]: TrustRateCheck.FALSE,
  };
}

function getERC223VersionExistsCheckResult(token: Token): Pick<Rate, Check.ERC223_VERSION_EXIST> {
  if (token.address1) {
    return { [Check.ERC223_VERSION_EXIST]: TrustRateCheck.TRUE };
  }

  return {
    [Check.ERC223_VERSION_EXIST]: TrustRateCheck.FALSE,
  };
}

function getTokenRate(token: Token, tokenLists: TokenList[], chainId: DexChainId): Rate {
  const defaultListCheck = getDefaultListCheckResult(token, tokenLists, chainId);
  const otherListCheck = getOtherListCheckResult(token, tokenLists, chainId);
  const sameNameInDefaultListCheck = getSameNameInDefaultListCheckResult(
    token,
    tokenLists,
    chainId,
  );
  const sameNameInOtherListsCheck = getSameNameInOtherListsCheckResult(token, tokenLists, chainId);
  const erc223VersionExists = getERC223VersionExistsCheckResult(token);

  return {
    ...defaultListCheck,
    ...otherListCheck,
    ...sameNameInDefaultListCheck,
    ...sameNameInOtherListsCheck,
    ...erc223VersionExists,
  };
}

export function useTokenLists(onlyCustom: boolean = false) {
  const chainId = useCurrentChainId();

  const allTokenLists = useLiveQuery(() => {
    return db.tokenLists.where("chainId").equals(chainId).toArray();
  }, [chainId]);

  const customTokenLists = useLiveQuery(() => {
    return db.tokenLists.where("id").equals(`custom-${chainId}`).toArray();
  }, [chainId]);

  const tokenLists = useMemo(() => {
    return onlyCustom ? customTokenLists : allTokenLists;
  }, [allTokenLists, customTokenLists, onlyCustom]);

  return useMemo(() => {
    return tokenLists?.sort((a, b) => {
      const order = (id: TokenListId | undefined) => {
        if (typeof id !== "number" && id?.includes("default")) return 0;
        if (typeof id !== "number" && id?.includes("custom")) return 1;
        if (typeof id === "number") return 2 + id; // Ensure numeric IDs come after "default" and "custom"
        return 3; // Fallback for unexpected values, pushing them to the end
      };

      return order(a.id) - order(b.id);
    });
  }, [tokenLists]);
}

function formatIPFS(logoURI: string | undefined) {
  return logoURI?.startsWith("ipfs://")
    ? logoURI?.replace("ipfs://", "https://ipfs.io/ipfs/")
    : logoURI;
}

const LOGO_PLACEHOLDER = "/images/tokens/placeholder.svg";

function hasRealLogo(logoURI: string | undefined | null): boolean {
  return !!logoURI && logoURI !== LOGO_PLACEHOLDER;
}

export function useTokens(onlyCustom: boolean = false): Currency[] {
  const tokenLists = useTokenLists(onlyCustom);
  const chainId = useCurrentChainId();

  return useMemo(() => {
    const native = NativeCoin.onChain(chainId);

    if (tokenLists && tokenLists.length >= 1) {
      const inspect = (...arrays: TokenList[]) => {
        const map = new Map<Address, { token: Token; logoSourceId: TokenListId }>();

        const mainListId = `default-${chainId}`; // Assuming the first list is the main one

        const fill = (array: Token[], id: TokenListId) =>
          array.forEach((item) => {
            const lowercaseAddress = item.address0.toLowerCase() as Address;
            const rate = getTokenRate(item, tokenLists, item.chainId);
            const existing = map.get(lowercaseAddress);

            const isFromMain = id === mainListId;
            // The default list's logo wins; otherwise a real logo beats a missing one. Lists built
            // from on-chain data (Free / Paid Autolisting) carry no images, so without the last rule
            // a token that is also in the user's custom list (with the logo set at Create token)
            // showed the placeholder whenever the autolisting list was read first.
            const shouldOverwriteLogo =
              !existing ||
              (isFromMain && existing.logoSourceId !== mainListId) ||
              (existing.logoSourceId !== mainListId &&
                !hasRealLogo(existing.token.logoURI) &&
                hasRealLogo(item?.logoURI));
            const logoURI = shouldOverwriteLogo
              ? formatIPFS(item?.logoURI) || "/images/tokens/placeholder.svg"
              : formatIPFS(existing?.token.logoURI) || "/images/tokens/placeholder.svg";

            map.set(lowercaseAddress, {
              token: new Token(
                item.chainId,
                item.address0,
                item.address1,
                item.decimals,
                item.symbol || "Unknown",
                item.name || "Unknown",
                logoURI,
                existing ? Array.from(new Set([...(existing.token.lists || []), id])) : [id],
                rate,
              ),
              logoSourceId: shouldOverwriteLogo ? id : existing.logoSourceId,
            });
          });

        arrays.forEach((array) => fill(array.list.tokens, array.id || -1));

        return [...map.values()]
          .map((entry) => entry.token)
          .sort((a, b) => (b.lists?.length || 0) - (a.lists?.length || 0));
      };

      const tokensArrays = tokenLists.filter((list) => list.enabled);
      const _t = inspect(...tokensArrays);

      return onlyCustom ? _t : [native, ..._t];
    }

    const tokens =
      tokenLists
        ?.filter((list) => list.enabled)
        .map((l) => l.list.tokens)
        .flat() || [];

    return onlyCustom ? tokens : [native, ...tokens];
  }, [chainId, onlyCustom, tokenLists]);
}

// Tokens for the swap form: everything from the enabled lists, plus any token that has a pool on
// this chain's factory but is in none of those lists. Without the second part, a pair shown on the
// Pools page (and linked from its Swap button) can be impossible to pick. Pool-only tokens are
// rated against the lists like any other token, so they carry the usual low-trust warning.
export function useSwapTokens(): { tokens: Currency[]; isLoading: boolean } {
  const tokens = useTokens();
  const tokenLists = useTokenLists();
  const { tokens: poolTokens, isLoading } = usePoolTokens();

  const swapTokens = useMemo(() => {
    if (!poolTokens.length) return tokens;

    const known = new Set(
      tokens.filter((t) => t.isToken).map((t) => t.wrapped.address0.toLowerCase()),
    );
    const extra = poolTokens
      .filter((t) => !known.has(t.address0.toLowerCase()))
      .map(
        (t) =>
          new Token(
            t.chainId,
            t.address0,
            t.address1,
            t.decimals,
            t.symbol,
            t.name,
            t.logoURI,
            [],
            getTokenRate(t, tokenLists || [], t.chainId),
          ),
      );

    return extra.length ? [...tokens, ...extra] : tokens;
  }, [poolTokens, tokenLists, tokens]);

  return { tokens: swapTokens, isLoading };
}
