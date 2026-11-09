import { Chain, http, webSocket } from "viem";
import {
  arbitrum,
  avalanche,
  base,
  bsc,
  bscTestnet,
  ink,
  linea,
  mainnet,
  mantle,
  optimism,
  polygon,
  sonic,
  unichain,
} from "viem/chains";
import { createConfig, createStorage, parseCookie } from "wagmi";
import { coinbaseWallet, injected, metaMask, walletConnect } from "wagmi/connectors";

import { eos } from "@/config/chains/eos";
import { monad } from "@/config/chains/monad";
import { plasma } from "@/config/chains/plasma";
import { sepolia } from "@/config/chains/sepolia";
import { receiptAwareFallback } from "@/config/wagmi/receiptAwareFallback";
import { rpcProxyUrl } from "@/config/wagmi/rpcProxyUrl";
import { DexChainId } from "@/sdk_bi/chains";

const viemChains: Record<DexChainId, Chain> = {
  [DexChainId.MAINNET]: mainnet,
  [DexChainId.SEPOLIA]: sepolia,
  [DexChainId.BSC_TESTNET]: bscTestnet,
  [DexChainId.EOS]: eos,
  [DexChainId.BASE]: base,
  [DexChainId.BSC]: bsc,
  [DexChainId.ARBITRUM]: arbitrum,
  [DexChainId.POLYGON]: polygon,
  [DexChainId.AVALANCHE]: avalanche,
  [DexChainId.OPTIMISM]: optimism,
  [DexChainId.MONAD]: monad,
  [DexChainId.UNICHAIN]: unichain,
  [DexChainId.PLASMA]: plasma,
  [DexChainId.SONIC]: sonic,
  [DexChainId.LINEA]: linea,
  [DexChainId.INK]: ink,
  [DexChainId.MANTLE]: mantle,
};

// Real networks stay off the test app (#257). EOS stays in the wallet config only so calls typed
// against every DexChainId still typecheck; the network picker does not offer it.
const enabledChains = (
  process.env.NEXT_PUBLIC_ENV === "production"
    ? [DexChainId.MAINNET]
    : [DexChainId.SEPOLIA, DexChainId.BSC_TESTNET, DexChainId.EOS]
).map((chainId) => viemChains[chainId]) as [Chain, ...Chain[]];

const cookieStorage = {
  getItem(key: string) {
    if (typeof window === "undefined") return null;
    const value = parseCookie(document.cookie, key);
    return value ?? null;
  },
  setItem(key: string, value: string) {
    if (typeof window === "undefined") return;
    document.cookie = `${key}=${value};path=/;samesite=Lax`;
  },
  removeItem(key: string) {
    if (typeof window === "undefined") return;
    document.cookie = `${key}=;path=/;max-age=-1`;
  },
};

