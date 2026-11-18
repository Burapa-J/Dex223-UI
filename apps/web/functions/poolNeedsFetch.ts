/** How long a loaded pool is trusted before it is read from the chain again. */
export const POOL_TTL_MS = 60_000;
/** How soon a failed pool lookup is retried. */
export const POOL_INVALID_RETRY_MS = 10_000;

export type PoolFetchStatus = "idle" | "loading" | "loaded" | "invalid";
type PoolFetchRecord = { status: PoolFetchStatus; lastUpdated: number };

/**
 * Whether a cached pool must be fetched again.
 *
 * `invalidateAll()` marks pools stale after a swap by setting `lastUpdated` to 0. The old check was
 * `lastUpdated && lastUpdated < now - 60s`, and 0 is falsy, so an invalidated pool was never fetched
 * again until a page reload: the next quote kept the pre-swap pool (Dario: 34%, then 66% price
 * impact for the same amount, 25% after a reload).
 */
export function poolNeedsFetch(record: PoolFetchRecord | undefined, now: number): boolean {
  if (!record || record.status === "idle") return true;
  if (record.status === "loading") return false;
  if (record.status === "invalid") return record.lastUpdated < now - POOL_INVALID_RETRY_MS;
  return record.lastUpdated < now - POOL_TTL_MS;
}
