// Regression tests for the server-side key proxies (bounty #71 Alchemy, #72 The Graph): the API keys
// stay on the server, only allowlisted targets and methods pass, and responses never carry a key.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const cache = new Map();
function load(file) {
  const filename = path.resolve(root, file.endsWith(".ts") ? file : `${file}.ts`);
  if (cache.has(filename)) return cache.get(filename);
  const mod = { exports: {} };
  cache.set(filename, mod.exports);
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function("require", "module", "exports", out)(
    (name) => (name.startsWith(".") ? load(path.join(path.dirname(filename), name)) : require(name)),
    mod,
    mod.exports,
  );
  Object.assign(cache.get(filename), mod.exports);
  return mod.exports;
}

const { proxySubgraph } = load("lib/server/subgraphProxy");
const { proxyRpc, RPC_MAX_LOG_RANGE } = load("lib/server/rpcProxy");
const { createRateLimiter } = load("lib/server/rateLimit");

const GRAPH_KEY = "graph-test-key-0123456789abcdef";
const ALCHEMY_KEY = "alchemy-test-key-0123456789";
const INFURA_KEY = "infura-test-key-0123456789";
const env = { ALCHEMY_API_KEY: ALCHEMY_KEY, INFURA_API_KEY: INFURA_KEY };
const roomy = () => createRateLimiter(1_000_000, 60_000);

function post(body, headers = {}) {
  return new Request("https://app.example/api", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function recordingFetch(reply) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    return reply(String(url), init, calls.length);
  };
  return { calls, fetchImpl };
}

const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", "x-upstream-secret": "leak" },
  });

async function assertNoKey(res) {
  const text = await res.clone().text();
  for (const key of [GRAPH_KEY, ALCHEMY_KEY, INFURA_KEY]) assert.ok(!text.includes(key), "key in body");
  const headerDump = JSON.stringify([...res.headers.entries()]);
  for (const key of [GRAPH_KEY, ALCHEMY_KEY, INFURA_KEY]) assert.ok(!headerDump.includes(key), "key in headers");
  assert.equal(res.headers.get("x-upstream-secret"), null, "upstream headers passed through");
  assert.equal(res.headers.get("cache-control"), "no-store");
}

test("subgraph: unknown target is 404 and never reaches upstream", async () => {
  const { calls, fetchImpl } = recordingFetch(() => json({}));
  const res = await proxySubgraph("someone-elses-subgraph", post({ query: "{ x }" }), {
    apiKey: GRAPH_KEY,
    fetchImpl,
    limiter: roomy(),
  });
  assert.equal(res.status, 404);
  assert.equal(calls.length, 0);
});

test("subgraph: adds the server key upstream, returns only the JSON body", async () => {
  const { calls, fetchImpl } = recordingFetch(() => json({ data: { echo: GRAPH_KEY } }));
  const res = await proxySubgraph("exchange-mainnet", post({ query: "{ factories { id } }" }), {
    apiKey: GRAPH_KEY,
    fetchImpl,
    limiter: roomy(),
  });
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^https:\/\/gateway\.thegraph\.com\//);
  assert.equal(calls[0].init.headers.authorization, `Bearer ${GRAPH_KEY}`);
  await assertNoKey(res);
});

test("subgraph: oversized body is 413", async () => {
  const { calls, fetchImpl } = recordingFetch(() => json({}));
  const big = JSON.stringify({ query: `{ x } #${"a".repeat(70 * 1024)}` });
  const res = await proxySubgraph("exchange-mainnet", post(big), { apiKey: GRAPH_KEY, fetchImpl, limiter: roomy() });
  assert.equal(res.status, 413);
  assert.equal(calls.length, 0);
});

test("subgraph: GET, missing key and rate limit are refused", async () => {
  const { fetchImpl } = recordingFetch(() => json({}));
  const get = new Request("https://app.example/api", { method: "GET" });
  assert.equal((await proxySubgraph("exchange-mainnet", get, { apiKey: GRAPH_KEY, fetchImpl })).status, 405);
  const noKey = await proxySubgraph("exchange-mainnet", post({ query: "{ x }" }), {
    apiKey: "",
    fetchImpl,
    limiter: roomy(),
  });
  assert.equal(noKey.status, 503);
  const limiter = createRateLimiter(1, 60_000);
  const opts = { apiKey: GRAPH_KEY, fetchImpl, limiter };
  assert.equal((await proxySubgraph("exchange-mainnet", post({ query: "{ x }" }), opts)).status, 200);
  assert.equal((await proxySubgraph("exchange-mainnet", post({ query: "{ x }" }), opts)).status, 429);
});

test("rpc: disallowed method is refused before any upstream call", async () => {
  const { calls, fetchImpl } = recordingFetch(() => json({ jsonrpc: "2.0", id: 1, result: "0x1" }));
  for (const method of ["debug_traceTransaction", "eth_newFilter", "admin_peers", "trace_block"]) {
    const res = await proxyRpc("sepolia", post({ jsonrpc: "2.0", id: 1, method, params: [] }), {
      env,
      fetchImpl,
      limiter: roomy(),
    });
    assert.equal(res.status, 400, method);
  }
  // One bad call in a batch refuses the whole batch.
  const batch = [
    { jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] },
    { jsonrpc: "2.0", id: 2, method: "debug_traceCall", params: [] },
  ];
  assert.equal((await proxyRpc("sepolia", post(batch), { env, fetchImpl, limiter: roomy() })).status, 400);
  assert.equal(calls.length, 0);
});

