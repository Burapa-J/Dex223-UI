const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { parseAbi, parseGwei } = require("viem");

const webRoot = path.resolve(__dirname, "..");
// Load the actual TypeScript modules with isolated wallet/UI dependencies. No RPC or wallet is used.
function load(relativePath, mocks = {}) {
  const filename = path.join(webRoot, relativePath);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  const realRequire = createRequire(filename);
  const requireMock = (name) => {
    if (!Object.hasOwn(mocks, name)) return realRequire(name);
    const value = mocks[name];
    return Object.hasOwn(value, "default") ? { __esModule: true, ...value } : value;
  };
  new Function("require", "module", "exports", source)(requireMock, module, module.exports);
  return module.exports;
}

const marginRoot = "app/[locale]/margin-trading/";
const marginGas = load(`${marginRoot}helpers/marginGas.ts`);
const account = "0x1111111111111111111111111111111111111111";
const contract = "0x2222222222222222222222222222222222222222";
const abi = parseAbi(["function act(uint256 id) payable", "function deposit(uint256 id)"]);
const request = { abi, address: contract, functionName: "act", args: [1n] };
const chainId = 11155111;
const tokenStandards = load("sdk_bi/standard.ts");
const { Standard } = tokenStandards;
const assetFunding = load(`${marginRoot}helpers/assetFunding.ts`, {
  "@/sdk_bi/addresses": { ZERO_ADDRESS: "0x0000000000000000000000000000000000000000" },
  "@/sdk_bi/standard": tokenStandards,
});
const key = (tx = request, chain = chainId, address = account) =>
  marginGas.getMarginGasRequestKey(tx, chain, address);

test("custom limits are scoped to chain, wallet, destination, calldata and native value", () => {
  for (const changed of [
    key(request, 56),
    key(request, chainId, contract),
    key({ ...request, address: account }),
    key({ ...request, args: [2n] }),
    key({ ...request, functionName: "deposit" }),
    key({ ...request, value: 1n }),
  ])
    assert.notEqual(key(), changed);
  assert.equal(key(), key({ ...request, value: 0n }));
});

function walletHarness({
  customGasLimit = 150_000n,
  estimate = async () => 100_000n,
  send,
  feeSettings,
} = {}) {
  const limit = {
    customGasLimit,
    estimatedGas: 90_000n,
    setCustomGasLimit(value) {
      this.customGasLimit = value;
    },
    setEstimatedGas(value) {
      this.estimatedGas = value;
    },
  };
  const stores = { chainId, requestKey: key(), useLimit: { getState: () => limit } };
  const sent = [];
  const estimated = [];
  const fees = feeSettings ?? { maxFeePerGas: 20n, maxPriorityFeePerGas: 2n };
  const useWallet = load(`${marginRoot}hooks/useMarginWalletClient.ts`, {
    react: { useMemo: (fn) => fn() },
    wagmi: {
      useWalletClient: () => ({
        data: {
          chain: { id: chainId },
          account: { address: account },
          writeContract: async (tx) => {
            sent.push(tx);
            return send ? send(tx) : "0xhash";
          },
        },
      }),
      usePublicClient: () => ({
        estimateGas: async (tx) => {
          estimated.push(tx);
          return estimate(tx);
        },
      }),
    },
    "@/hooks/useCurrentChainId": { default: () => chainId },
    "@/app/[locale]/margin-trading/components/MarginGasSettings": {
      useOperationStores: () => stores,
      useMarginWriteGas: () => fees,
    },
    "@/app/[locale]/margin-trading/helpers/marginGas": marginGas,
  }).default;
  return { wallet: useWallet("createOrder").data, stores, limit, sent, estimated, fees };
}

test("a custom limit reaches the matching write; later steps estimate independently", async () => {
  const h = walletHarness();
  await h.wallet.writeContract(request);
  await h.wallet.writeContract({ ...request, functionName: "deposit", args: [2n] });
  assert.equal(h.sent[0].gas, 150_000n);
  assert.equal(h.sent[1].gas, undefined);
  assert.equal(h.limit.customGasLimit, undefined);
  assert.equal(h.estimated.length, 2);
  assert.notEqual(h.estimated[0].data, h.estimated[1].data);
  assert.equal(h.sent[1].maxFeePerGas, h.fees.maxFeePerGas);
  assert.equal(h.sent[1].maxPriorityFeePerGas, h.fees.maxPriorityFeePerGas);
});

test("freeze and liquidation with identical calldata do not reuse a custom limit", async () => {
  const h = walletHarness();
  await h.wallet.writeContract(request);
  await h.wallet.writeContract(request);
  assert.equal(h.sent[0].gas, 150_000n);
  assert.equal(h.sent[1].gas, undefined);
});

test("a fresh estimate rejects an insufficient limit before opening the wallet", async () => {
  const h = walletHarness({ estimate: async () => 160_000n });
  await assert.rejects(h.wallet.writeContract(request), /below the transaction estimate/);
  assert.equal(h.sent.length, 0);
  assert.equal(h.limit.estimatedGas, 160_000n);
  assert.equal(h.limit.customGasLimit, 150_000n);
});

