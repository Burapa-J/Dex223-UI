import { proxyRpc } from "@/lib/server/rpcProxy";

// JSON-RPC to keyed providers (ALCHEMY_API_KEY, INFURA_API_KEY), server-only. Allowlisted methods only.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ chain: string }> }) {
  const { chain } = await params;
  return proxyRpc(chain, request);
}