export const config = createConfig({
  chains: enabledChains,
  connectors: [
    walletConnect({
      projectId: "0af4613ea1c747c660416c4a7a114616",
      // Stops the SDK batching usage and error events to pulse.walletconnect.org. The app
      // never reads them, and a failed batch shows up as a console error. (2.17 still sends
      // one INIT ping on load.)
      telemetryEnabled: false,
    }),
    coinbaseWallet({
      appName: "DEX223",
      appLogoUrl: "https://test-app.dex223.io/tokens/DEX.svg",
    }),
    metaMask({
      dappMetadata: {
        name: "dex223.io",
        url: "https://app.dex223.io",
      },
      useDeeplink: true,
    }),
    injected({
      target: "trust",
    }),
  ],
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
  multiInjectedProviderDiscovery: false, // to avoid connecting to io.metamask and other injected connectors
  transports: {
    [mainnet.id]: receiptAwareFallback([
      // dRPC (keyed and public) rejects every Ethereum method, ethereum.callstaticrpc.com no longer
      // resolves and 1rpc.io/eth is discontinued, so all three were removed. Each failed attempt
      // logged console errors before the fallback moved on.
      //
      // Alchemy first, through our server (the key never reaches the bundle). Public RPCs follow:
      // they rate-limit, lag and miss receipts, so production reads should not depend on them. The
      // proxy answers 503 without a key and 429 past its per-IP limit; either moves the fallback on.
      http(rpcProxyUrl("mainnet")),
      webSocket("wss://ethereum-rpc.publicnode.com"),
      http("https://ethereum-rpc.publicnode.com"),
      http("https://eth-mainnet.public.blastapi.io"),
      http("https://mainnet.gateway.tenderly.co"),
      http(),
    ]),
    [sepolia.id]: receiptAwareFallback([
      // NOTE: the previous first two entries pointed at lb.drpc.org/sepolia, which dRPC has moved behind
      // a paid plan - it now answers every request with HTTP 400 "chain is not available on free plan",
      // so Sepolia was completely broken in the UI.
      //
      // The third entry was wss://ethereum-rpc.publicnode.com, which is MAINNET (chainId 1) listed as a
      // Sepolia fallback. With the drpc entries failing, that was the next transport tried.
      //
      // rpc.ankr.com/eth_sepolia no longer answers either.
      //
      // Keyed providers (Alchemy, then Infura) through our server first: the keys never reach the
      // bundle, and publicnode's Sepolia node misses some receipts. Answers 503 when no key is
      // configured, so the fallback moves on to publicnode.
      http(rpcProxyUrl("sepolia")),
      webSocket("wss://ethereum-sepolia-rpc.publicnode.com"),
      http("https://ethereum-sepolia-rpc.publicnode.com"),
      http(),
    ]),
    [bscTestnet.id]: receiptAwareFallback([
      // webSocket("wss://bsc-testnet-rpc.publicnode.com"),
      http("https://api.zan.top/bsc-testnet"),
      http("https://endpoints.omniatech.io/v1/bsc/testnet/public"),
      http("https://bsc-testnet.public.blastapi.io"),
      http("https://bsc-testnet-rpc.publicnode.com"),
      http("https://data-seed-prebsc-1-s1.bnbchain.org:8545"),
      http(),
    ]),
    // The Vaulta Foundation shut down the public EOS EVM RPC on 2025-10-08; this must be our own node.
    [eos.id]: http(process.env.NEXT_PUBLIC_EOSEVM_RPC_URL),
    // Public RPCs. Swap in private endpoints before a chain goes to production.
    [base.id]: receiptAwareFallback([
      http("https://mainnet.base.org"),
      http("https://base-rpc.publicnode.com"),
    ]),
    [bsc.id]: receiptAwareFallback([
      http("https://bsc-dataseed.bnbchain.org"),
      http("https://bsc-rpc.publicnode.com"),
    ]),
    [arbitrum.id]: receiptAwareFallback([
      http("https://arb1.arbitrum.io/rpc"),
      http("https://arbitrum-one-rpc.publicnode.com"),
    ]),
    [polygon.id]: receiptAwareFallback([
      http("https://polygon.drpc.org"),
      http("https://polygon-bor-rpc.publicnode.com"),
    ]),
    [avalanche.id]: receiptAwareFallback([
      http("https://api.avax.network/ext/bc/C/rpc"),
      http("https://avalanche-c-chain-rpc.publicnode.com"),
    ]),
    [optimism.id]: receiptAwareFallback([
      http("https://mainnet.optimism.io"),
      http("https://optimism-rpc.publicnode.com"),
    ]),
    [monad.id]: http("https://rpc.monad.xyz"),
    [unichain.id]: http("https://mainnet.unichain.org"),
    [plasma.id]: http("https://rpc.plasma.to"),
    [sonic.id]: http("https://rpc.soniclabs.com"),
    [linea.id]: http("https://rpc.linea.build"),
    [ink.id]: http("https://rpc-gel.inkonchain.com"),
    [mantle.id]: http("https://rpc.mantle.xyz"),
  },
});