test("unavailable RPC estimates preserve manual limits and automatic wallet estimation", async () => {
  const estimate = async () => {
    throw new Error("RPC unavailable");
  };
  const h = walletHarness({ estimate });
  await h.wallet.writeContract(request);
  assert.equal(h.sent[0].gas, 150_000n);
  assert.equal(h.limit.estimatedGas, 90_000n);
  const automatic = walletHarness({ estimate, customGasLimit: undefined });
  automatic.limit.customGasLimit = undefined;
  await automatic.wallet.writeContract(request);
  assert.equal(automatic.sent[0].gas, undefined);
});

test("rejected signatures preserve the custom limit for retry", async () => {
  const h = walletHarness({
    send: async () => {
      throw new Error("User rejected");
    },
  });
  await assert.rejects(h.wallet.writeContract(request), /User rejected/);
  assert.equal(h.limit.customGasLimit, 150_000n);
});

test("network changes stop the send, and unrelated requests do not take a stored limit", async () => {
  const h = walletHarness();
  h.stores.chainId = 56;
  await assert.rejects(h.wallet.writeContract(request), /network changed/);
  assert.equal(h.sent.length, 0);
  h.stores.chainId = chainId;
  await h.wallet.writeContract({ ...request, args: [2n] });
  assert.equal(h.sent[0].gas, undefined);
  assert.equal(h.limit.customGasLimit, 150_000n);
});

test("an in-flight send cannot clear settings edited for another request", async () => {
  let complete;
  const h = walletHarness({
    send: () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  });
  const pending = h.wallet.writeContract(request);
  await new Promise(setImmediate);
  h.stores.requestKey = key({ ...request, args: [2n] });
  h.limit.customGasLimit = 200_000n;
  complete("0xhash");
  await pending;
  assert.equal(h.limit.customGasLimit, 200_000n);
});

const fees = { baseFee: parseGwei("1"), priorityFee: parseGwei("1"), gasPrice: parseGwei("2") };
const sharedMocks = {
  "next-intl": { useTranslations: () => (key) => key },
  "@/shared/hooks/useGlobalFees": { useGlobalFees: () => fees },
};
const validate = load(
  "components/gas-settings/hooks/useNetworkFeeGasValidation.ts",
  sharedMocks,
).default;
function gasLimitError(gasLimit, estimatedGas) {
  let error;
  function Probe() {
    error = validate({
      gasLimit,
      estimatedGas,
      maxFeePerGas: "3",
      maxPriorityFeePerGas: "1",
      gasPrice: "3",
    }).gasLimitError;
    return null;
  }
  renderToStaticMarkup(React.createElement(Probe));
  return error;
}

test("validation supports screens with no estimate, automatic limits and estimate floors", () => {
  assert.equal(gasLimitError("150000", 0n), undefined);
  assert.equal(gasLimitError("", 0n), undefined);
  assert.equal(gasLimitError("", 100_000n), undefined);
  assert.equal(gasLimitError("150000", 100_000n), undefined);
  for (const value of ["0", "-1", "1.5", "bad"])
    assert.equal(gasLimitError(value, 0n), "gas_limit_too_low");
  assert.equal(gasLimitError("99999", 100_000n), "gas_limit_too_low");
});

test("the gas-limit input remains editable without an estimate", () => {
  let field;
  const GasLimitField = load("components/gas-settings/GasLimitField.tsx", {
    ...sharedMocks,
    "@/components/atoms/Input": { InputSize: { DEFAULT: "default" } },
    "@/components/atoms/TextField": {
      default: (props) => {
        field = props;
        return null;
      },
    },
    "@/components/gas-settings/ErrorsAndWarnings": { default: () => null },
    "@/config/theme/colors": { ThemeColors: { GREEN: "green", PURPLE: "purple" } },
    "@/lib/color-scheme": { useColorScheme: () => "green" },
  }).default;
  renderToStaticMarkup(
    React.createElement(GasLimitField, {
      value: "150000",
      estimatedGas: 0n,
      onChange() {},
      onBlur() {},
      setFieldValue() {},
    }),
  );
  assert.notEqual(field.disabled, true);
  assert.equal(field.value, "150000");
});

