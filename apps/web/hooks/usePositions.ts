import { useMemo, useRef } from "react";
import { Address } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";

import { useRefreshDepositsDataStore } from "@/app/[locale]/portfolio/components/stores/useRefreshTableStore";
import { ERC20_ABI } from "@/config/abis/erc20";
import { NONFUNGIBLE_POSITION_MANAGER_ABI } from "@/config/abis/nonfungiblePositionManager";
import { TOKEN_CONVERTER_ABI } from "@/config/abis/tokenConverter";
import { useTokens } from "@/hooks/useTokenLists";
import { NONFUNGIBLE_POSITION_MANAGER_ADDRESS } from "@/sdk_bi/addresses";
import { CONVERTER_ADDRESS } from "@/sdk_bi/addresses";
import { DexChainId } from "@/sdk_bi/chains";
import { FeeAmount } from "@/sdk_bi/constants";
import { Currency } from "@/sdk_bi/entities/currency";
import { Price } from "@/sdk_bi/entities/fractions/price";
import { Position } from "@/sdk_bi/entities/position";
import { Token } from "@/sdk_bi/entities/token";
import { Standard } from "@/sdk_bi/standard";

import useCurrentChainId from "./useCurrentChainId";
import { usePool } from "./usePools";

export type PositionInfo = {
  nonce: bigint;
  operator: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  tier: FeeAmount;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
  tokenId: bigint | undefined;
};

export function usePositionFromTokenId(tokenId: bigint, forceRefresh = true) {
  const { positions, loading } = usePositionsFromTokenIds(
    tokenId ? [tokenId] : undefined,
    forceRefresh,
  );

  return useMemo(() => {
    return {
      loading,
      position: positions?.[0],
    };
  }, [loading, positions]);
}

export function usePositionsFromTokenIds(tokenIds: bigint[] | undefined, forceRefresh = true) {
  const chainId = useCurrentChainId();

  const currentTokens = useRef<bigint[] | undefined>(undefined);
  const { refreshDepositsTrigger } = useRefreshDepositsDataStore();

  const toRefresh = useMemo(() => {
    return (
      currentTokens.current?.length === tokenIds?.length &&
      tokenIds &&
      currentTokens.current?.every((value, index) => value === tokenIds[index]) &&
      !(refreshDepositsTrigger || forceRefresh)
    );
  }, [forceRefresh, refreshDepositsTrigger, tokenIds]);
  currentTokens.current = tokenIds;

  const positionsContracts = useMemo(() => {
    if (!tokenIds) {
      return [];
    }

    return tokenIds.map((tokenId) => {
      return {
        address: NONFUNGIBLE_POSITION_MANAGER_ADDRESS[chainId as DexChainId],
        abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
        functionName: "positions",
        args: [tokenId],
      };
    });
  }, [tokenIds, chainId]);

  const { data: positionsData, isLoading: positionsLoading } = useReadContracts({
    contracts: positionsContracts,
    query: {
      enabled: !toRefresh,
    },
  });

  return useMemo(() => {
    return {
      loading: positionsLoading,
      positions: positionsData
        ?.map((pos, i) => {
          if (!pos || pos.error) {
            return undefined;
          }

          const [
            ,
            ,
            //nonce,
            //operator,
            token0,
            token1,
            tier,
            tickLower,
            tickUpper,
            liquidity,
            // feeGrowthInside0LastX128,
            // feeGrowthInside1LastX128,
            // tokensOwed0,
            // tokensOwed1,
          ] = pos.result as any;
          return {
            token0,
            token1,
            tier,
            tickLower,
            tickUpper,
            liquidity,
            tokenId: tokenIds?.[i],
          };
        })
        .filter((pos) => Boolean(pos)) as PositionInfo[],
    };
  }, [positionsData, positionsLoading, tokenIds]);
}

