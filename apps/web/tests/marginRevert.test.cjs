const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");

const viem = require("viem");

// Load a TypeScript source as CommonJS, resolving "@/..." to apps/web.
const root = path.join(__dirname, "..");
function load(rel) {
  const file = path.join(root, rel);
  const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(path.dirname(file));
  const req = (id) => {
    if (id.startsWith("@/")) return load(id.slice(2) + ".ts");
    return require(require.resolve(id, { paths: [root] }));
  };
  new Function("require", "module", "exports", outputText)(req, mod, mod.exports);
  return mod.exports;
}

const { getMarginRevertCode, toMarginRevert, isUserRejection } = load("functions/marginRevert.ts");

const revertData = (reason) =>
  viem.encodeErrorResult({
    abi: [{ type: "error", name: "Error", inputs: [{ name: "message", type: "string" }] }],
    errorName: "Error",
    args: [reason],
  });

test("reads the code from viem's decoded revert (simulateContract)", () => {
  const inner = new viem.ContractFunctionRevertedError({
    abi: [],
    data: revertData("MM22"),
    functionName: "liquidate",
  });
  const outer = new viem.ContractFunctionExecutionError(inner, {
    abi: [],
    functionName: "liquidate",
    args: [],
  });
  assert.equal(getMarginRevertCode(outer), "MM22");
  assert.deepEqual(toMarginRevert(outer), {
    code: "MM22",
    shortMessage: undefined,
    hash: undefined,
  });
});

test("reads the code from raw revert data and from RPC messages", () => {
  assert.equal(getMarginRevertCode({ data: revertData("MM30") }), "MM30");
  assert.equal(getMarginRevertCode({ cause: { data: { data: revertData("MM20") } } }), "MM20");
  assert.equal(getMarginRevertCode(new Error("execution reverted: MM38")), "MM38");
});

test("no code: falls back to the first line of the short message", () => {
  const error = { shortMessage: "insufficient funds for gas\nmore detail" };
  assert.equal(getMarginRevertCode(error), undefined);
  assert.deepEqual(toMarginRevert(error), {
    code: undefined,
    shortMessage: "insufficient funds for gas",
    hash: undefined,
  });
  assert.equal(getMarginRevertCode(new Error("MM123 is not a code")), undefined);
});

test("wallet rejection is not shown as a contract error", () => {
  assert.equal(isUserRejection({ code: 4001, message: "User rejected the request." }), true);
  assert.equal(isUserRejection(new Error("execution reverted: MM22")), false);
});

test("every margin module code has an English sentence", () => {
  const en = JSON.parse(fs.readFileSync(path.join(root, "messages/en.json"), "utf8"));
  for (let i = 1; i <= 38; i++) {
    const code = `MM${String(i).padStart(2, "0")}`;
    assert.ok(en.MarginErrors[code], `missing MarginErrors.${code}`);
  }
});
