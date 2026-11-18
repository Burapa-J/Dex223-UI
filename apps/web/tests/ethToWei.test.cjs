const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const { outputText } = ts.transpileModule(
  fs.readFileSync(path.join(root, "functions/ethToWei.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
);
const mod = { exports: {} };
new Function("require", "module", "exports", outputText)(
  (id) => require(require.resolve(id, { paths: [root] })),
  mod,
  mod.exports,
);
const { ethToWei } = mod.exports;

test("plain amounts convert to wei", () => {
  assert.equal(ethToWei(1), 10n ** 18n);
  assert.equal(ethToWei(0.0005), 5n * 10n ** 14n);
  assert.equal(ethToWei(1e-7), 10n ** 11n);
});

test("amounts toFixed would print in exponent notation don't throw (order 7 edit crash)", () => {
  assert.equal(ethToWei(3.368027886681676e27), undefined);
  assert.equal(ethToWei(1e21), undefined);
});

test("non-positive and non-finite amounts can't be compared", () => {
  for (const v of [0, -1, NaN, Infinity]) assert.equal(ethToWei(v), undefined);
});
