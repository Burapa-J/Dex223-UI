/**
 * URL of our own JSON-RPC proxy (app/api/rpc/[chain]/route.ts), which adds the provider keys
 * server-side. In the browser it is absolute on the current origin, so it works on every deployment
 * (production, test-app and previews) without configuration. On the server, where the wallet
 * transports are not used, it stays relative.
 */
export function rpcProxyUrl(chain: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/api/rpc/${chain}`;
}