export default function usePositions() {
  const chainId = useCurrentChainId();
  const { address: account } = useAccount();

  const { data: balance, isLoading: balanceLoading } = useReadContract({
    address: NONFUNGIBLE_POSITION_MANAGER_ADDRESS[chainId as DexChainId],
    abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
    functionName: "balanceOf",
    args: account && [account],
    query: {
      enabled: Boolean(account),
    },
  });

  const tokenIdsArgs = useMemo(() => {
    if (balance && account) {
      const tokenRequests = [];
      for (let i = 0; i < Number(balance); i++) {
        tokenRequests.push([account, i]);
      }
      return tokenRequests;
    }
    return [];
  }, [account, balance]);

  const tokenIdsContracts = useMemo(() => {
    return tokenIdsArgs.map((tokenId) => ({
      abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
      functionName: "tokenOfOwnerByIndex",
      args: tokenId,
      address: NONFUNGIBLE_POSITION_MANAGER_ADDRESS[chainId as DexChainId],
    }));
  }, [chainId, tokenIdsArgs]);

  const { data: tokenIdsData, isLoading: tokenIdsLoading } = useReadContracts({
    contracts: tokenIdsContracts,
  });

  const { positions, loading: positionsLoading } = usePositionsFromTokenIds(
    tokenIdsData
      ?.filter((value) => !!value.result && typeof value.result === "bigint")
      .map((value) => value.result as bigint),
  );

  return {
    positions,
    loading: positionsLoading || tokenIdsLoading || balanceLoading,
  };
}

export function usePositionFromPositionInfo(positionDetails: PositionInfo) {
  const chainId = useCurrentChainId();
  const tokens = useTokens();

  const tokenAFromLists = useMemo(() => {
    let tokenStandard: Standard | undefined = undefined;
    const token = tokens.find((t) => {
      if (t.wrapped.address0.toLowerCase() === positionDetails?.token0?.toLowerCase()) {
        tokenStandard = Standard.ERC20;
        return true;
      } else if (t.wrapped.address1.toLowerCase() === positionDetails?.token0?.toLowerCase()) {
        tokenStandard = Standard.ERC223;
        return true;
      }
    });
    if (token && tokenStandard) return { token, tokenStandard };
  }, [positionDetails?.token0, tokens]); // refreshDepositsTrigger

  const tokenBFromLists = useMemo(() => {
    let tokenStandard: Standard | undefined = undefined;
    const token = tokens.find((t) => {
      if (t.wrapped.address0.toLowerCase() === positionDetails?.token1?.toLowerCase()) {
        tokenStandard = Standard.ERC20;
        return true;
      } else if (t.wrapped.address1.toLowerCase() === positionDetails?.token1?.toLowerCase()) {
        tokenStandard = Standard.ERC223;
        return true;
      }
    });
    if (token && tokenStandard) return { token, tokenStandard };
  }, [positionDetails?.token1, tokens]);

  // TODO: now we use "Boolean(tokens.length)" but better to add init status to token lists and check it instead
  // Get token info from node only if we don't find token in our lists
  const isTokenADetailsEnabled =
    !tokenAFromLists && Boolean(positionDetails?.token0) && Boolean(tokens.length);
  const isTokenBDetailsEnabled =
    !tokenBFromLists && Boolean(positionDetails?.token1) && Boolean(tokens.length);
  const { data: tokenAInfo }: any = useReadContracts({
    allowFailure: false,
    contracts: [
      {
        address: CONVERTER_ADDRESS[chainId],
        abi: TOKEN_CONVERTER_ABI,
        functionName: "predictWrapperAddress",
        args: [positionDetails?.token0 as Address, true],
      },
      {
        address: positionDetails?.token0,
        abi: ERC20_ABI,
        functionName: "decimals",
      },
      {
        address: positionDetails?.token0,
        abi: ERC20_ABI,
        functionName: "symbol",
      },
      {
        address: positionDetails?.token0,
        abi: ERC20_ABI,
        functionName: "name",
      },
    ],
    query: {
      enabled: isTokenADetailsEnabled,
    },
  });
  const { data: tokenBInfo }: any = useReadContracts({
    allowFailure: false,
    contracts: [
      {
        address: CONVERTER_ADDRESS[chainId],
        abi: TOKEN_CONVERTER_ABI,
        functionName: "predictWrapperAddress",
        args: [positionDetails?.token1 as Address, true],
      },
      {
        address: positionDetails?.token1,
        abi: ERC20_ABI,
        functionName: "decimals",
      },
      {
        address: positionDetails?.token1,
        abi: ERC20_ABI,
        functionName: "symbol",
      },
      {
        address: positionDetails?.token1,
        abi: ERC20_ABI,
        functionName: "name",
      },
    ],
    query: {
      enabled: isTokenBDetailsEnabled,
    },
  });

  // Create Tokens using info from blockchain\node
  const tokenAFromNode = tokenAInfo?.length
    ? new Token(
        chainId,
        positionDetails?.token0 as Address,
        tokenAInfo?.[0] as Address,
        tokenAInfo?.[1],
        tokenAInfo?.[2],
        tokenAInfo?.[3],
        "/images/tokens/placeholder.svg",
      )
    : undefined;
  const tokenBFromNode = tokenBInfo?.length
    ? new Token(
        chainId,
        positionDetails?.token1 as Address,
        tokenBInfo?.[0] as Address,
        tokenBInfo?.[1],
        tokenBInfo?.[2],
        tokenBInfo?.[3],
        "/images/tokens/placeholder.svg",
      )
    : undefined;

  const tokenA = tokenAFromLists?.token || tokenAFromNode;
  const tokenB = tokenBFromLists?.token || tokenBFromNode;

  const pool = usePool({
    currencyA: tokenA,
    currencyB: tokenB,
    tier: positionDetails?.tier,
  });

  // setRefreshDepositsTrigger(false);

  return useMemo(() => {
    if (pool[1] && positionDetails) {
      return new Position({
        pool: pool[1],
        tickLower: positionDetails.tickLower,
        tickUpper: positionDetails.tickUpper,
        liquidity: BigInt(positionDetails.liquidity.toString()),
      });
    }
  }, [pool, positionDetails]);
}

