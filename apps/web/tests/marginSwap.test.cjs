const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");

function parseUnitsFallback(value, decimals) {
  const [integerPart, fractionPart = ""] = String(value).split(".");
  const paddedFraction = fractionPart.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(`${integerPart || "0"}${paddedFraction}`);
}

let viem;
try {
  viem = require("viem");
} catch {
  const ethers = require("ethers");
  viem = {
    parseUnits: parseUnitsFallback,
    getAbiItem({ abi, name }) {
      return abi.find((item) => item.type === "function" && item.name === name);
    },
    encodeFunctionData({ abi, functionName, args }) {
      const iface = ethers.Interface.from(abi);
      return iface.encodeFunctionData(functionName, args);
    },
  };
}

const root = path.resolve(__dirname, "..");

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
    (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === "viem") return viem;
      if (name.startsWith("@/")) {
        const resolved = path.join(root, name.slice(2));
        for (const candidate of [
          resolved,
          `${resolved}.ts`,
          `${resolved}.tsx`,
          path.join(resolved, "index.ts"),
          path.join(resolved, "index.tsx"),
        ]) {
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return load(path.relative(root, candidate), mocks);
          }
        }
      }
      return requireReal(name);
    },
    module,
    module.exports,
  );
  return module.exports;
}

const { getTokenAddressForStandard, Standard } = load("sdk_bi/standard.ts");
const { MARGIN_MODULE_ABI } = load("config/abis/marginModule.ts");

const openMarginSwapMocks = {
  "next/navigation": { useSearchParams: () => new URLSearchParams() },
  react: { useCallback: (fn) => fn, useEffect: () => {}, useMemo: (fn) => fn() },
  "@/app/[locale]/margin-swap/stores/useMarginSwapPositionStore": {
    useMarginSwapPositionStore: () => ({ setMarginSwapPositionId: () => {} }),
  },
  "@/app/[locale]/margin-swap/stores/useMarginSwapTokensStore": {
    useMarginSwapTokensStore: () => ({
      setTokenA: () => {},
      setTokenB: () => {},
      setTokenAStandard: () => {},
      setTokenBStandard: () => {},
    }),
  },
  "@/app/[locale]/margin-trading/hooks/useMarginPosition": { default: () => ({}) },
  "@/i18n/routing": { useRouter: () => ({ push: () => {} }) },
};

const {
  canPositionReceiveToken,
  getPositionAllowedOutputAssets,
  getPositionAllowedOutputStandard,
  getPositionHeldStandard,
  getPositionTradePair,
} = load(
  "app/[locale]/margin-swap/hooks/useOpenMarginSwapForPosition.ts",
  openMarginSwapMocks,
);

const marginSwapMocks = {
  ...openMarginSwapMocks,
  wagmi: {
    useAccount: () => ({}),
    usePublicClient: () => ({}),
    useReadContract: () => ({}),
    useWalletClient: () => ({}),
  },
  "@/app/[locale]/margin-swap/stores/useMarginSwapAmountsStore": {
    useMarginSwapAmountsStore: () => ({}),
  },
  "@/app/[locale]/margin-swap/stores/useMarginSwapSettingsStore": {
    useMarginSwapSettingsStore: () => ({}),
  },
  "@/app/[locale]/margin-swap/stores/useMarginSwapStatusStore": {
    MarginSwapError: {},
    MarginSwapStatus: {},
    useMarginSwapStatusStore: () => ({}),
  },
  "@/app/[locale]/swap/hooks/useTrade": { useMarginTrade: () => ({}) },
  "@/config/modules": { isMarginDeployed: () => true, MARGIN_TRADING_ADDRESS: {} },
  "@/functions/getTransactionWithRetries": { getTransactionWithRetries: async () => ({}) },
  "@/functions/slippageToPercent": { slippageToPercent: () => ({}) },
  "@/hooks/useCurrentChainId": { default: () => 1 },
  "@/hooks/useMarginModuleApolloClient": { refreshMarginQueries: async () => {} },
  "@/sdk_bi/addresses": { MARGIN_TRADING_ADDRESS: {} },
  "@/sdk_bi/entities/currency": {},
  "@/sdk_bi/entities/fractions/currencyAmount": { CurrencyAmount: class {} },
  "@/sdk_bi/internalConstants": { ONE: 1n },
  "@/sdk_bi/utils/tickMath": { TickMath: { MIN_SQRT_RATIO: 4295128739n, MAX_SQRT_RATIO: 1461446703485210103287273052203988822378723970342n } },
  "@/shared/hooks/useGlobalBlockNumber": { useGlobalBlockNumber: () => ({ blockNumber: 1n }) },
  "@/stores/usePoolsStore": { _usePoolsStore: { getState: () => ({ invalidateAll: () => {} }) } },
  "@/stores/useRecentTransactionsStore": {
    useRecentTransactionsStore: () => ({}),
  },
};

