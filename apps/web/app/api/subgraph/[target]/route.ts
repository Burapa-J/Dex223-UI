import { proxySubgraph } from "@/lib/server/subgraphProxy";

// Keyed The Graph gateway queries. The key (GRAPH_API_KEY) is server-only and never reaches the browser.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ target: string }> }) {
  const { target } = await params;
  return proxySubgraph(target, request);
}