function getRatio(
  lower: Price<Currency, Currency>,
  current: Price<Currency, Currency>,
  upper: Price<Currency, Currency>,
) {
  try {
    if (+current < +lower) {
      return 100;
    } else if (+current > +upper) {
      return 0;
    }

    const a = Number.parseFloat(lower.toSignificant(15));
    const b = Number.parseFloat(upper.toSignificant(15));
    const c = Number.parseFloat(current.toSignificant(15));

    const ratio = Math.floor(
      (1 / ((Math.sqrt(a * b) - Math.sqrt(b * c)) / (c - Math.sqrt(b * c)) + 1)) * 100,
    );

    if (ratio < 0 || ratio > 100) {
      throw Error("Out of range");
    }

    return ratio;
  } catch {
    return undefined;
  }
}
export function usePositionPrices({
  position,
  showFirst,
}: {
  position: Position | undefined;
  showFirst: boolean;
}) {
  const minPrice = useMemo(() => {
    if (showFirst) {
      return position?.token0PriceUpper.invert();
    }

    return position?.token0PriceLower;
  }, [position?.token0PriceLower, position?.token0PriceUpper, showFirst]);

  const maxPrice = useMemo(() => {
    if (showFirst) {
      return position?.token0PriceLower.invert();
    }

    return position?.token0PriceUpper;
  }, [position?.token0PriceLower, position?.token0PriceUpper, showFirst]);

  const currentPrice = useMemo(() => {
    if (showFirst) {
      return position?.pool.token1Price;
    }

    return position?.pool.token0Price;
  }, [position?.pool.token0Price, position?.pool.token1Price, showFirst]);

  const [minPriceString, maxPriceString, currentPriceString] = useMemo(() => {
    if (minPrice && maxPrice && currentPrice) {
      return [minPrice.toSignificant(), maxPrice.toSignificant(), currentPrice.toSignificant()];
    }

    return ["0", "0", "0"];
  }, [currentPrice, maxPrice, minPrice]);

  const ratio = useMemo(() => {
    if (minPrice && currentPrice && maxPrice) {
      return getRatio(minPrice, currentPrice, maxPrice);
    }
  }, [currentPrice, maxPrice, minPrice]);

  return {
    minPriceString,
    maxPriceString,
    currentPriceString,
    ratio,
  };
}

export function usePositionRangeStatus({ position }: { position: Position | undefined }) {
  const below =
    position?.pool && typeof position?.tickUpper === "number"
      ? position.pool.tickCurrent < position.tickLower
      : undefined;
  const above =
    position?.pool && typeof position?.tickLower === "number"
      ? position.pool.tickCurrent >= position.tickUpper
      : undefined;
  const inRange: boolean =
    typeof below === "boolean" && typeof above === "boolean" ? !below && !above : false;

  const removed = position ? position.liquidity === BigInt(0) : false;

  return {
    inRange,
    removed,
  };
}
