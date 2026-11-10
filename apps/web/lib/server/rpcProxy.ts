import { clientIp, createRateLimiter, jsonResponse, type RateLimiter, readBody } from "./rateLimit";

// A signed transaction can be up to 128 KB, i.e. 256 KB as hex, plus the JSON-RPC envelope.
export const RPC_MAX_BODY_BYTES = 300 * 1024;
export const RPC_MAX_BATCH = 20;
export const RPC_MAX_LOG_RANGE = 10_000n;
// Each call in a batch counts towards the limit.
const RPC_CALLS_PER_MINUTE = 600;

const defaultLimiter = createRateLimiter(RPC_CALLS_PER_MINUTE, 60_000);

/** What the app reads and sends. Everything else (debug_*, trace_*, filters, admin...) is refused. */
export const RPC_ALLOWED_METHODS = new Set([
  "eth_chainId",
  "eth_blockNumber",
  "eth_call",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_maxPriorityFeePerGas",
  "eth_feeHistory",
  "eth_getBalance",
  "eth_getCode",
  "eth_getTransactionCount",
  "eth_getTransactionReceipt",
  "eth_getTransactionByHash",
  "eth_getBlockByNumber",
  "eth_getBlockByHash",
  "eth_getLogs",
  "eth_getStorageAt",
  "eth_sendRawTransaction",
]);

const NULL_MEANS_ASK_ANOTHER = new Set(["eth_getTransactionReceipt", "eth_getTransactionByHash"]);

type Env = Record<string, string | undefined>;

/** Keyed upstreams per chain, in the order they are tried. A provider without its key is skipped. */
function upstreams(chain: string, env: Env): string[] | undefined {
  if (chain === "mainnet") {
    const urls: string[] = [];
    if (env.ALCHEMY_API_KEY)
      urls.push(`https://eth-mainnet.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`);
    return urls;
  }
  if (chain === "sepolia") {
    const urls: string[] = [];
    if (env.ALCHEMY_API_KEY)
      urls.push(`https://eth-sepolia.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`);
    if (env.INFURA_API_KEY) urls.push(`https://sepolia.infura.io/v3/${env.INFURA_API_KEY}`);
    return urls;
  }
  return undefined;
}

type RpcCall = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };

function blockNumber(tag: unknown): bigint | undefined {
  return typeof tag === "string" && /^0x[0-9a-fA-F]{1,16}$/.test(tag) ? BigInt(tag) : undefined;
}

/** null when the call is allowed, otherwise the reason it is refused. */
export function rejectReason(call: RpcCall): string | null {
  if (!call || typeof call !== "object" || typeof call.method !== "string")
    return "invalid request";
  if (!RPC_ALLOWED_METHODS.has(call.method)) return "method not allowed";
  if (call.method === "eth_getLogs") {
    const filter = Array.isArray(call.params)
      ? (call.params[0] as Record<string, unknown>)
      : undefined;
    if (!filter || typeof filter !== "object") return "invalid log filter";
    if (filter.blockHash !== undefined) {
      if (typeof filter.blockHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(filter.blockHash))
        return "invalid blockHash";
      if (filter.fromBlock !== undefined || filter.toBlock !== undefined)
        return "blockHash cannot be combined with fromBlock or toBlock";
      return null;
    }
    const from = blockNumber(filter.fromBlock);
    if (from === undefined) return "eth_getLogs needs a numeric fromBlock";
    const to = blockNumber(filter.toBlock);
    if (to === undefined) return "eth_getLogs needs a numeric toBlock";
    if (to < from || to - from > RPC_MAX_LOG_RANGE)
      return "log range too large";
  }
  return null;
}

type Options = { env?: Env; fetchImpl?: typeof fetch; limiter?: RateLimiter };

/**
 * Forward an allowlisted JSON-RPC request (single or batch) to the chain's keyed provider.
 * Returns the upstream JSON body only: no upstream headers, and the key never appears in it.
 */
export async function proxyRpc(
  chain: string,
  request: Request,
  { env = process.env, fetchImpl = fetch, limiter = defaultLimiter }: Options = {},
): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);

  const urls = upstreams(chain, env);
  if (!urls) return jsonResponse({ error: "unknown chain" }, 404);

  const body = await readBody(request, RPC_MAX_BODY_BYTES);
  if (body === null) return jsonResponse({ error: "request too large" }, 413);

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return jsonResponse(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } },
      400,
    );
  }

  const calls = (Array.isArray(parsed) ? parsed : [parsed]) as RpcCall[];
  if (calls.length === 0 || calls.length > RPC_MAX_BATCH) {
    return jsonResponse(
      { jsonrpc: "2.0", id: null, error: { code: -32600, message: "batch size" } },
      400,
    );
  }
  for (const call of calls) {
    const reason = rejectReason(call);
    if (reason) {
      const id = call && typeof call === "object" ? (call.id ?? null) : null;
      return jsonResponse({ jsonrpc: "2.0", id, error: { code: -32601, message: reason } }, 400);
    }
  }

  if (!limiter.take(clientIp(request.headers), calls.length)) {
    return jsonResponse({ error: "too many requests" }, 429);
  }

  // 503 lets the client's fallback transport move on to the next RPC.
  if (urls.length === 0) return jsonResponse({ error: "rpc proxy not configured" }, 503);

  const secrets = [env.ALCHEMY_API_KEY, env.INFURA_API_KEY].filter((s): s is string => !!s);
  const redact = (text: string) => secrets.reduce((t, s) => t.split(s).join("[redacted]"), text);

  for (const url of urls) {
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        // Provider keys carry a domain allowlist, and a provider refuses origin-less calls once one
        // is set, which is what a server-side request looks like. The proxy names the production app.
        headers: {
          "content-type": "application/json",
          origin: "https://app.dex223.io",
          referer: "https://app.dex223.io/",
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status >= 500 || res.status === 429) continue; // next provider
      const text = await res.text();
      let answer: unknown;
      try {
        answer = JSON.parse(text);
      } catch {
        continue;
      }
      // Some nodes answer null for receipts they do not have; ask the next provider, as the
      // client's receiptAwareFallback did when these were separate transports.
      const single = !Array.isArray(answer) ? (answer as { result?: unknown }) : undefined;
      const call = calls.length === 1 ? calls[0] : undefined;
      if (
        url !== urls[urls.length - 1] &&
        single &&
        single.result === null &&
        call &&
        NULL_MEANS_ASK_ANOTHER.has(call.method as string)
      ) {
        continue;
      }
      return jsonResponse(redact(text), res.status);
    } catch {
      // network error or timeout: next provider
    }
  }
  return jsonResponse({ error: "upstream unavailable" }, 502);
}
