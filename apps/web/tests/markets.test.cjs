const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

function load(file, mocks = {}) {
  const filename = path.join(root, file);
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  const requireReal = createRequire(filename);
  new Function("require", "module", "exports", compiled)(
    (name) => (Object.hasOwn(mocks, name) ? mocks[name] : requireReal(name)),
    module,
    module.exports,
  );
  return module.exports;
}

const chartFormat = load("components/trading-chart/format.ts");
const format = load("components/markets/format.ts", {
  "@/components/trading-chart/format": chartFormat,
});
const tableState = load("components/markets/tableState.ts");

test("missing and non-finite prices stay blank instead of $NaN", () => {
  for (const value of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(format.formatUsd(value), "–");
    assert.equal(format.formatUsdCompact(value), "–");
  }
  assert.equal(format.formatUsd(0), "$0");
  assert.match(format.formatUsd(1234.5), /^\$/);
  assert.match(format.formatUsdCompact(1_500_000), /^\$/);
});

test("placeholder rows from a different query are not treated as the current page", () => {
  assert.equal(
    tableState.marketTablePhase({
      isError: false,
      isPlaceholderData: true,
      hasData: true,
      count: 100,
      hasQuery: true,
    }),
    "loading",
  );
  assert.equal(
    tableState.marketTablePhase({
      isError: true,
      isPlaceholderData: true,
      hasData: true,
      count: 100,
      hasQuery: false,
    }),
    "error",
  );
  assert.equal(tableState.showStaleRefreshError(true, true, true), false);
});

test("a failed refresh of the same query keeps its last good page and reports the error", () => {
  assert.equal(
    tableState.marketTablePhase({
      isError: true,
      isPlaceholderData: false,
      hasData: true,
      count: 100,
      hasQuery: false,
    }),
    "ready",
  );
  assert.equal(tableState.showStaleRefreshError(true, false, true), true);
});

test("24h sort cycles through both directions and other columns return to rank", () => {
  assert.equal(tableState.nextMarketSort("rank", "change_24h"), "change_24h");
  assert.equal(tableState.nextMarketSort("change_24h", "change_24h"), "change_24h_asc");
  assert.equal(tableState.nextMarketSort("change_24h_asc", "change_24h"), "rank");
  assert.equal(tableState.nextMarketSort("price", "price"), "rank");
  assert.equal(tableState.nextMarketSort("rank", "price"), "price");
  assert.equal(tableState.marketColumnDirection("change_24h_asc", "change_24h"), "ascending");
  assert.equal(tableState.marketColumnDirection("change_24h", "change_24h"), "descending");
  assert.equal(tableState.marketColumnDirection("price", "change_24h"), "none");
});

test("list query state round-trips through the url and ignores junk", () => {
  assert.deepEqual(tableState.marketListQuery({ page: "2", sort: "price", q: "  btc  " }), {
    page: 2,
    sort: "price",
    q: "btc",
  });
  assert.deepEqual(tableState.marketListQuery({ page: "0", sort: "nope", q: null }), {
    page: 1,
    sort: "rank",
    q: "",
  });
  assert.equal(
    tableState.marketsListSearch("sort=volume&page=3", { q: "eth", page: 1 }),
    "sort=volume&q=eth",
  );
  assert.equal(tableState.marketsListSearch("", { sort: "rank", page: 1 }), "");
});

test("empty search and an empty market are different states", () => {
  assert.equal(
    tableState.marketTablePhase({
      isError: false,
      isPlaceholderData: false,
      hasData: true,
      count: 0,
      hasQuery: true,
    }),
    "no-results",
  );
  assert.equal(
    tableState.marketTablePhase({
      isError: false,
      isPlaceholderData: false,
      hasData: true,
      count: 0,
      hasQuery: false,
    }),
    "error",
  );
});
