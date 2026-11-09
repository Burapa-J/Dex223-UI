/**
 * Subgraphs served through The Graph's decentralized gateway, which needs an API key. The browser
 * never sees that key: it calls `/api/subgraph/<target>`, and the route adds the key server-side
 * (GRAPH_API_KEY). Subgraph Studio query URLs need no key and are still called directly.
 *
 * Only the upstream URLs live here (they are public); no secret is ever imported into client code.
 */
export const GATEWAY_SUBGRAPHS = {
  "exchange-mainnet":
    "https://gateway.thegraph.com/api/subgraphs/id/A3mMtVLVvdbpgXduav8znCv7qdvXhSeWxST27pxdx4Mm",
  "autolisting-mainnet":
    "https://gateway.thegraph.com/api/subgraphs/id/4Zk7s54TCuxMvJVWMzDax5QRsGVRTPoXmw58gKqzZGQi",
  "margin-mainnet":
    "https://gateway.thegraph.com/api/subgraphs/id/4Zk7s54TCuxMvJVWMzDax5QRsGVRTPoXmw58gKqzZGQi",
} as const;

export type GatewaySubgraph = keyof typeof GATEWAY_SUBGRAPHS;

/** Path of the same-origin proxy for a gateway subgraph. */
export function subgraphProxyPath(target: GatewaySubgraph): string {
  return `/api/subgraph/${target}`;
}
