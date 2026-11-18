const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const { outputText } = ts.transpileModule(
  fs.readFileSync(path.join(root, "functions/poolNeedsFetch.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
);
const mod = { exports: {} };
new Function("require", "module", "exports", outputText)(require, mod, mod.exports);
const { poolNeedsFetch } = mod.exports;

const now = 1_000_000_000;

test("a pool invalidated after a swap (lastUpdated 0) is fetched again", () => {
  assert.equal(poolNeedsFetch({ status: "loaded", lastUpdated: 0 }, now), true);
});

test("a fresh pool is not refetched; a minute-old one is", () => {
  assert.equal(poolNeedsFetch({ status: "loaded", lastUpdated: now - 5_000 }, now), false);
  assert.equal(poolNeedsFetch({ status: "loaded", lastUpdated: now - 61_000 }, now), true);
});

test("unknown and idle pools are fetched, loading ones are not", () => {
  assert.equal(poolNeedsFetch(undefined, now), true);
  assert.equal(poolNeedsFetch({ status: "idle", lastUpdated: now }, now), true);
  assert.equal(poolNeedsFetch({ status: "loading", lastUpdated: 0 }, now), false);
});

test("a failed lookup is retried after 10 s", () => {
  assert.equal(poolNeedsFetch({ status: "invalid", lastUpdated: now - 5_000 }, now), false);
  assert.equal(poolNeedsFetch({ status: "invalid", lastUpdated: now - 11_000 }, now), true);
});