function dialogHarness({
  estimatedGas = 0n,
  customGasLimit,
  isAdvanced = true,
  model = "legacy",
} = {}) {
  let form;
  const applied = [];
  const prices = [];
  const noop = () => {};
  const leaf = { default: () => null };
  const gasOptions = { CHEAP: "cheap", FAST: "fast", CUSTOM: "custom" };
  const models = { LEGACY: "legacy", EIP1559: "eip1559" };
  const mocks = {
    ...sharedMocks,
    "@repo/ui/alert": leaf,
    "@repo/ui/switch": leaf,
    "@repo/ui/tooltip": leaf,
    formik: {
      useFormik: (config) => {
        form = config;
        return {
          values: config.initialValues,
          touched: {},
          handleChange: noop,
          handleBlur: noop,
          setFieldValue: noop,
          handleSubmit: noop,
          handleReset: noop,
        };
      },
    },
    "@/components/atoms/DrawerDialog": { default: ({ children }) => children },
    "@/components/buttons/Button": { default: () => null, ButtonColor: {} },
    "@/components/gas-settings/hooks/useNetworkFeeGasValidation": { default: validate },
    "@/config/constants/baseFeeMultipliers": {
      baseFeeMultipliers: { [chainId]: { cheap: 1000n, fast: 1500n } },
      SCALING_FACTOR: 1000n,
    },
    "@/config/constants/eip1559": { isEip1559Supported: () => true },
    "@/config/theme/colors": { ThemeColors: { GREEN: "green", PURPLE: "purple" } },
    "@/functions/formatFloat": { formatFloat: (value) => String(value) },
    "@/hooks/useCurrentChainId": { default: () => chainId },
    "@/hooks/useDeepEffect": { default: noop },
    "@/hooks/useNativeCurrency": { useNativeCurrency: () => ({ symbol: "ETH" }) },
    "@/hooks/useUSDPrice": { useUSDPrice: () => ({ price: 1 }) },
    "@/lib/color-scheme": { useColorScheme: () => "green" },
    "@/other/toast": { default: noop },
    "@/sdk_bi/chains": {},
    "@/sdk_bi/entities/weth9": { wrappedTokens: {} },
    "@/stores/factories/createGasPriceStore": { GasOption: gasOptions },
    "@/stores/useRecentTransactionsStore": { GasFeeModel: models },
  };
  for (const name of [
    "atoms/DialogHeader",
    "gas-settings/ConfigureAutomatically",
    "gas-settings/EIP1559Fields",
    "gas-settings/GasLimitField",
    "gas-settings/GasOptionRadioButton",
    "gas-settings/LegacyField",
  ])
    mocks[`@/components/${name}`] = leaf;
  const Dialog = load("components/dialogs/NetworkFeeConfigDialog.tsx", mocks).default;
  renderToStaticMarkup(
    React.createElement(Dialog, {
      isOpen: true,
      setIsOpen: noop,
      isAdvanced,
      setIsAdvanced: noop,
      gasPriceOption: "custom",
      gasPriceSettings: {
        model,
        gasPrice: parseGwei("3"),
        maxFeePerGas: parseGwei("3"),
        maxPriorityFeePerGas: parseGwei("1"),
      },
      setGasPriceOption: noop,
      setGasPriceSettings: (value) => prices.push(value),
      customGasLimit,
      estimatedGas,
      setCustomGasLimit: (value) => applied.push(value),
      setEstimatedGas: noop,
    }),
  );
  return { form, applied, prices };
}

test("Apply saves manual limits on screens with no estimate for both gas models", () => {
  for (const model of ["legacy", "eip1559"]) {
    const h = dialogHarness({ model, customGasLimit: 150_000n });
    assert.equal(h.form.initialValues.gasLimit, "150000");
    h.form.onSubmit({ ...h.form.initialValues, gasLimit: "160000" }, {});
    assert.deepEqual(h.applied, [160_000n]);
    assert.equal(h.prices[0].model, model);
  }
});

test("Apply handles automatic, cheap and fast settings without serializing zero as a custom limit", () => {
  for (const option of ["custom", "cheap", "fast"]) {
    const h = dialogHarness();
    assert.equal(h.form.initialValues.gasLimit, "");
    h.form.onSubmit({ ...h.form.initialValues, gasPriceOption: option }, {});
    assert.deepEqual(h.applied, [undefined]);
  }
});

test("Apply rejects malformed or below-estimate limits before changing settings", () => {
  for (const gasLimit of ["0", "bad", "-1", "1.5", "99999"]) {
    const h = dialogHarness({ estimatedGas: 100_000n });
    h.form.onSubmit({ ...h.form.initialValues, gasLimit }, {});
    assert.deepEqual(h.applied, []);
    assert.deepEqual(h.prices, []);
  }
});

