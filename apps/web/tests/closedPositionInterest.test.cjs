const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const file = path.join(root, "app/[locale]/margin-trading/helpers/liquidationMath.ts");
const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const mod = { exports: {} };
new Function("require", "module", "exports", outputText)(require, mod, mod.exports);
const { closedPositionLenderInterest } = mod.exports;

const LENDER = "0x00000000000000000000000000000000000000aa";
const BORROWER = "0x00000000000000000000000000000000000000bb";
// 1,000 tokens (18 decimals) at 40 bps per 30 days, closed after exactly 30 days.
const base = {
  loanAmount: 1000n * 10n ** 18n,
  interestRateAtOpen: 40,
  createdAt: 1_000_000,
  closedAt: 1_000_000 + 30 * 24 * 60 * 60,
  isClosed: true,
  isLiquidated: false,
  owner: BORROWER,
  order: { owner: LENDER, interestRate: 999 },
};

test("lender sees the interest at the rate fixed when the position opened", () => {
  // 0.4% of 1,000 = 4 tokens; the order's current rate (999) is ignored.
  assert.equal(
    closedPositionLenderInterest(base, LENDER.toUpperCase().replace("0X", "0x")),
    4n * 10n ** 18n,
  );
});

test("borrower and third parties get no figure", () => {
  assert.equal(closedPositionLenderInterest(base, BORROWER), undefined);
  assert.equal(
    closedPositionLenderInterest(base, "0x00000000000000000000000000000000000000cc"),
    undefined,
  );
  assert.equal(closedPositionLenderInterest(base, undefined), undefined);
});

test("liquidated, still open, or rate unknown: no figure", () => {
  assert.equal(closedPositionLenderInterest({ ...base, isLiquidated: true }, LENDER), undefined);
  assert.equal(
    closedPositionLenderInterest({ ...base, isClosed: false, closedAt: 0 }, LENDER),
    undefined,
  );
  assert.equal(
    closedPositionLenderInterest({ ...base, interestRateAtOpen: undefined }, LENDER),
    undefined,
  );
});

test("a lender borrowing from their own order gets no figure", () => {
  assert.equal(closedPositionLenderInterest({ ...base, owner: LENDER }, LENDER), undefined);
});
