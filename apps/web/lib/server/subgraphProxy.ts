import { GATEWAY_SUBGRAPHS } from "../subgraphTargets";
import { clientIp, createRateLimiter, jsonResponse, type RateLimiter, readBody } from "./rateLimit";

export const SUBGRAPH_MAX_BODY_BYTES = 64 * 1024;
const SUBGRAPH_REQUESTS_PER_MINUTE = 120;

const defaultLimiter = createRateLimiter(SUBGRAPH_REQUESTS_PER_MINUTE, 60_000);

type Options = {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  limiter?: RateLimiter;
};

/**
 * POST a GraphQL body to an allowlisted gateway subgraph with the server's Graph API key.
 * Returns the upstream status and JSON body only: no upstream headers, never the key.
 */
export async function proxySubgraph(
  target: string,
  request: Request,
  { apiKey = process.env.GRAPH_API_KEY, fetchImpl = fetch, limiter = defaultLimiter }: Options = {},
): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);

  const upstream = Object.prototype.hasOwnProperty.call(GATEWAY_SUBGRAPHS, target)
    ? GATEWAY_SUBGRAPHS[target as keyof typeof GATEWAY_SUBGRAPHS]
    : undefined;
  if (!upstream) return jsonResponse({ error: "unknown subgraph" }, 404);

  if (!limiter.take(clientIp(request.headers))) {
    return jsonResponse({ error: "too many requests" }, 429);
  }

  const body = await readBody(request, SUBGRAPH_MAX_BODY_BYTES);
  if (body === null) return jsonResponse({ error: "request too large" }, 413);

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return jsonResponse({ error: "invalid JSON" }, 400);
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as { query?: unknown }).query !== "string"
  ) {
    return jsonResponse({ error: "expected a GraphQL query" }, 400);
  }

  if (!apiKey) return jsonResponse({ error: "subgraph proxy not configured" }, 503);

  try {
    const res = await fetchImpl(upstream, {
      method: "POST",
      // The gateway key is restricted to our production domains. Requests from the server carry no
      // browser Origin, so the proxy names the production app itself; the gateway refuses
      // origin-less calls with "domain not authorized by user".
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        origin: "https://app.dex223.io",
        referer: "https://app.dex223.io/",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    // Only JSON goes back; anything else (an HTML error page, say) becomes a plain 502.
    try {
      JSON.parse(text);
    } catch {
      return jsonResponse({ error: "bad upstream response" }, 502);
    }
    return jsonResponse(text.split(apiKey).join("[redacted]"), res.status);
  } catch {
    return jsonResponse({ error: "upstream unavailable" }, 502);
  }
}