test("rpc: mainnet goes to Alchemy mainnet only, and without a key it is 503", async () => {
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(String(url));
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x1" }), { status: 200 });
  };
  const call = { jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] };
  const env = { ALCHEMY_API_KEY: "k".repeat(32) };
  const res = await proxyRpc("mainnet", post(call), { env, fetchImpl, limiter: roomy() });
  assert.equal(res.status, 200);
  assert.equal(seen.length, 1);
  assert.match(seen[0], /^https:\/\/eth-mainnet\.g\.alchemy\.com\/v2\//);
  assert.ok(!(await res.text()).includes("k".repeat(32)));
  const none = await proxyRpc("mainnet", post(call), { env: {}, fetchImpl, limiter: roomy() });
  assert.equal(none.status, 503);
});

test("rpc: unknown chain 404, oversized body 413, oversized batch 400", async () => {
  const { calls, fetchImpl } = recordingFetch(() => json({ jsonrpc: "2.0", id: 1, result: "0x1" }));
  const call = { jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] };
  assert.equal((await proxyRpc("mainnet-archive", post(call), { env, fetchImpl, limiter: roomy() })).status, 404);
  const big = JSON.stringify({ ...call, params: ["0x" + "ab".repeat(200 * 1024)] });
  assert.equal((await proxyRpc("sepolia", post(big), { env, fetchImpl, limiter: roomy() })).status, 413);
  const batch = Array.from({ length: 21 }, (_, i) => ({ ...call, id: i }));
  assert.equal((await proxyRpc("sepolia", post(batch), { env, fetchImpl, limiter: roomy() })).status, 400);
  assert.equal(calls.length, 0);
});

test("rpc: eth_getLogs needs a numeric, bounded range", async () => {
  const { fetchImpl } = recordingFetch(() => json({ jsonrpc: "2.0", id: 1, result: [] }));
  const logs = (filter) => post({ jsonrpc: "2.0", id: 1, method: "eth_getLogs", params: [filter] });
  const opts = { env, fetchImpl, limiter: roomy() };
  assert.equal((await proxyRpc("sepolia", logs({ fromBlock: "earliest", toBlock: "latest" }), opts)).status, 400);
  assert.equal((await proxyRpc("sepolia", logs({ fromBlock: "0x0", toBlock: "latest" }), opts)).status, 400);
  assert.equal((await proxyRpc("sepolia", logs({ fromBlock: "0x0" }), opts)).status, 400);
  const tooWide = { fromBlock: "0x0", toBlock: "0x" + (RPC_MAX_LOG_RANGE + 1n).toString(16) };
  assert.equal((await proxyRpc("sepolia", logs(tooWide), opts)).status, 400);
  assert.equal((await proxyRpc("sepolia", logs({ fromBlock: "0x100", toBlock: "0x200" }), opts)).status, 200);
  assert.equal((await proxyRpc("sepolia", logs({ blockHash: "0x" + "1".repeat(64) }), opts)).status, 200);
  assert.equal((await proxyRpc("sepolia", logs({ blockHash: "invalid" }), opts)).status, 400);
  assert.equal(
    (await proxyRpc("sepolia", logs({ blockHash: "0x" + "1".repeat(64), fromBlock: "0x0", toBlock: "latest" }), opts))
      .status,
    400,
  );
});

test("rpc: forwards to Alchemy, falls back to Infura, never returns a key", async () => {
  const { calls, fetchImpl } = recordingFetch((url) =>
    url.includes("alchemy") ? json({ error: "down" }, 503) : json({ jsonrpc: "2.0", id: 1, result: url }),
  );
  const res = await proxyRpc("sepolia", post({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }), {
    env,
    fetchImpl,
    limiter: roomy(),
  });
  assert.equal(res.status, 200);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /alchemy/);
  assert.match(calls[1].url, /infura/);
  await assertNoKey(res);
});

test("rpc: a null receipt is asked of the next provider", async () => {
  const { calls, fetchImpl } = recordingFetch((url) =>
    json({ jsonrpc: "2.0", id: 1, result: url.includes("alchemy") ? null : { status: "0x1" } }),
  );
  const res = await proxyRpc(
    "sepolia",
    post({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: ["0x" + "2".repeat(64)] }),
    { env, fetchImpl, limiter: roomy() },
  );
  assert.equal(calls.length, 2);
  assert.deepEqual((await res.json()).result, { status: "0x1" });
});

test("rpc: no provider key configured is 503 so the client falls back", async () => {
  const { calls, fetchImpl } = recordingFetch(() => json({}));
  const res = await proxyRpc("sepolia", post({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }), {
    env: {},
    fetchImpl,
    limiter: roomy(),
  });
  assert.equal(res.status, 503);
  assert.equal(calls.length, 0);
});

test("rpc: rate limit counts each call in a batch", async () => {
  const { fetchImpl } = recordingFetch(() => json([]));
  const limiter = createRateLimiter(3, 60_000);
  const batch = (n) => Array.from({ length: n }, (_, i) => ({ jsonrpc: "2.0", id: i, method: "eth_chainId" }));
  assert.equal((await proxyRpc("sepolia", post(batch(3)), { env, fetchImpl, limiter })).status, 200);
  assert.equal((await proxyRpc("sepolia", post(batch(1)), { env, fetchImpl, limiter })).status, 429);
});

test("no keyed provider URL or public Graph key variable is left in the web sources", () => {
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".next", "tests"].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
        const text = fs.readFileSync(full, "utf8");
        if (/alchemy\.com\/v2\/[A-Za-z0-9]|infura\.io\/(ws\/)?v3\/[0-9a-f]|NEXT_PUBLIC_AUTH_TOKEN_GQL/.test(text)) {
          offenders.push(path.relative(root, full));
        }
      }
    }
  };
  walk(root);
  assert.deepEqual(offenders, []);
});
