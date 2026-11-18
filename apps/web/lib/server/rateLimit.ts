/**
 * Per-IP fixed-window counter for the API proxy routes.
 *
 * In memory, per server instance: on Vercel every instance keeps its own window, so this caps abuse
 * of one instance rather than giving an exact global limit. It is the first step; a shared store
 * (e.g. Upstash/Redis) is the follow-up if the routes are abused across instances.
 */
export type RateLimiter = {
  /** Count `cost` hits for `key`; false when the window's limit would be exceeded. */
  take: (key: string, cost?: number, now?: number) => boolean;
};

export function createRateLimiter(limit: number, windowMs: number, maxKeys = 10_000): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();

  return {
    take(key, cost = 1, now = Date.now()) {
      let entry = windows.get(key);
      if (!entry || now - entry.start >= windowMs) {
        if (!entry && windows.size >= maxKeys) {
          // Drop expired windows; if every one is live, start over rather than grow without bound.
          windows.forEach((value, k) => {
            if (now - value.start >= windowMs) windows.delete(k);
          });
          if (windows.size >= maxKeys) windows.clear();
        }
        entry = { start: now, count: 0 };
        windows.set(key, entry);
      }
      if (entry.count + cost > limit) return false;
      entry.count += cost;
      return true;
    },
  };
}

/** Client address as Vercel reports it: the first x-forwarded-for entry, else x-real-ip. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim() || "unknown";
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** JSON response with nothing cached and no upstream headers passed through. */
export function jsonResponse(body: unknown, status: number): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/**
 * Request body as text, refused when it is larger than `maxBytes` (by content-length up front,
 * and by the bytes actually read).
 */
export async function readBody(request: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return null;
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) return null;
  return text;
}