const marginAbi = load("config/abis/marginModule.ts").MARGIN_MODULE_ABI;
const liquidationStatus = load(
  `${marginRoot}position/[id]/liquidate/stores/usePositionLiquidateStatusStore.ts`,
  { "@/stores/factories/createOperationStatusStore": { createOperationStatusStore: () => {} } },
).PositionLiquidateStatus;
function liquidationHarness({
  frozenTime = 0n,
  alive = true,
  liquidatable = true,
  timestamp = 100n,
  receiptStatus = "success",
  openAfterLiquidation = false,
  connected = true,
} = {}) {
  const h = walletHarness();
  const states = [];
  const events = [];
  let preview;
  let positionReads = 0;
  const publicClient = {
    readContract: async ({ functionName }) => {
      if (functionName === "subjectToLiquidation") return liquidatable;
      positionReads++;
      const position = [];
      const needsFreeze = frozenTime === 0n || timestamp - frozenTime > 3600n;
      const liquidationSent = h.sent.length >= (needsFreeze ? 2 : 1);
      position[6] = liquidationSent ? openAfterLiquidation : alive;
      position[7] = frozenTime;
      return position;
    },
    getBlock: async () => ({ timestamp }),
    waitForTransactionReceipt: async (params) => {
      events.push(params);
      return { status: receiptStatus };
    },
  };
  const useLiquidate = load(`${marginRoot}position/[id]/liquidate/hooks/useLiquidatePosition.ts`, {
    react: { useCallback: (fn) => fn },
    wagmi: {
      useAccount: () => ({ address: connected ? account : undefined }),
      usePublicClient: () => publicClient,
    },
    "@/app/[locale]/margin-trading/components/MarginGasSettings": {
      useMarginWriteGas: () => h.fees,
    },
    "@/app/[locale]/margin-trading/hooks/useMarginGasEstimate": {
      default: (operation, build) => {
        preview = build();
        h.stores.requestKey = preview ? key(preview) : undefined;
      },
    },
    "@/app/[locale]/margin-trading/hooks/useMarginWalletClient": {
      default: () => ({ data: h.wallet }),
    },
    "@/app/[locale]/margin-trading/position/[id]/liquidate/stores/usePositionLiquidateStatusStore":
      {
        PositionLiquidateStatus: liquidationStatus,
        usePositionLiquidateStatusStore: () => ({
          setStatus: (status) => states.push(status),
          setPositionLiquidateHash() {},
          setPositionFreezeHash() {},
        }),
      },
    "@/config/abis/marginModule": { MARGIN_MODULE_ABI: marginAbi },
    "@/config/modules": { isMarginDeployed: () => true },
    "@/hooks/useCurrentChainId": { default: () => chainId },
    "@/sdk_bi/addresses": { MARGIN_TRADING_ADDRESS: { [chainId]: contract } },
  }).default;
  const position = { id: 1, order: { owner: contract }, isLiquidated: false };
  return {
    ...h,
    run: useLiquidate(position).handleLiquidatePosition,
    preview,
    states,
    events,
    get positionReads() {
      return positionReads;
    },
  };
}

test("liquidation preview and writes use the connected wallet as reward receiver", async () => {
  const h = liquidationHarness();
  await h.run();
  assert.deepEqual(h.preview.args, [1n, account]);
  assert.equal(h.sent.length, 2);
  for (const tx of h.sent) {
    assert.deepEqual(tx.args, [1n, account]);
    assert.equal(key(tx), key(h.preview));
    assert.equal(tx.maxFeePerGas, h.fees.maxFeePerGas);
    assert.equal(tx.maxPriorityFeePerGas, h.fees.maxPriorityFeePerGas);
  }
  assert.equal(h.sent[0].gas, 150_000n);
  assert.equal(h.sent[1].gas, undefined);
});

test("disconnected liquidation neither previews nor submits a transaction", async () => {
  const h = liquidationHarness({ connected: false });
  await h.run();
  assert.equal(h.preview, undefined);
  assert.equal(h.positionReads, 0);
  assert.equal(h.sent.length, 0);
  assert.equal(h.states.length, 0);
});

test("fresh liquidation waits for a later block and applies the custom limit only to freeze", async () => {
  const h = liquidationHarness();
  await h.run();
  assert.equal(h.sent.length, 2);
  assert.equal(h.sent[0].gas, 150_000n);
  assert.equal(h.sent[1].gas, undefined);
  assert.equal(h.events[1].confirmations, 2);
  assert.ok(h.states.includes(liquidationStatus.LOADING_BLOCK_CONFIRMATION));
  assert.equal(h.states.at(-1), liquidationStatus.SUCCESS);
});

test("an existing live freeze liquidates once; completed positions send nothing", async () => {
  const frozen = liquidationHarness({ frozenTime: 99n });
  await frozen.run();
  assert.equal(frozen.sent.length, 1);
  assert.equal(frozen.sent[0].gas, 150_000n);
  assert.equal(frozen.states.at(-1), liquidationStatus.SUCCESS);
  const complete = liquidationHarness({ alive: false });
  await complete.run();
  assert.equal(complete.sent.length, 0);
  assert.equal(complete.states.at(-1), liquidationStatus.SUCCESS);
});

test("a failed freeze never sends the liquidation transaction", async () => {
  const h = liquidationHarness({ receiptStatus: "reverted" });
  const originalError = console.error;
  console.error = () => {};
  try {
    await h.run();
  } finally {
    console.error = originalError;
  }
  assert.equal(h.sent.length, 1);
  assert.equal(h.states.at(-1), liquidationStatus.ERROR_FREEZE);
});

test("a successful receipt that only re-freezes an open position is not liquidation success", async (t) => {
  t.mock.method(console, "error", () => {});
  for (const frozenTime of [0n, 99n]) {
    const h = liquidationHarness({ frozenTime, openAfterLiquidation: true });
    await h.run();
    assert.equal(h.sent.length, frozenTime === 0n ? 2 : 1);
    assert.equal(h.positionReads, frozenTime === 0n ? 3 : 2);
    assert.equal(h.states.at(-1), liquidationStatus.ERROR_LIQUIDATE);
    assert.ok(!h.states.includes(liquidationStatus.SUCCESS));
  }
});

