const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");
const viem = require("viem");

const root = path.resolve(__dirname, "..");
const swapRoot = "app/[locale]/swap/";
const hash = `0x${"1".repeat(64)}`;
const account = `0x${"2".repeat(40)}`;
const abi = viem.parseAbi(["function swap()"]);
function compile(source) {
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}
function load(file, mocks = {}) {
  const filename = path.join(root, file);
  const module = { exports: {} };
  const requireReal = createRequire(filename);
  new Function("require", "module", "exports", compile(fs.readFileSync(filename, "utf8")))(
    (name) => (Object.hasOwn(mocks, name) ? mocks[name] : requireReal(name)),
    module,
    module.exports,
  );
  return module.exports;
}
// Execute the actual hook callback with isolated RPC/wallet/store dependencies.
function expression(file, find) {
  const filename = path.join(root, file);
  const source = ts.createSourceFile(
    filename,
    fs.readFileSync(filename, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  let found;
  function visit(node) {
    if (find(node)) found = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(found, `Missing expression in ${file}`);
  return found;
}
function callback(file, name, dependencies) {
  const declaration = expression(
    file,
    (node) => ts.isVariableDeclaration(node) && node.name.getText() === name,
  );
  const fn = declaration.initializer.arguments[0];
  return new Function(...Object.keys(dependencies), compile(`return (${fn.getText()});`))(
    ...Object.values(dependencies),
  );
}
const receipts = load(`${swapRoot}lib/readSwapReceipt.ts`);
const { SwapStatus, SwapError, useSwapStatusStore } = load(
  `${swapRoot}stores/useSwapStatusStore.tsx`,
);
const success = { status: "success", gasUsed: 50000n };
const reverted = { status: "reverted", gasUsed: 50000n };
const reject = async () => {
  throw new Error("RPC unavailable");
};

test("receipt outcomes distinguish pending, success, revert, and out of gas", () => {
  assert.equal(receipts.swapOutcomeFromReceipt(null, 100000n), "pending");
  assert.equal(receipts.swapOutcomeFromReceipt(success, 100000n), "success");
  assert.equal(receipts.swapOutcomeFromReceipt(reverted, 100000n), "failed");
  assert.equal(receipts.swapOutcomeFromReceipt(reverted), "failed");
  assert.equal(
    receipts.swapOutcomeFromReceipt({ ...reverted, gasUsed: 98000n }, 100000n),
    "out_of_gas",
  );
  assert.equal(
    receipts.swapOutcomeFromReceipt({ ...reverted, gasUsed: 100001n }, 100000n),
    "failed",
  );
});

test("receipt reads recover from wait errors and preserve carried receipts", async (t) => {
  t.mock.method(console, "error", () => {});
  assert.equal(
    await receipts.readSwapReceipt({ waitForTransactionReceipt: async () => success }, hash),
    success,
  );
  assert.equal(
    await receipts.readSwapReceipt(
      { waitForTransactionReceipt: reject, getTransactionReceipt: async () => reverted },
      hash,
    ),
    reverted,
  );
  assert.equal(
    await receipts.readSwapReceipt(
      {
        waitForTransactionReceipt: async () => {
          throw { transactionReceipt: reverted };
        },
        getTransactionReceipt: () => assert.fail("unnecessary lookup"),
      },
      hash,
    ),
    reverted,
  );
  assert.equal(
    await receipts.readSwapReceipt(
      { waitForTransactionReceipt: () => assert.fail("unnecessary wait") },
      hash,
      { transactionReceipt: success },
    ),
    success,
  );
  assert.equal(
    await receipts.readSwapReceipt(
      { waitForTransactionReceipt: reject, getTransactionReceipt: reject },
      hash,
    ),
    null,
  );
});

function harness({
  approval = false,
  receipt = success,
  metadataFails = false,
  metadataMissing = false,
  beforeBroadcastError = false,
  outerError = false,
  carriedReceipt,
} = {}) {
  useSwapStatusStore.getState().setStatus(SwapStatus.INITIAL);
  const store = useSwapStatusStore.getState();
  const recent = [],
    writes = [],
    alerts = [];
  let closed = false;
  const tokenA = { isToken: approval, decimals: 18, symbol: "A", equals: () => false };
  const client = {
    estimateContractGas: async () => 70000n,
    simulateContract: async () => ({ request: { abi, address: account, functionName: "swap" } }),
    waitForTransactionReceipt: receipt ? async () => receipt : reject,
    getTransactionReceipt: receipt ? async () => receipt : reject,
  };
  const dependencies = {
    ...receipts,
    ...store,
    useSwapStatusStore,
    SwapStatus,
    SwapError,
    publicClient: client,
    tokenA,
    tokenB: { symbol: "B" },
    tokenAStandard: "ERC20",
    tokenBStandard: "ERC20",
    Standard: { ERC20: "ERC20" },
    isAllowedA: !approval,
    walletClient: {
      writeContract: async (tx) => {
        if (beforeBroadcastError) throw new Error("Rejected");
        writes.push(tx);
        return hash;
      },
    },
    address: account,
    trade: {},
    chainId: 1,
    swapParams: { abi, address: account, functionName: "swap" },
    output: "2",
    setSwapStatus: store.setStatus,
    setSwapHash: store.setSwapHash,
    setApproveHash: store.setApproveHash,
    openConfirmInWalletAlert: () => {},
    closeConfirmInWalletAlert: () => {
      if (outerError && !closed) {
        closed = true;
        throw { transactionReceipt: carriedReceipt };
      }
    },
    t: (value) => value,
    approveA: async () => ({ success: true, hash }),
    gasSettings: {},
    customGasLimit: undefined,
    gasPriceSettings: { model: "EIP1559" },
    getTransactionWithRetries: async () => {
      if (metadataFails) throw new Error("Transaction not found");
      return metadataMissing ? undefined : { nonce: 5 };
    },
    addRecentTransaction: (transaction) => recent.push(transaction),
    stringifyObject: (value) => value,
    getAbiItem: viem.getAbiItem,
    parseUnits: viem.parseUnits,
    RecentTransactionTitleTemplate: { SWAP: "swap", CONVERT: "convert" },
    isConversion: false,
    typedValue: "1",
    updateAllowance: () => {},
    addToast: (...args) => alerts.push(args),
  };
  const run = callback(`${swapRoot}hooks/useSwap.tsx`, "handleSwap", dependencies);
  return {
    run: () => run("1"),
    recent,
    writes,
    alerts,
    state: () => useSwapStatusStore.getState(),
  };
}

for (const options of [{}, { metadataFails: true }, { metadataMissing: true }]) {
  test(`missing swap receipt stays pending and tracked: ${JSON.stringify(options)}`, async (t) => {
    t.mock.method(console, "error", () => {});
    const h = harness({ ...options, receipt: null });
    await h.run();
    assert.equal(h.state().status, SwapStatus.LOADING);
    assert.equal(h.state().isReceiptUnavailable, true);
    assert.equal(h.state().swapHash, hash);
    assert.equal(h.recent.length, 1);
    assert.equal(h.recent[0].hash, hash);
    assert.equal(h.recent[0].status, undefined); // Recent store defaults to pending.
    assert.equal(
      h.recent[0].nonce,
      options.metadataFails || options.metadataMissing ? undefined : 5,
    );
    await h.run();
    assert.equal(h.writes.length, 1, "no retry while broadcast is unresolved");
  });
}

for (const [receipt, expected, errorType] of [
  [success, SwapStatus.SUCCESS],
  [reverted, SwapStatus.ERROR, SwapError.UNKNOWN],
  [{ ...reverted, gasUsed: 100000n }, SwapStatus.ERROR, SwapError.OUT_OF_GAS],
]) {
  test(`confirmed swap receipt resolves to ${expected}/${errorType}`, async () => {
    const h = harness({ receipt });
    await h.run();
    assert.equal(h.state().status, expected);
    if (errorType !== undefined) assert.equal(h.state().errorType, errorType);
    assert.equal(h.state().isReceiptUnavailable, false);
  });
}

test("missing approval receipt stops before swap without offering retry", async (t) => {
  t.mock.method(console, "error", () => {});
  const h = harness({ approval: true, receipt: null });
  await h.run();
  assert.equal(h.state().status, SwapStatus.LOADING_APPROVE);
  assert.equal(h.state().isReceiptUnavailable, true);
  assert.equal(h.state().approveHash, hash);
  assert.equal(h.writes.length, 0);
});

test("reverted approval reports approval failure and sends no swap", async () => {
  const h = harness({ approval: true, receipt: reverted });
  await h.run();
  assert.equal(h.state().status, SwapStatus.APPROVE_ERROR);
  assert.equal(h.writes.length, 0);
});

for (const carriedReceipt of [undefined, reverted, success]) {
  test(`outer error after broadcast uses carried/fallback receipt: ${carriedReceipt?.status}`, async (t) => {
    t.mock.method(console, "error", () => {});
    const h = harness({ outerError: true, receipt: null, carriedReceipt });
    await h.run();
    assert.equal(
      h.state().status,
      !carriedReceipt
        ? SwapStatus.LOADING
        : carriedReceipt.status === "success"
          ? SwapStatus.SUCCESS
          : SwapStatus.ERROR,
    );
    assert.equal(h.state().isReceiptUnavailable, !carriedReceipt);
  });
}

test("a rejected signature before broadcast resets without pending transaction", async (t) => {
  t.mock.method(console, "error", () => {});
  const h = harness({ beforeBroadcastError: true });
  await h.run();
  assert.equal(h.state().status, SwapStatus.INITIAL);
  assert.equal(h.recent.length, 0);
  assert.equal(h.alerts.length, 1);
});

for (const file of ["ConfirmSwapDialog.tsx", "ConfirmConvertDialog.tsx"]) {
  test(`${file} resets unavailable receipts only after closing the matching dialog`, () => {
    const node = expression(
      `${swapRoot}components/${file}`,
      (node) =>
        ts.isCallExpression(node) &&
        node.expression.getText() === "useEffect" &&
        node.arguments[0].getText().includes("if (isReceiptUnavailable"),
    );
    for (const isOpen of [true, false]) {
      const events = [];
      const deps = {
        isReceiptUnavailable: true,
        isOpen,
        isConversion: file.includes("Convert"),
        hideTracker: () => events.push("hide"),
        setSwapStatus: (value) => events.push(value),
        SwapStatus,
        isSuccessSwap: false,
        isRevertedSwap: false,
        isRevertedApprove: false,
        trackedSwap: null,
      };
      new Function(...Object.keys(deps), compile(`return (${node.arguments[0].getText()})();`))(
        ...Object.values(deps),
      );
      assert.equal(events.includes(SwapStatus.INITIAL), !isOpen);
    }
  });
}

test("reset clears hashes and receipt-unavailable state", () => {
  const store = useSwapStatusStore.getState();
  store.setSwapHash(hash);
  store.setApproveHash(hash);
  store.setIsReceiptUnavailable(true);
  store.setStatus(SwapStatus.INITIAL);
  assert.equal(useSwapStatusStore.getState().isReceiptUnavailable, false);
  assert.equal(useSwapStatusStore.getState().swapHash, undefined);
  assert.equal(useSwapStatusStore.getState().approveHash, undefined);
});

test("recent tracking waits for a receipt without treating a missing RPC transaction as failure", async () => {
  const states = [];
  let receipt;
  const store = {
    updateTransactionStatus: (...args) => states.push(args),
    updateTransactionHash() {},
  };
  const deps = {
    publicClient: {
      getTransaction: () => assert.fail("transaction absence must not mark a broadcast failed"),
      waitForTransactionReceipt: async () => receipt,
    },
    address: account,
    ...store,
    appliedReplacements: new Map(),
    RecentTransactionStatus: { SUCCESS: "success", ERROR: "error" },
    addNotification() {},
  };
  const wait = callback("hooks/useRecentTransactionTracking.ts", "waitAndUpdate", deps);
  deps.publicClient.waitForTransactionReceipt = reject;
  await assert.rejects(wait(hash, hash, {}), /RPC unavailable/);
  assert.equal(states.length, 0);
  deps.publicClient.waitForTransactionReceipt = async () => success;
  await wait(hash, hash, {});
  assert.equal(states.at(-1)[1], "success");
  deps.publicClient.waitForTransactionReceipt = async () => reverted;
  await wait(hash, hash, {});
  assert.equal(states.at(-1)[1], "error");
});

test("replacement transactions cannot submit without a known nonce", async () => {
  const node = expression(
    "components/dialogs/TransactionSpeedUpDialog.tsx",
    (node) => ts.isPropertyAssignment(node) && node.name.getText() === "onSubmit",
  );
  let sent = false;
  const submit = new Function(
    "transaction",
    "walletClient",
    "address",
    compile(`return (${node.initializer.getText()});`),
  )(
    { params: { abi, address: account, functionName: "swap" }, nonce: undefined },
    {
      writeContract: async () => {
        sent = true;
      },
    },
    account,
  );
  await submit({}, {});
  assert.equal(sent, false);
});

test("recent receipt tracking resumes after a transient RPC failure", async () => {
  let attempts = 0;
  const delays = [];
  const wait = callback("hooks/useRecentTransactionTracking.ts", "waitForTransaction", {
    waitAndUpdate: async () => {
      attempts++;
      if (attempts === 1) throw new Error("RPC unavailable");
    },
    console: { log() {} },
    setTimeout: (resolve, delay) => {
      delays.push(delay);
      resolve();
    },
  });
  await wait(hash, hash, {});
  assert.equal(attempts, 2);
  assert.deepEqual(delays, [5000]);
});