const { buildMarginSwapCallParams } = load(
  "app/[locale]/margin-swap/hooks/useMarginSwap.ts",
  marginSwapMocks,
);

function makeToken(symbol, address0, address1) {
  const token = {
    symbol,
    decimals: 18,
    isNative: false,
    isToken: true,
    address0,
    address1,
    equals(other) {
      return Boolean(other && other.address0?.toLowerCase() === address0.toLowerCase());
    },
  };
  token.wrapped = token;
  return token;
}

const marginModuleAddress = "0x9000000000000000000000000000000000000001";
const tokenLoan = makeToken(
  "USDT",
  "0x1000000000000000000000000000000000000020",
  "0x1000000000000000000000000000000000000223",
);
const tokenCollateral = makeToken(
  "WBTC",
  "0x2000000000000000000000000000000000000020",
  "0x2000000000000000000000000000000000000223",
);
const tokenAlt = makeToken(
  "UNI",
  "0x3000000000000000000000000000000000000020",
  "0x3000000000000000000000000000000000000223",
);

test("buildMarginSwapCallParams encodes marginSwap for ERC-20 input and ERC-20 output", () => {
  const amountIn = viem.parseUnits("25", 18);
  const params = buildMarginSwapCallParams({
    positionId: 7,
    positionAssets: [tokenLoan.address0, tokenCollateral.address0],
    allowedTradingAddresses: [tokenLoan.address0, tokenAlt.address0],
    tokenA: tokenLoan,
    tokenB: tokenAlt,
    tokenAStandard: Standard.ERC20,
    tokenBStandard: Standard.ERC20,
    amountIn,
    fee: 3000,
    minimumAmountOut: 1000n,
    sqrtPriceLimitX96: 4295128740n,
    marginModuleAddress,
  });

  assert.equal(params.functionName, "marginSwap");
  assert.deepEqual(params.args, [
    7n,
    0n,
    0n,
    1n,
    amountIn,
    tokenAlt.address0,
    3000,
    1000n,
    4295128740n,
  ]);
  assert.ok(
    viem.encodeFunctionData({
      abi: MARGIN_MODULE_ABI,
      functionName: params.functionName,
      args: params.args,
    }),
  );
});

test("buildMarginSwapCallParams routes ERC-223 input to marginSwap223 and resolves ERC-223 addresses", () => {
  const amountIn = viem.parseUnits("10", 18);
  const params = buildMarginSwapCallParams({
    positionId: 12,
    positionAssets: [tokenLoan.address1, tokenAlt.address1],
    allowedTradingAddresses: [tokenAlt.address0, tokenAlt.address1],
    tokenA: tokenAlt,
    tokenB: tokenLoan,
    tokenAStandard: Standard.ERC223,
    tokenBStandard: Standard.ERC223,
    amountIn,
    fee: 3000,
    minimumAmountOut: 500n,
    sqrtPriceLimitX96: 4295128740n,
    marginModuleAddress,
  });

  assert.equal(params.functionName, "marginSwap223");
  assert.deepEqual(params.args, [
    12n,
    1n, // _assetId1 matches tokenAlt.address1 at index 1
    1n, // _whitelistId1 matches tokenAlt.address1 at index 1
    0n, // tokenLoan (baseAsset) not in whitelist -> clamped to 0n
    amountIn,
    tokenLoan.address1, // _asset2 uses ERC-223 address1
    3000,
  ]);
  assert.ok(
    viem.encodeFunctionData({
      abi: MARGIN_MODULE_ABI,
      functionName: params.functionName,
      args: params.args,
    }),
  );
});