test("withdrawal keeps exact ERC-223/native addresses and excludes zero balances", async () => {
  const { decodeFunctionData } = require("viem");
  let sent;
  const statuses = [];
  const status = { PENDING_WITHDRAW: 1, LOADING_WITHDRAW: 2, SUCCESS: 3, ERROR_WITHDRAW: 4 };
  const useWithdraw = load(`${marginRoot}position/[id]/hooks/usePositionWithdraw.ts`, {
    react: { useCallback: (fn) => fn },
    wagmi: {
      usePublicClient: () => ({ waitForTransactionReceipt: async () => ({ status: "success" }) }),
    },
    "@/app/[locale]/margin-trading/components/MarginGasSettings": {
      useMarginWriteGas: () => ({ gasPrice: 3n }),
    },
    "@/app/[locale]/margin-trading/hooks/useMarginGasEstimate": { default: () => {} },
    "@/app/[locale]/margin-trading/hooks/useMarginWalletClient": {
      default: () => ({
        data: {
          writeContract: async (tx) => {
            sent = tx;
            return "0xhash";
          },
        },
      }),
    },
    "@/app/[locale]/margin-trading/position/[id]/stores/usePositionWithdrawStatusStore": {
      PositionWithdrawStatus: status,
      useWithdrawPositionStatusStore: () => ({ setStatus: (value) => statuses.push(value) }),
    },
    "@/config/abis/marginModule": { MARGIN_MODULE_ABI: marginAbi },
    "@/config/modules": { isMarginDeployed: () => true },
    "@/hooks/useCurrentChainId": { default: () => chainId },
    "@/sdk_bi/addresses": { MARGIN_TRADING_ADDRESS: { [chainId]: contract } },
  }).default;
  const native = "0x0000000000000000000000000000000000000000";
  const assets = [
    { address: account, balance: 123n },
    { address: native, balance: 1n },
    { address: contract, balance: 0n },
  ];
  await useWithdraw({
    position: { id: 7, isClosed: true, assetAddresses: assets },
  }).handlePositionWithdraw();
  const calls = sent.args[0].map((data) => decodeFunctionData({ abi: marginAbi, data }));
  assert.deepEqual(
    calls.map((call) => call.args),
    [
      [7n, account],
      [7n, native],
    ],
  );
  assert.equal(sent.functionName, "multicall");
  assert.equal(sent.gasPrice, 3n);
  assert.equal(statuses.at(-1), status.SUCCESS);
  sent = undefined;
  await useWithdraw({
    position: { id: 7, isClosed: false, assetAddresses: assets },
  }).handlePositionWithdraw();
  assert.equal(sent, undefined);
});

test("legacy writes carry gasPrice without introducing EIP-1559 fields", async () => {
  const h = walletHarness({ feeSettings: { gasPrice: 3n } });
  await h.wallet.writeContract(request);
  assert.equal(h.sent[0].gasPrice, 3n);
  assert.equal(h.sent[0].maxFeePerGas, undefined);
  assert.equal(h.sent[0].maxPriorityFeePerGas, undefined);
});

test("preview estimates populate the operation store and changed calldata clears an old limit", () => {
  const limit = {
    customGasLimit: 150_000n,
    estimatedGas: 0n,
    setCustomGasLimit(value) {
      this.customGasLimit = value;
    },
    setEstimatedGas(value) {
      this.estimatedGas = value;
    },
  };
  const stores = { requestKey: key(), useLimit: { getState: () => limit } };
  let query;
  const useEstimate = load(`${marginRoot}hooks/useMarginGasEstimate.ts`, {
    react: { useEffect: (fn) => fn() },
    "@tanstack/react-query": {
      useQuery: (options) => {
        query = options;
        return { data: options.enabled ? 100_000n : undefined };
      },
    },
    wagmi: {
      useAccount: () => ({ address: account }),
      usePublicClient: () => ({ estimateGas: async () => 100_000n }),
    },
    "@/app/[locale]/margin-trading/components/MarginGasSettings": {
      useOperationStores: () => stores,
    },
    "@/app/[locale]/margin-trading/helpers/marginGas": marginGas,
    "@/config/modules": { isMarginDeployed: () => true },
    "@/hooks/useCurrentChainId": { default: () => chainId },
  }).default;
  useEstimate("borrow", () => request);
  assert.equal(query.enabled, true);
  assert.equal(limit.estimatedGas, 100_000n);
  assert.equal(limit.customGasLimit, 150_000n);
  useEstimate("borrow", () => ({ ...request, args: [2n] }));
  assert.equal(limit.customGasLimit, undefined);
  limit.customGasLimit = 150_000n;
  const result = useEstimate("borrow", () => {
    throw new Error("Incomplete amount");
  });
  assert.equal(result, undefined);
  assert.equal(query.enabled, false);
  assert.equal(limit.estimatedGas, 0n);
  assert.equal(limit.customGasLimit, undefined);
});

