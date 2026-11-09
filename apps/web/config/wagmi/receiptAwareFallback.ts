import { fallback, type FallbackTransportConfig, type Transport } from "viem";

// Lookups where some public RPCs answer `null` for data they simply don't have. publicnode's Sepolia
// node, for example, permanently returns no receipt for some mined transactions (e.g. Dario's revenue
// approve 0xdb01…f6, block 12071802) while Alchemy and Infura return it. viem's fallback only moves to
// the next RPC on an error, not on `null`, so waitForTransactionReceipt kept polling the same node
// until it failed with "Transaction receipt … could not be found".
const NULL_MEANS_ASK_ANOTHER = new Set(["eth_getTransactionReceipt", "eth_getTransactionByHash"]);

/**
 * `fallback(transports)` that also asks the other HTTP RPCs when one of the lookups above returns
 * `null`. Everything else behaves exactly like viem's fallback.
 */
export function receiptAwareFallback(
  transports: Transport[],
  config?: FallbackTransportConfig,
): Transport {
  const base = fallback(transports, config);

  return ((params) => {
    const primary = base(params);
    let others: ReturnType<Transport>[] | undefined;

    const request = (async (
      args: { method: string; params?: unknown },
      options?: Parameters<typeof primary.request>[1],
    ) => {
      const result = await primary.request(args as never, options);
      if (result !== null || !NULL_MEANS_ASK_ANOTHER.has(args.method)) {
        return result;
      }

      // Created once, lazily; only HTTP transports, so no extra sockets are opened.
      others ??= transports
        .map((transport) => transport({ ...params, retryCount: 0 }))
        .filter((transport) => transport.config.type === "http");

      for (const other of others) {
        try {
          const answer = await other.request(args as never, options);
          if (answer !== null && answer !== undefined) {
            return answer;
          }
        } catch {
          // Try the next RPC.
        }
      }
      return result;
    }) as typeof primary.request;

    return { ...primary, request };
  }) as Transport;
}
