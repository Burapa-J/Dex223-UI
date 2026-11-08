const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");

function parseUnitsFallback(value, decimals) {
  const trimmed = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid decimal value: ${value}`);
  }
  const [integerPart, fractionPart = ""] = trimmed.split(".");
  if (fractionPart.length > decimals) {
    throw new Error(`Too many decimals: ${value}`);
  }
  const paddedFraction = fractionPart.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(`${integerPart || "0"}${paddedFraction}`);
}

function formatUnitsFallback(value, decimals) {
  const str = BigInt(value).toString().padStart(decimals + 1, "0");
  const intPart = str.slice(0, str.length - decimals) || "0";
  const fracPart = str.slice(str.length - decimals).replace(/0+$/, "");
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}

let viem;
try {
  viem = require("viem");
} catch {
  viem = {
    parseUnits: parseUnitsFallback,
    formatUnits: formatUnitsFallback,
    parseAbi: (sigs) =>
      sigs.map((sig) => {
        const match = sig.match(/function\s+(\w+)/);
        return { type: "function", name: match ? match[1] : sig };
      }),
    getAbiItem: ({ abi, name }) =>
      abi.find((item) => item.type === "function" && item.name === name),
  };
}

const root = path.resolve(__dirname, "..");

function compile(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
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

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MARGIN_MODULE = "0x9999999999999999999999999999999999999999";
const AUTOLISTING_CONTRACT = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OWNER = "0x1111111111111111111111111111111111111111";

const Standard = {
  ERC20: "ERC-20",
  ERC223: "ERC-223",
};

function makeToken(symbol, address0, address1, decimals = 18) {
  const token = {
    chainId: 1,
    isNative: false,
    isToken: true,
    decimals,
    symbol,
    name: symbol,
    address0,
    address1,
  };
  token.wrapped = token;
  return token;
}

const WETH = makeToken(
  "WETH",
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "0x0000000000000000000000000000000000000223",
);
const NATIVE_ETH = {
  chainId: 1,
  isNative: true,
  isToken: false,
  decimals: 18,
  symbol: "ETH",
  name: "Ether",
  wrapped: WETH,
};

const LOAN_TOKEN = makeToken(
  "D223",
  "0x1000000000000000000000000000000000000020",
  "0x1000000000000000000000000000000000000223",
);
const COLLATERAL_TOKEN = makeToken(
  "WBTC",
  "0x2000000000000000000000000000000000000020",
  "0x2000000000000000000000000000000000000223",
  8,
);
const TRADING_TOKEN = makeToken(
  "USDT",
  "0x3000000000000000000000000000000000000020",
  "0x3000000000000000000000000000000000000223",
  6,
);
const EXTRA_AUTOLISTED_TOKEN = makeToken(
  "UNI",
  "0x4000000000000000000000000000000000000020",
  "0x4000000000000000000000000000000000000223",
  18,
);

const PositionDepositStatus = {
  INITIAL: "INITIAL",
  PENDING_APPROVE: "PENDING_APPROVE",
  LOADING_APPROVE: "LOADING_APPROVE",
  ERROR_APPROVE: "ERROR_APPROVE",
  PENDING_TRANSFER: "PENDING_TRANSFER",
  LOADING_TRANSFER: "LOADING_TRANSFER",
  ERROR_TRANSFER: "ERROR_TRANSFER",
  PENDING_DEPOSIT: "PENDING_DEPOSIT",
  LOADING_DEPOSIT: "LOADING_DEPOSIT",
  ERROR_DEPOSIT: "ERROR_DEPOSIT",
  SUCCESS: "SUCCESS",
};

const OrderDepositStatus = {
  INITIAL: "INITIAL",
  PENDING_APPROVE: "PENDING_APPROVE",
  LOADING_APPROVE: "LOADING_APPROVE",
  ERROR_APPROVE: "ERROR_APPROVE",
  PENDING_TRANSFER: "PENDING_TRANSFER",
  LOADING_TRANSFER: "LOADING_TRANSFER",
  ERROR_TRANSFER: "ERROR_TRANSFER",
  PENDING_DEPOSIT: "PENDING_DEPOSIT",
  LOADING_DEPOSIT: "LOADING_DEPOSIT",
  ERROR_DEPOSIT: "ERROR_DEPOSIT",
  SUCCESS: "SUCCESS",
};

const helpersMod = load("app/[locale]/margin-trading/hooks/helpers.ts", {
  viem,
  "@/app/[locale]/margin-trading/types": {},
  "@/hooks/useTokenListLogos": {
    listedLogo: () => "/images/tokens/placeholder.svg",
  },
  "@/sdk_bi/addresses": {
    ORACLE_ADDRESS: { 1: "0x8888888888888888888888888888888888888888" },
    ZERO_ADDRESS,
  },
  "@/sdk_bi/chains": { DexChainId: { MAINNET: 1 } },
  "@/sdk_bi/entities/currency": {},
  "@/sdk_bi/entities/ether": {
    NativeCoin: { onChain: () => NATIVE_ETH },
  },
  "@/sdk_bi/entities/token": {
    Token: function (chainId, address0, address1, decimals, symbol, name) {
      return makeToken(symbol, address0, address1, decimals);
    },
  },
  "@/sdk_bi/standard": { Standard },
});

test("serializeGqlOrder preserves baseAssetAddress/whitelistAutoListing and detects ERC-223 support accurately", () => {
  const baseGqlOrder = {
    id: 7,
    owner: OWNER,
    leverage: 3,
    minLoan: 100n,
    duration: 3600,
    deadline: 999999,
    baseAssetToken: {
      addressERC20: LOAN_TOKEN.address0,
      addressERC223: LOAN_TOKEN.address1,
      decimals: "18",
      id: "1",
      name: "D223",
      symbol: "D223",
    },
    baseAsset: LOAN_TOKEN.address1,
    createdAt: "1000",
    liquidationRewardAmount: 10n,
    liquidationRewardAsset: LOAN_TOKEN.address0,
    liquidationRewardAssetToken: {
      addressERC20: LOAN_TOKEN.address0,
      addressERC223: LOAN_TOKEN.address1,
      decimals: "18",
      id: "1",
      name: "D223",
      symbol: "D223",
    },
    interestRate: 500,
    currencyLimit: 3,
    collaterals: [COLLATERAL_TOKEN.address0],
    collateralTokens: [
      {
        addressERC20: COLLATERAL_TOKEN.address0,
        addressERC223: COLLATERAL_TOKEN.address1,
        decimals: "8",
        id: "2",
        name: "WBTC",
        symbol: "WBTC",
      },
    ],
    balance: 5000n,
    positions: [],
    whitelist: {
      allowedForTrading: [TRADING_TOKEN.address0],
      allowedForTradingTokens: [
        {
          addressERC20: TRADING_TOKEN.address0,
          addressERC223: TRADING_TOKEN.address1,
          decimals: "6",
          id: "3",
          name: "USDT",
          symbol: "USDT",
        },
      ],
      autolisting: ZERO_ADDRESS,
      id: "0x01",
    },
    alive: true,
    oracle: "0x8888888888888888888888888888888888888888",
  };

  // Case 1: ERC-223 baseAsset makes isErc223TradingAllowed true even when whitelist has 1 ERC-20 address
  const serializedErc223Base = helpersMod.serializeGqlOrder(baseGqlOrder, 1);
  assert.equal(serializedErc223Base.baseAssetStandard, Standard.ERC223);
  assert.equal(serializedErc223Base.baseAssetAddress, LOAN_TOKEN.address1);
  assert.equal(serializedErc223Base.whitelistAutoListing, ZERO_ADDRESS);
  assert.equal(serializedErc223Base.isErc223TradingAllowed, true);

  // Case 2: 1 ERC-223 trading token in whitelist (length === tokens.length === 1)
  const serializedSingleErc223Trading = helpersMod.serializeGqlOrder(
    {
      ...baseGqlOrder,
      baseAsset: LOAN_TOKEN.address0,
      whitelist: {
        ...baseGqlOrder.whitelist,
        allowedForTrading: [TRADING_TOKEN.address1],
      },
    },
    1,
  );
  assert.equal(serializedSingleErc223Trading.baseAssetStandard, Standard.ERC20);
  assert.equal(serializedSingleErc223Trading.isErc223TradingAllowed, true);

  // Case 3: Pure ERC-20 order (baseAsset, collateral, and trading whitelist all ERC-20, no autolisting)
  const serializedPureErc20 = helpersMod.serializeGqlOrder(
    {
      ...baseGqlOrder,
      baseAsset: LOAN_TOKEN.address0,
    },
    1,
  );
  assert.equal(serializedPureErc20.isErc223TradingAllowed, false);
});

function createPositionFixture(overrides = {}) {
  const defaultOrder = {
    id: 10,
    owner: OWNER,
    leverage: 3,
    minLoan: 100n,
    positionDuration: 3600,
    deadline: 999999,
    createdAt: 1000,
    liquidationRewardAmount: { value: 1n, formatted: "1" },
    liquidationRewardAsset: LOAN_TOKEN,
    liquidationRewardAssetStandard: Standard.ERC20,
    collateralAddresses: [COLLATERAL_TOKEN.address0, COLLATERAL_TOKEN.address1],
    allowedCollateralAssets: [COLLATERAL_TOKEN],
    allowedTradingAssets: [TRADING_TOKEN],
    allowedTradingAddresses: [TRADING_TOKEN.address0],
    whitelistAutoListing: ZERO_ADDRESS,
    isErc223TradingAllowed: true,
    interestRate: 500,
    currencyLimit: 3,
    balance: 1000n,
    baseAsset: LOAN_TOKEN,
    baseAssetAddress: LOAN_TOKEN.address1,
    baseAssetStandard: Standard.ERC223,
    alive: true,
    oracle: "0x8888888888888888888888888888888888888888",
  };

  return {
    id: 42,
    owner: OWNER,
    loanAmount: 1000n,
    loanAsset: LOAN_TOKEN,
    deadline: 999999,
    assetAddresses: [
      { address: LOAN_TOKEN.address1, balance: 500n, assetId: 0 },
      { address: COLLATERAL_TOKEN.address0, balance: 100n, assetId: 1 },
    ],
    assetsWithBalances: [],
    assets: [LOAN_TOKEN, COLLATERAL_TOKEN],
    createdAt: 1000,
    isClosed: false,
    closedAt: 0,
    isLiquidated: false,
    liquidatedAt: 0,
    liquidator: ZERO_ADDRESS,
    order: { ...defaultOrder, ...(overrides.order || {}) },
    txClosed: "0x0",
    txFrozen: "0x0",
    txLiquidated: "0x0",
    collateralAmount: 100n,
    collateralAsset: COLLATERAL_TOKEN,
    initialLeverage: 3,
    frozenTime: 0,
    ...overrides,
  };
}

function loadPositionDepositModule(harness = {}) {
  const statuses = [];
  const recentTxs = [];
  const writeCalls = [];

  const mod = load(
    "app/[locale]/margin-trading/position/[id]/deposit/hooks/usePositionDeposit.ts",
    {
      react: {
        useCallback: (fn) => fn,
        useMemo: (fn) => fn(),
      },
      viem,
      wagmi: {
        useAccount: () => ({ address: harness.address ?? OWNER }),
        usePublicClient: () => ({
          waitForTransactionReceipt:
            harness.waitForTransactionReceipt ?? (async () => ({ status: "success" })),
        }),
        useWalletClient: () => ({
          data: {
            writeContract: async (req) => {
              writeCalls.push(req);
              if (harness.onWriteContract) return harness.onWriteContract(req);
              return `0x${String(writeCalls.length).repeat(64)}`;
            },
          },
        }),
      },
      "@/app/[locale]/margin-trading/helpers/assetFunding": {
        getMarginAssetAddress: (currency, standard) =>
          currency.isNative
            ? ZERO_ADDRESS
            : standard === Standard.ERC223
              ? currency.wrapped.address1
              : currency.wrapped.address0,
      },
      "@/app/[locale]/margin-trading/position/[id]/stores/usePositionDepositStatusStore": {
        PositionDepositStatus,
        useDepositPositionStatusStore: () => ({
          setStatus: (s) => statuses.push(s),
          setDepositHash: () => {},
          setApproveHash: () => {},
          setTransferHash: () => {},
        }),
      },
      "@/app/[locale]/margin-trading/types": {},
      "@/config/abis/erc223": {
        ERC223_ABI: viem.parseAbi([
          "function transfer(address to, uint256 value) returns (bool)",
        ]),
      },
      "@/config/abis/marginModule": {
        MARGIN_MODULE_ABI: viem.parseAbi([
          "function positionDeposit(uint256 positionId, address asset, uint256 idInWhitelist, uint256 amount)",
        ]),
      },
      "@/config/modules": {
        isMarginDeployed: () => true,
      },
      "@/functions/getTransactionWithRetries": {
        getTransactionWithRetries: async () => ({ nonce: 1 }),
      },
      "@/hooks/useAllowance": {
        useStoreAllowance: () => ({
          isAllowed: harness.isAllowed ?? true,
          writeTokenApprove:
            harness.writeTokenApprove ??
            (async () => ({ success: true, hash: `0x${"a".repeat(64)}` })),
        }),
      },
      "@/hooks/useCurrentChainId": { default: () => 1, __esModule: true },
      "@/sdk_bi/addresses": {
        MARGIN_TRADING_ADDRESS: { 1: MARGIN_MODULE },
        ZERO_ADDRESS,
      },
      "@/sdk_bi/entities/currency": {},
      "@/sdk_bi/standard": { Standard },
      "@/stores/useRecentTransactionsStore": {
        GasFeeModel: { EIP1559: "EIP1559" },
        RecentTransactionTitleTemplate: {
          TRANSFER: "TRANSFER",
          DEPOSIT: "DEPOSIT",
        },
        stringifyObject: (obj) => obj,
        useRecentTransactionsStore: () => ({
          addRecentTransaction: (tx, addr) => recentTxs.push({ tx, addr }),
        }),
      },
    },
  );

  return { mod, statuses, recentTxs, writeCalls };
}

test("position deposit helpers allow collateral, baseAsset, whitelisted tokens, and autolisting tokens with right standards", () => {
  const { mod } = loadPositionDepositModule();
  const position = createPositionFixture();

  // 1. Depositable token list includes loanAsset (D223), collateralAsset (WBTC), and whitelisted trading asset (USDT)
  const tokens = mod.getPositionDepositableTokens(position, [
    NATIVE_ETH,
    LOAN_TOKEN,
    COLLATERAL_TOKEN,
    TRADING_TOKEN,
    EXTRA_AUTOLISTED_TOKEN,
  ]);
  assert.deepEqual(
    tokens.map((t) => t.symbol),
    ["D223", "WBTC", "USDT"],
  );

  // 2. Loan asset (D223) was borrowed as ERC-223 and is not in allowedTradingAddresses:
  // only ERC-223 is allowed and whitelistId falls back to 0n
  const loanStandards = mod.getPositionDepositAllowedStandards(position, LOAN_TOKEN);
  assert.deepEqual(loanStandards, { allowErc20: false, allowErc223: true });
  const loanResolvedErc223 = mod.resolvePositionDepositParams(
    position,
    LOAN_TOKEN,
    Standard.ERC223,
  );
  assert.equal(loanResolvedErc223.isAllowedAsset, true);
  assert.equal(loanResolvedErc223.whitelistId, 0n);
  assert.equal(loanResolvedErc223.depositAddress, LOAN_TOKEN.address1);
  assert.equal(
    mod.resolvePositionDepositParams(position, LOAN_TOKEN, Standard.ERC20).isAllowedAsset,
    false,
  );

  // 3. Collateral asset (WBTC) has both ERC-20 and ERC-223 in order.collateralAddresses:
  // both standards are allowed with whitelistId = 0n even though WBTC is not in allowedTradingAddresses
  const collateralStandards = mod.getPositionDepositAllowedStandards(position, COLLATERAL_TOKEN);
  assert.deepEqual(collateralStandards, { allowErc20: true, allowErc223: true });
  const colResolved = mod.resolvePositionDepositParams(
    position,
    COLLATERAL_TOKEN,
    Standard.ERC223,
  );
  assert.equal(colResolved.isAllowedAsset, true);
  assert.equal(colResolved.whitelistId, 0n);

  // 4. Trading asset (USDT) has only ERC-20 in allowedTradingAddresses at index 0
  const tradingStandards = mod.getPositionDepositAllowedStandards(position, TRADING_TOKEN);
  assert.deepEqual(tradingStandards, { allowErc20: true, allowErc223: false });
  const tradingResolved = mod.resolvePositionDepositParams(
    position,
    TRADING_TOKEN,
    Standard.ERC20,
  );
  assert.equal(tradingResolved.isAllowedAsset, true);
  assert.equal(tradingResolved.whitelistId, 0n);

  // 5. Autolisting order allows extra non-native tokens in both standards with whitelistId = 0n
  const autolistedPosition = createPositionFixture({
    order: {
      ...position.order,
      allowedTradingAssets: [],
      allowedTradingAddresses: [],
      whitelistAutoListing: AUTOLISTING_CONTRACT,
    },
  });
  const autolistedTokens = mod.getPositionDepositableTokens(autolistedPosition, [
    NATIVE_ETH,
    EXTRA_AUTOLISTED_TOKEN,
  ]);
  assert.equal(
    autolistedTokens.some((t) => t.symbol === "UNI"),
    true,
  );
  assert.equal(
    autolistedTokens.some((t) => t.isNative),
    false,
  );
  const autoResolved = mod.resolvePositionDepositParams(
    autolistedPosition,
    EXTRA_AUTOLISTED_TOKEN,
    Standard.ERC223,
  );
  assert.equal(autoResolved.isAllowedAsset, true);
  assert.equal(autoResolved.whitelistId, 0n);
});

test("handlePositionDeposit executes ERC-223 transfer + positionDeposit(whitelistId=0) for non-whitelist baseAsset and records recent transactions", async () => {
  const { mod, statuses, recentTxs, writeCalls } = loadPositionDepositModule();
  const position = createPositionFixture();

  const { handlePositionDeposit } = mod.default({
    position,
    currency: LOAN_TOKEN,
    amount: "25",
    standard: Standard.ERC223,
  });

  await handlePositionDeposit("25");

  assert.deepEqual(statuses, [
    PositionDepositStatus.PENDING_TRANSFER,
    PositionDepositStatus.LOADING_TRANSFER,
    PositionDepositStatus.PENDING_DEPOSIT,
    PositionDepositStatus.LOADING_DEPOSIT,
    PositionDepositStatus.SUCCESS,
  ]);
  assert.equal(writeCalls.length, 2);
  assert.equal(writeCalls[0].functionName, "transfer");
  assert.equal(writeCalls[0].address, LOAN_TOKEN.address1);
  assert.deepEqual(writeCalls[0].args, [MARGIN_MODULE, viem.parseUnits("25", 18)]);

  assert.equal(writeCalls[1].functionName, "positionDeposit");
  assert.deepEqual(writeCalls[1].args, [
    42n,
    LOAN_TOKEN.address1,
    0n,
    viem.parseUnits("25", 18),
  ]);
  assert.equal(recentTxs.length, 2);
  assert.equal(recentTxs[0].tx.title.template, "TRANSFER");
  assert.equal(recentTxs[1].tx.title.template, "DEPOSIT");
});

function loadOrderDepositModule(harness = {}) {
  const statuses = [];
  const recentTxs = [];
  const writeCalls = [];

  const mod = load(
    "app/[locale]/margin-trading/lending-order/[id]/hooks/useOrderDeposit.ts",
    {
      react: {
        useCallback: (fn) => fn,
        useMemo: (fn) => fn(),
      },
      viem,
      wagmi: {
        useAccount: () => ({ address: harness.address ?? OWNER }),
        usePublicClient: () => ({
          waitForTransactionReceipt:
            harness.waitForTransactionReceipt ?? (async () => ({ status: "success" })),
        }),
        useWalletClient: () => ({
          data: {
            writeContract: async (req) => {
              writeCalls.push(req);
              if (harness.onWriteContract) return harness.onWriteContract(req);
              return `0x${String(writeCalls.length).repeat(64)}`;
            },
          },
        }),
      },
      "@/app/[locale]/margin-trading/lending-order/[id]/stores/useDepositOrderStatusStore": {
        OrderDepositStatus,
        useDepositOrderStatusStore: () => ({
          setStatus: (s) => statuses.push(s),
          setDepositHash: () => {},
          setApproveHash: () => {},
          setTransferHash: () => {},
        }),
      },
      "@/config/abis/erc223": {
        ERC223_ABI: viem.parseAbi([
          "function transfer(address to, uint256 value) returns (bool)",
        ]),
      },
      "@/config/abis/marginModule": {
        MARGIN_MODULE_ABI: viem.parseAbi([
          "function orderDepositEth(uint256 _orderId) payable",
          "function orderDepositToken(uint256 _orderId, uint256 amount)",
        ]),
      },
      "@/config/modules": {
        isMarginDeployed: () => true,
      },
      "@/functions/getTransactionWithRetries": {
        getTransactionWithRetries: async () => ({ nonce: 1 }),
      },
      "@/hooks/useAllowance": {
        useStoreAllowance: () => ({
          isAllowed: harness.isAllowed ?? true,
          writeTokenApprove:
            harness.writeTokenApprove ??
            (async () => ({ success: true, hash: `0x${"b".repeat(64)}` })),
        }),
      },
      "@/hooks/useCurrentChainId": { default: () => 1, __esModule: true },
      "@/sdk_bi/addresses": {
        MARGIN_TRADING_ADDRESS: { 1: MARGIN_MODULE },
      },
      "@/sdk_bi/chains": { DexChainId: { MAINNET: 1 } },
      "@/sdk_bi/entities/currency": {},
      "@/sdk_bi/standard": { Standard },
      "@/stores/useRecentTransactionsStore": {
        GasFeeModel: { EIP1559: "EIP1559" },
        RecentTransactionTitleTemplate: {
          TRANSFER: "TRANSFER",
          DEPOSIT: "DEPOSIT",
        },
        stringifyObject: (obj) => obj,
        useRecentTransactionsStore: () => ({
          addRecentTransaction: (tx, addr) => recentTxs.push({ tx, addr }),
        }),
      },
    },
  );

  return { mod, statuses, recentTxs, writeCalls };
}

test("useOrderDeposit calls orderDepositEth for native-asset orders and transfers exact deposit amount for ERC-223 orders", async (t) => {
  t.mock.method(console, "error", () => {});

  // 1. Native lending order (orders[_orderId].baseAsset == address(0)) calls orderDepositEth(orderId)
  const nativeRun = loadOrderDepositModule();
  const { handleOrderDeposit: depositNative } = nativeRun.mod.default({
    orderId: 5,
    currency: NATIVE_ETH,
    amount: "1.5",
    standard: Standard.ERC20,
  });
  await depositNative("1.5");

  assert.equal(nativeRun.writeCalls.length, 1);
  assert.equal(nativeRun.writeCalls[0].functionName, "orderDepositEth");
  assert.deepEqual(nativeRun.writeCalls[0].args, [5n]);
  assert.equal(nativeRun.writeCalls[0].value, viem.parseUnits("1.5", 18));
  assert.deepEqual(nativeRun.statuses, [
    OrderDepositStatus.PENDING_DEPOSIT,
    OrderDepositStatus.LOADING_DEPOSIT,
    OrderDepositStatus.SUCCESS,
  ]);

  // 2. ERC-223 lending order transfers exact deposit amount (not stale amountToApprove) before orderDepositToken
  const erc223Run = loadOrderDepositModule();
  const { handleOrderDeposit: depositErc223 } = erc223Run.mod.default({
    orderId: 8,
    currency: LOAN_TOKEN,
    amount: "100",
    standard: Standard.ERC223,
  });
  await depositErc223("0");

  assert.equal(erc223Run.writeCalls.length, 2);
  assert.equal(erc223Run.writeCalls[0].functionName, "transfer");
  assert.equal(erc223Run.writeCalls[0].address, LOAN_TOKEN.address1);
  assert.deepEqual(erc223Run.writeCalls[0].args, [
    MARGIN_MODULE,
    viem.parseUnits("100", 18),
  ]);
  assert.equal(erc223Run.writeCalls[1].functionName, "orderDepositToken");
  assert.deepEqual(erc223Run.writeCalls[1].args, [8n, viem.parseUnits("100", 18)]);
  assert.deepEqual(erc223Run.statuses, [
    OrderDepositStatus.PENDING_TRANSFER,
    OrderDepositStatus.LOADING_TRANSFER,
    OrderDepositStatus.PENDING_DEPOSIT,
    OrderDepositStatus.LOADING_DEPOSIT,
    OrderDepositStatus.SUCCESS,
  ]);

  // 3. Wallet rejection during native orderDepositEth transitions cleanly to ERROR_DEPOSIT
  const rejectedNativeRun = loadOrderDepositModule({
    onWriteContract: async () => {
      throw new Error("User rejected request");
    },
  });
  const { handleOrderDeposit: depositNativeReject } = rejectedNativeRun.mod.default({
    orderId: 5,
    currency: NATIVE_ETH,
    amount: "1.5",
    standard: Standard.ERC20,
  });
  await depositNativeReject("1.5");
  assert.deepEqual(rejectedNativeRun.statuses, [
    OrderDepositStatus.PENDING_DEPOSIT,
    OrderDepositStatus.ERROR_DEPOSIT,
  ]);
});

test("DepositForm, PositionDepositDialog, and OrderDepositDialog transpile cleanly and wire standard/balance guards", () => {
  const uiFiles = [
    "app/[locale]/margin-trading/types/index.ts",
    "app/[locale]/margin-trading/hooks/helpers.ts",
    "app/[locale]/margin-trading/position/[id]/deposit/hooks/usePositionDeposit.ts",
    "app/[locale]/margin-trading/position/[id]/deposit/components/DepositForm.tsx",
    "app/[locale]/margin-trading/position/[id]/deposit/components/PositionDepositDialog.tsx",
    "app/[locale]/margin-trading/lending-order/[id]/hooks/useOrderDeposit.ts",
    "app/[locale]/margin-trading/lending-order/[id]/components/OrderDepositDialog.tsx",
  ];

  for (const relPath of uiFiles) {
    const fullPath = path.join(root, relPath);
    const src = fs.readFileSync(fullPath, "utf8");
    const result = ts.transpileModule(src, {
      fileName: fullPath,
      reportDiagnostics: true,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
      },
    });
    assert.deepEqual(result.diagnostics, [], `Diagnostics in ${relPath}`);
    assert.ok(result.outputText.length > 0);
  }

  const orderDialogSrc = fs.readFileSync(
    path.join(
      root,
      "app/[locale]/margin-trading/lending-order/[id]/components/OrderDepositDialog.tsx",
    ),
    "utf8",
  );
  assert.match(orderDialogSrc, /order\.baseAsset\.isNative \|\| order\.baseAssetStandard === Standard\.ERC20\s*\?\s*tokenA0Balance\s*:\s*tokenA1Balance/);

  const posDialogSrc = fs.readFileSync(
    path.join(
      root,
      "app/[locale]/margin-trading/position/[id]/deposit/components/PositionDepositDialog.tsx",
    ),
    "utf8",
  );
  assert.match(posDialogSrc, /assetToDeposit\.isToken && assetToDepositStandard === Standard\.ERC20/);
  assert.match(posDialogSrc, /standard=\{assetToDepositStandard\}/);
});