const operationStoreMock = {
  "@/stores/factories/createOperationStatusStore": { createOperationStatusStore: () => {} },
};
const closeStatus = load(
  `${marginRoot}position/[id]/stores/usePositionCloseStatusStore.ts`,
  operationStoreMock,
).PositionCloseStatus;
const depositStore = load(
  `${marginRoot}position/[id]/stores/usePositionDepositStatusStore.ts`,
  operationStoreMock,
);
const depositStatus = depositStore.PositionDepositStatus;
const { SwapError } = depositStore;
const borrowStatus = load(
  `${marginRoot}lending-order/[id]/borrow/stores/useCreateMarginPositionStatusStore.tsx`,
  operationStoreMock,
).CreateMarginPositionStatus;

function flowHarness() {
  const previews = {};
  const states = [];
  const statusStore = () => ({
    setStatus: (value) => states.push(value),
    setErrorType() {},
    setPositionCloseHash() {},
    setBorrowHash() {},
  });
  const token = {
    isNative: true,
    decimals: 18,
    address0: account,
    address1: contract,
    wrapped: { address0: account, address1: contract },
    equals: () => true,
  };
  const values = {
    collateralToken: token,
    collateralTokenStandard: Standard.ERC20,
    collateralAmount: "1",
    borrowAmount: "1",
  };
  const mocks = {
    react: { useCallback: (fn) => fn, useMemo: (fn) => fn() },
    wagmi: { useAccount: () => ({ address: account }), usePublicClient: () => ({}) },
    "@/app/[locale]/margin-trading/components/MarginGasSettings": {
      useMarginWriteGas: () => ({ gasPrice: 3n }),
    },
    "@/app/[locale]/margin-trading/hooks/useMarginGasEstimate": {
      default: (operation, build) => {
        previews[operation] = build();
      },
    },
    "@/app/[locale]/margin-trading/hooks/useMarginWalletClient": {
      default: () => ({
        data: {
          writeContract: async () => {
            throw new Error("Custom gas limit is below the transaction estimate");
          },
        },
      }),
    },
    "@/app/[locale]/margin-trading/helpers/assetFunding": assetFunding,
    "@/app/[locale]/margin-trading/position/[id]/stores/usePositionCloseStatusStore": {
      PositionCloseStatus: closeStatus,
      usePositionCloseStatusStore: statusStore,
    },
    "@/app/[locale]/margin-trading/position/[id]/stores/usePositionDepositStatusStore": {
      PositionDepositStatus: depositStatus,
      SwapError,
      useDepositPositionStatusStore: statusStore,
    },
    "@/app/[locale]/margin-trading/lending-order/[id]/borrow/stores/useCreateMarginPositionConfigStore":
      { useCreateMarginPositionConfigStore: () => ({ values }) },
    "@/app/[locale]/margin-trading/lending-order/[id]/borrow/stores/useCreateMarginPositionStatusStore":
      { CreateMarginPositionStatus: borrowStatus, useCreateMarginPositionStatusStore: statusStore },
    "@/app/[locale]/margin-trading/lending-order/[id]/borrow/stores/useNewlyCreatedPositionId": {
      useNewlyCreatedPositionId: () => ({ setPositionId() {} }),
    },
    "@/app/[locale]/margin-trading/lending-order/[id]/helpers/getStepTexts": {},
    "@/components/common/OperationStepRow": {},
    "@/config/abis/erc223": {},
    "@/config/abis/marginModule": { MARGIN_MODULE_ABI: marginAbi },
    "@/config/abis/oracle": { ORACLE_ABI: [] },
    "@/config/modules": { isMarginDeployed: () => true },
    "@/functions/getTransactionWithRetries": {},
    "@/hooks/useAllowance": { useStoreAllowance: () => ({ isAllowed: true }) },
    "@/hooks/useCurrentChainId": { default: () => chainId },
    "@/sdk_bi/addresses": { MARGIN_TRADING_ADDRESS: { [chainId]: contract } },
    "@/sdk_bi/standard": tokenStandards,
    "@/stores/useRecentTransactionsStore": {
      useRecentTransactionsStore: () => ({ addRecentTransaction() {} }),
    },
  };
  const close = load(`${marginRoot}position/[id]/hooks/usePositionClose.ts`, mocks).default;
  const depositModule = load(
    `${marginRoot}position/[id]/deposit/hooks/usePositionDeposit.ts`,
    mocks,
  );
  const borrowModule = load(
    `${marginRoot}lending-order/[id]/borrow/hooks/useCreateMarginPosition.ts`,
    mocks,
  );
  const order = {
    id: 1,
    liquidationRewardAsset: token,
    liquidationRewardAmount: { value: 0n },
    baseAsset: token,
    collateralAddresses: ["0x0000000000000000000000000000000000000000", account, contract],
    currencyLimit: 2,
  };
  const position = {
    id: 1,
    owner: account,
    isClosed: false,
    isLiquidated: false,
    assetAddresses: [],
    loanAsset: token,
    order: { ...order, allowedTradingAddresses: [account, contract] },
  };
  return {
    mocks,
    previews,
    states,
    close,
    deposit: depositModule.default,
    borrow: borrowModule.default,
    estimateDeposit: depositModule.usePositionDepositGasEstimate,
    estimateBorrow: borrowModule.useBorrowGasEstimate,
    order,
    position,
    token,
    values,
  };
}

