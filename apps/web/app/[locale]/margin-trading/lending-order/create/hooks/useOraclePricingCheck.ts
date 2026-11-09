import { useCallback, useMemo, useState } from "react";
import { Address, zeroAddress } from "viem";
import { usePublicClient, useReadContracts, useWalletClient } from "wagmi";

import { FACTORY_ABI } from "@/config/abis/factory";
import { ORACLE_ABI } from "@/config/abis/oracle";
import { POOL_ABI } from "@/config/abis/pool";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { FACTORY_ADDRESS, ORACLE_ADDRESS } from "@/sdk_bi/addresses";
import { Currency } from "@/sdk_bi/entities/currency";

/** Slots the observation ring needs before we stop warning; matches scripts/observation-rings.ts. */
export const ORACLE_RING_TARGET = 50;
const FEE_TIERS = [500, 3000, 10000] as const;

export enum OraclePricingState {
  OK,
  /** A pool exists but keeps fewer than ORACLE_RING_TARGET observations: fixable with Enable pricing. */
  THIN,
  /** No pool the oracle can use. The token cannot be priced, so the order would be unusable. */
  NO_POOL,
}

export type OraclePricingResult = {
  token: Currency;
  state: OraclePricingState;
  /** Pool whose ring Enable pricing grows (THIN only). */
  pool?: Address;
};

const key = (currency: Currency) => currency.wrapped.address0.toLowerCase();

/**
 * Checks that the margin oracle can price every token against the loan token. The oracle only uses a
 * pool whose oldest observation is 30 minutes old; a pool with a 1-slot ring loses that after every
 * trade, so margin swaps into the token revert and positions cannot be valued or liquidated.
 */
export function useOraclePricingCheck(loanToken: Currency | undefined, tokens: Currency[]) {
  const chainId = useCurrentChainId();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [enabling, setEnabling] = useState<string | undefined>();
  const [enabled, setEnabled] = useState<Set<string>>(new Set());

  const checked = useMemo(() => {
    if (!loanToken) return [];
    const seen = new Set<string>();
    return tokens.filter((token) => {
      const k = key(token);
      if (k === key(loanToken) || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [loanToken, tokens]);

  const oracle = ORACLE_ADDRESS[chainId];
  const factory = FACTORY_ADDRESS[chainId];
  const loan = loanToken?.wrapped.address0;

  // Per token: the oracle's pick, then every fee tier's pool (to tell THIN from NO_POOL when the
  // oracle refuses, e.g. a 1-slot pool right after a trade).
  const { data: lookups, refetch: refetchLookups } = useReadContracts({
    allowFailure: true,
    contracts: checked.flatMap((token) => [
      {
        address: oracle,
        abi: ORACLE_ABI,
        functionName: "findPoolWithHighestLiquidity",
        args: [token.wrapped.address0, loan!],
      } as const,
      ...FEE_TIERS.map(
        (fee) =>
          ({
            address: factory,
            abi: FACTORY_ABI,
            functionName: "getPool",
            args: [token.wrapped.address0, loan!, fee],
          }) as const,
      ),
    ]),
    query: { enabled: !!loan && !!oracle && !!factory && checked.length > 0 },
  });

  const candidates = useMemo(() => {
    const step = 1 + FEE_TIERS.length;
    return checked.map((token, i) => {
      const found = lookups?.[i * step];
      const oraclePool =
        found?.status === "success"
          ? ((found.result as readonly unknown[])[0] as Address)
          : undefined;
      const pools = FEE_TIERS.map((_, j) => lookups?.[i * step + 1 + j])
        .map((r) => (r?.status === "success" ? (r.result as Address) : undefined))
        .filter((p): p is Address => !!p && p !== zeroAddress);
      return { token, oraclePool, pools: oraclePool ? [oraclePool] : pools };
    });
  }, [checked, lookups]);

  const { data: slots, refetch: refetchSlots } = useReadContracts({
    allowFailure: true,
    contracts: candidates.flatMap(({ pools }) =>
      pools.map((pool) => ({ address: pool, abi: POOL_ABI, functionName: "slot0" }) as const),
    ),
    query: { enabled: candidates.some(({ pools }) => pools.length > 0) },
  });

  const results: OraclePricingResult[] = useMemo(() => {
    if (!lookups) return [];
    let offset = 0;
    return candidates.map(({ token, oraclePool, pools }) => {
      const nexts = pools.map((pool, j) => {
        const r = slots?.[offset + j];
        const next =
          r?.status === "success" ? Number((r.result as readonly unknown[])[4]) : undefined;
        return { pool, next };
      });
      offset += pools.length;
      const thin = nexts.find(({ next }) => next !== undefined && next < ORACLE_RING_TARGET);
      if (thin) return { token, state: OraclePricingState.THIN, pool: thin.pool };
      if (oraclePool) return { token, state: OraclePricingState.OK };
      return { token, state: OraclePricingState.NO_POOL };
    });
  }, [candidates, lookups, slots]);

  const enablePricing = useCallback(
    async (result: OraclePricingResult): Promise<"success" | "failed" | "rejected"> => {
      if (!walletClient || !publicClient || !result.pool) return "rejected";
      const k = key(result.token);
      setEnabling(k);
      try {
        const hash = await walletClient.writeContract({
          address: result.pool,
          abi: POOL_ABI,
          functionName: "increaseObservationCardinalityNext",
          args: [ORACLE_RING_TARGET],
          account: walletClient.account,
          chain: walletClient.chain,
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("reverted");
        setEnabled((prev) => new Set(prev).add(k));
        await refetchLookups();
        await refetchSlots();
        return "success";
      } catch (e) {
        return e instanceof Error && e.message === "reverted" ? "failed" : "rejected";
      } finally {
        setEnabling(undefined);
      }
    },
    [publicClient, refetchLookups, refetchSlots, walletClient],
  );

  return {
    results,
    stateOf: (token: Currency) =>
      results.find((r) => key(r.token) === key(token))?.state ?? OraclePricingState.OK,
    hasBlocking: results.some((r) => r.state === OraclePricingState.NO_POOL),
    enabledTokens: checked.filter((t) => enabled.has(key(t))),
    isEnabling: (token: Currency) => enabling === key(token),
    enablePricing,
  };
}