test("buildMarginSwapCallParams clamps missing whitelist indices to 0n for collateral, baseAsset, and autolisting orders", () => {
  const params = buildMarginSwapCallParams({
    positionId: 3,
    positionAssets: [tokenLoan.address0, tokenCollateral.address0],
    allowedTradingAddresses: [],
    tokenA: tokenCollateral,
    tokenB: tokenLoan,
    tokenAStandard: Standard.ERC20,
    tokenBStandard: Standard.ERC20,
    amountIn: 1000n,
    fee: 500,
    minimumAmountOut: 100n,
    sqrtPriceLimitX96: 4295128740n,
    marginModuleAddress,
  });

  assert.equal(params.args[2], 0n);
  assert.equal(params.args[3], 0n);
  assert.ok(
    viem.encodeFunctionData({
      abi: MARGIN_MODULE_ABI,
      functionName: params.functionName,
      args: params.args,
    }),
  );
});

test("buildMarginSwapCallParams throws when selected input asset standard is not held by position", () => {
  assert.throws(
    () =>
      buildMarginSwapCallParams({
        positionId: 3,
        positionAssets: [tokenLoan.address1, tokenAlt.address1], // held only in ERC-223
        allowedTradingAddresses: [tokenAlt.address1],
        tokenA: tokenAlt,
        tokenB: tokenLoan,
        tokenAStandard: Standard.ERC20,
        tokenBStandard: Standard.ERC20,
        amountIn: 1000n,
        fee: 3000,
        minimumAmountOut: 100n,
        sqrtPriceLimitX96: 4295128740n,
        marginModuleAddress,
      }),
    /Input asset is not held in this position/,
  );
});

test("getPositionTradePair and standard helpers preserve ERC-223 balances and allow buying back loanAsset", () => {
  const position = {
    id: 42,
    loanAsset: tokenLoan,
    collateralAsset: tokenCollateral,
    assets: [tokenLoan, tokenAlt],
    assetAddresses: [
      { address: tokenLoan.address1, balance: 0n, assetId: 0 },
      { address: tokenAlt.address1, balance: 500n * 10n ** 18n, assetId: 1 },
    ],
    assetsWithBalances: [
      { asset: tokenLoan, balance: 0n },
      { asset: tokenAlt, balance: 500n * 10n ** 18n },
    ],
    order: {
      baseAsset: tokenLoan,
      baseAssetStandard: Standard.ERC223,
      allowedTradingAssets: [tokenAlt], // baseAsset is not duplicated in allowedTradingAssets
      allowedTradingAddresses: [tokenAlt.address1],
    },
  };

  assert.equal(getTokenAddressForStandard(tokenAlt, Standard.ERC223), tokenAlt.address1);
  assert.equal(getPositionHeldStandard(position, tokenAlt), Standard.ERC223);
  assert.equal(getPositionAllowedOutputStandard(position, tokenLoan), Standard.ERC223);
  assert.equal(getPositionAllowedOutputStandard(position, tokenAlt), Standard.ERC223);
  assert.equal(canPositionReceiveToken(position, tokenLoan), true);

  const allowedOutputs = getPositionAllowedOutputAssets(position);
  assert.equal(allowedOutputs.length, 3);
  assert.equal(
    allowedOutputs.some((asset) => asset.equals(tokenLoan)),
    true,
  );
  assert.equal(
    allowedOutputs.some((asset) => asset.equals(tokenCollateral)),
    true,
  );

  const pair = getPositionTradePair(position);
  assert.equal(pair.tokenA.symbol, "UNI");
  assert.equal(pair.tokenAStandard, Standard.ERC223);
  assert.equal(pair.tokenB.symbol, "USDT");
  assert.equal(pair.tokenBStandard, Standard.ERC223);
});

test("PositionCloseDialog checks order.baseAssetStandard balance and allows closing when baseAssetAmount === expectedBalance", () => {
  const closeDialogSource = fs.readFileSync(
    path.join(root, "app/[locale]/margin-trading/position/[id]/components/PositionCloseDialog.tsx"),
    "utf8",
  );
  assert.match(closeDialogSource, /getTokenAddressForStandard\(\s*position\.order\.baseAsset,\s*position\.order\.baseAssetStandard/);
  assert.match(closeDialogSource, /baseAssetAmount >= expectedBalance/);

  const tradeFormSource = fs.readFileSync(
    path.join(root, "app/[locale]/margin-swap/components/TradeForm.tsx"),
    "utf8",
  );
  assert.match(tradeFormSource, /getPositionHeldStandard\(marginSwapPosition,\s*token\)/);
  assert.match(tradeFormSource, /getPositionAllowedOutputStandard\(marginSwapPosition,\s*token\)/);
  assert.match(tradeFormSource, /getPositionAllowedOutputAssets\(marginSwapPosition\)/);
});