test("gas validation errors leave close, deposit and borrow in a retryable error state", async () => {
  const { states, close, deposit, borrow, order, position, token } = flowHarness();
  const originalError = console.error;
  console.error = () => {};
  try {
    await close({ position }).handlePositionClose();
    assert.equal(states.at(-1), closeStatus.ERROR_CLOSE);
    await deposit({
      position,
      amount: "1",
      currency: { ...token, isNative: false },
      standard: Standard.ERC20,
    }).handlePositionDeposit("1");
    assert.equal(states.at(-1), depositStatus.ERROR_DEPOSIT);
    await borrow(order).handleCreateMarginPosition("1", "1", "0");
    assert.equal(states.at(-1), borrowStatus.ERROR_BORROW);
  } finally {
    console.error = originalError;
  }
});

test("borrow and deposit previews use live form values and target the main margin transaction", () => {
  const h = flowHarness();
  const token = { ...h.token, isNative: false };
  h.estimateBorrow(h.order, {
    ...h.values,
    collateralToken: token,
    collateralTokenStandard: Standard.ERC223,
    collateralAmount: "2",
  });
  assert.equal(h.previews.borrow.functionName, "takeLoan");
  assert.equal(h.previews.borrow.args[3], 2n * 10n ** 18n);
  h.estimateDeposit({
    position: h.position,
    amount: "3",
    currency: token,
    standard: Standard.ERC223,
  });
  assert.equal(h.previews.depositPosition.functionName, "positionDeposit");
  assert.equal(h.previews.depositPosition.args[3], 3n * 10n ** 18n);
  assert.equal(h.previews.borrow.address, contract);
  assert.equal(h.previews.depositPosition.address, contract);
});

function positionDepositHarness({ standard = Standard.ERC20, isAllowed = true } = {}) {
  const flow = flowHarness();
  const h = walletHarness();
  const approvals = [];
  const currency = { ...flow.token, isNative: false, decimals: 6 };
  const position = {
    ...flow.position,
    order: {
      ...flow.position.order,
      allowedTradingAddresses: ["0x3333333333333333333333333333333333333333", account, contract],
    },
  };
  let preview;
  const useDeposit = load(`${marginRoot}position/[id]/deposit/hooks/usePositionDeposit.ts`, {
    ...flow.mocks,
    wagmi: {
      useAccount: () => ({ address: account }),
      usePublicClient: () => ({
        waitForTransactionReceipt: async () => ({ status: "success" }),
      }),
    },
    "@/app/[locale]/margin-trading/components/MarginGasSettings": {
      useMarginWriteGas: () => h.fees,
    },
    "@/app/[locale]/margin-trading/hooks/useMarginGasEstimate": {
      default: (operation, build) => {
        preview = build();
        h.stores.requestKey = key(preview);
      },
    },
    "@/app/[locale]/margin-trading/hooks/useMarginWalletClient": {
      default: () => ({ data: h.wallet }),
    },
    "@/app/[locale]/margin-trading/position/[id]/stores/usePositionDepositStatusStore": {
      PositionDepositStatus: depositStatus,
      SwapError,
      useDepositPositionStatusStore: () => ({
        setStatus: (value) => flow.states.push(value),
        setErrorType() {},
        setApproveHash() {},
        setTransferHash() {},
        setDepositHash() {},
      }),
    },
    "@/config/abis/erc223": load("config/abis/erc223.ts"),
    "@/functions/getTransactionWithRetries": {
      getTransactionWithRetries: async () => ({ nonce: 1 }),
    },
    "@/hooks/useAllowance": {
      useStoreAllowance: () => ({
        isAllowed,
        writeTokenApprove: async (params) => {
          approvals.push(params);
          return { success: true, hash: "0xapprove" };
        },
      }),
    },
    "@/stores/useRecentTransactionsStore": {
      useRecentTransactionsStore: () => ({ addRecentTransaction() {} }),
      stringifyObject: () => ({}),
      GasFeeModel: { EIP1559: "EIP1559" },
      RecentTransactionTitleTemplate: { TRANSFER: "TRANSFER" },
    },
  }).default;
  const run = useDeposit({ position, currency, standard, amount: "1.25" }).handlePositionDeposit;
  return { ...h, preview, approvals, states: flow.states, run: () => run("1.25") };
}

for (const isAllowed of [true, false]) {
  test(`ERC-20 deposit preview matches the write with allowance ${isAllowed}`, async () => {
    const h = positionDepositHarness({ isAllowed });
    await h.run();
    assert.equal(h.sent.length, 1);
    assert.equal(key(h.preview), key(h.sent[0]));
    assert.deepEqual(h.sent[0].args, [1n, account, 1n, 1_250_000n]);
    assert.equal(h.sent[0].gas, 150_000n);
    assert.equal(h.limit.customGasLimit, undefined);
    assert.equal(h.approvals.length, isAllowed ? 0 : 1);
    if (!isAllowed) {
      assert.deepEqual(h.approvals[0].customGasSettings, h.fees);
      assert.equal(h.approvals[0].customGasSettings.gas, undefined);
    }
    assert.equal(h.states.at(-1), depositStatus.SUCCESS);
  });
}

test("ERC-223 transfer keeps fee prices while the matching deposit consumes its custom limit", async () => {
  const h = positionDepositHarness({ standard: Standard.ERC223 });
  await h.run();
  assert.deepEqual(
    h.sent.map((tx) => tx.functionName),
    ["transfer", "positionDeposit"],
  );
  assert.equal(h.sent[0].gas, undefined);
  assert.equal(h.sent[0].maxFeePerGas, h.fees.maxFeePerGas);
  assert.equal(h.sent[0].maxPriorityFeePerGas, h.fees.maxPriorityFeePerGas);
  assert.equal(key(h.preview), key(h.sent[1]));
  assert.deepEqual(h.sent[1].args, [1n, contract, 2n, 1_250_000n]);
  assert.equal(h.sent[1].gas, 150_000n);
  assert.equal(h.limit.customGasLimit, undefined);
  assert.equal(h.approvals.length, 0);
  assert.equal(h.states.at(-1), depositStatus.SUCCESS);
});

test("create and edit estimates include unsaved third-step values without modifying the saved form", () => {
  const { decodeFunctionData } = require("viem");
  const h = flowHarness();
  const thirdStepValues = {
    liquidationFeeToken: h.token,
    liquidationFeeForLiquidator: "1",
    orderCurrencyLimit: "3",
  };
  const state = {
    firstStepValues: {
      loanToken: h.token,
      loanTokenStandard: 0,
      loanAmount: "1",
      interestRatePerMonth: "1",
      period: { positionDuration: "30", lendingOrderDeadline: "2030-01-01" },
    },
    secondStepValues: {
      leverage: 1,
      collateralTokens: [h.token],
      minimumBorrowingAmount: "0.1",
      tradingTokens: { inputMode: 0, allowedTokens: [h.token], includeERC223Trading: false },
    },
    thirdStepValues,
  };
  const mocks = {
    ...h.mocks,
    ...sharedMocks,
    "@/app/[locale]/margin-trading/lending-order/create/steps/types": {
      TradingTokensInputMode: { AUTOLISTING: 1 },
    },
    "@/app/[locale]/margin-trading/lending-order/create/stores/useCreateOrderConfigStore": {
      useCreateOrderConfigStore: () => state,
    },
    "@/app/[locale]/margin-trading/lending-order/[id]/edit/stores/useEditOrderConfigStore": {
      useEditOrderConfigStore: () => state,
    },
    "@/app/[locale]/margin-trading/lending-order/create/stores/useCreateOrderStatusStore": {},
    "@/app/[locale]/margin-trading/lending-order/create/stores/useNewlyCreatedOrderId": {},
    "@/app/[locale]/margin-trading/lending-order/[id]/edit/stores/useEditOrderStatusStore": {},
    "@/other/toast": {},
    "@/sdk_bi/addresses": {
      MARGIN_TRADING_ADDRESS: { [chainId]: contract },
      ORACLE_ADDRESS: { [chainId]: contract },
      ZERO_ADDRESS: "0x0000000000000000000000000000000000000000",
    },
  };
  const liveValues = {
    ...thirdStepValues,
    liquidationFeeForLiquidator: "2",
    orderCurrencyLimit: "4",
  };
  load(`${marginRoot}lending-order/create/hooks/useCreateOrder.tsx`, mocks).useCreateOrderRequest(
    liveValues,
  );
  const created = decodeFunctionData({ abi: marginAbi, data: h.previews.createOrder.args[0][1] });
  assert.equal(created.args[0].currencyLimit, 4);
  assert.equal(created.args[0].liquidationRewardAmount, 2n * 10n ** 18n);
  const order = { ...h.order, allowedTradingAssets: [h.token], isErc223TradingAllowed: false };
  load(`${marginRoot}lending-order/[id]/edit/hooks/useEditOrder.tsx`, mocks).useEditOrderRequest(
    order,
    liveValues,
  );
  const edited = decodeFunctionData({ abi: marginAbi, data: h.previews.editOrder.args[0][0] });
  assert.equal(edited.functionName, "modifyOrder");
  assert.equal(edited.args[5], 4);
  assert.equal(edited.args[8], 2n * 10n ** 18n);
  assert.equal(thirdStepValues.orderCurrencyLimit, "3");
});
