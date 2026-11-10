import { useCallback } from "react";

import { useMarginSwapPositionStore } from "@/app/[locale]/margin-swap/stores/useMarginSwapPositionStore";
import { useMarginSwapTokensStore } from "@/app/[locale]/margin-swap/stores/useMarginSwapTokensStore";
import { MarginPosition } from "@/app/[locale]/margin-trading/types";
import { getDefaultStandard } from "@/functions/getDefaultStandard";
import { useRouter } from "@/i18n/routing";
import { Currency } from "@/sdk_bi/entities/currency";
import { Standard } from "@/sdk_bi/standard";

/**
 * All currencies `position` may swap into on-chain: `Dex223MarginModule._validateAsset` permits
 * the order's trading whitelist (`allowedTradingAssets`), `order.baseAsset` (`position.loanAsset`,
 * so borrowers can always buy back the loan currency to close their position), and the position's
 * initial collateral (`position.collateralAsset`). Native ETH has no pool on Dex223Factory and
 * cannot be swapped through `marginSwap` / `marginSwap223`.
 */
export function getPositionAllowedOutputAssets(position: MarginPosition): Currency[] {
  const result: Currency[] = [];
  const pushUnique = (currency: Currency | undefined) => {
    if (!currency || currency.isNative) return;
    if (!result.some((existing) => existing.equals(currency))) {
      result.push(currency);
    }
  };

  for (const asset of position.order.allowedTradingAssets ?? []) {
    pushUnique(asset);
  }
  pushUnique(position.loanAsset);
  pushUnique(position.collateralAsset);

  return result;
}

export function canPositionReceiveToken(position: MarginPosition, token: Currency): boolean {
  return getPositionAllowedOutputAssets(position).some((asset) => asset.equals(token));
}

/**
 * Standard (`ERC20` or `ERC223`) in which `position` currently holds `token`. Prefers `ERC20` when
 * the position has a positive ERC-20 balance, switches to `ERC223` when the position holds a
 * positive ERC-223 balance (or only has an ERC-223 slot for `token`), and falls back to the
 * default standard otherwise.
 */
export function getPositionHeldStandard(
  position: MarginPosition | undefined,
  token: Currency | undefined,
): Standard {
  if (!position || !token || token.isNative) {
    return getDefaultStandard(token);
  }

  const addr0 = token.wrapped.address0.toLowerCase();
  const addr1 = token.wrapped.address1.toLowerCase();
  const slot0 = position.assetAddresses?.find((a) => a.address.toLowerCase() === addr0);
  const slot1 = position.assetAddresses?.find((a) => a.address.toLowerCase() === addr1);

  if (slot0 && slot0.balance > 0n) return Standard.ERC20;
  if (slot1 && slot1.balance > 0n) return Standard.ERC223;
  if (slot1 && !slot0) return Standard.ERC223;

  return Standard.ERC20;
}

/**
 * Standard (`ERC20` or `ERC223`) that `position` should receive `token` in by default:
 * - If `token` is the order's `baseAsset`, use `order.baseAssetStandard` when allowed so buying
 *   back the loan currency credits `position.balances[0]` directly for `positionClose`.
 * - Otherwise, if the order's whitelist only permits the ERC-223 address of `token`, select
 *   `Standard.ERC223`.
 */
export function getPositionAllowedOutputStandard(
  position: MarginPosition | undefined,
  token: Currency | undefined,
): Standard {
  if (!position || !token || token.isNative) {
    return getDefaultStandard(token);
  }

  const addr0 = token.wrapped.address0.toLowerCase();
  const addr1 = token.wrapped.address1.toLowerCase();
  const allowed = new Set(
    (position.order.allowedTradingAddresses ?? []).map((a) => a.toLowerCase()),
  );
  if (position.collateralAsset && token.equals(position.collateralAsset)) {
    for (const colAddr of position.order.collateralAddresses ?? []) {
      allowed.add(colAddr.toLowerCase());
    }
  }
  const has20 = allowed.has(addr0);
  const has223 = allowed.has(addr1);

  if (token.equals(position.loanAsset) && position.order.baseAssetStandard !== undefined) {
    return position.order.baseAssetStandard;
  }

  if (has223 && !has20) {
    return Standard.ERC223;
  }

  return Standard.ERC20;
}

/**
 * The pair and standards the margin swap should open on for `position`: sell what the position
 * holds (the loan asset while it still has a balance, otherwise the first non-native asset that
 * does) in the standard the position actually holds, and buy the first other token the position
 * is allowed to receive in its allowed standard.
 */
export function getPositionTradePair(position: MarginPosition): {
  tokenA: Currency | undefined;
  tokenB: Currency | undefined;
  tokenAStandard: Standard;
  tokenBStandard: Standard;
} {
  const held = position.assetsWithBalances.filter(
    ({ asset, balance }) => !asset.isNative && !!balance && balance > BigInt(0),
  );
  const loanHeld = held.find(({ asset }) => asset.equals(position.loanAsset));
  const tokenA =
    loanHeld?.asset ??
    held[0]?.asset ??
    (!position.loanAsset.isNative ? position.loanAsset : position.assets.find((a) => !a.isNative));
  const allowedOutputs = getPositionAllowedOutputAssets(position);
  const tokenB = allowedOutputs.find((asset) => !tokenA || !asset.equals(tokenA));

  return {
    tokenA,
    tokenB,
    tokenAStandard: getPositionHeldStandard(position, tokenA),
    tokenBStandard: getPositionAllowedOutputStandard(position, tokenB),
  };
}

/** Opens the margin swap page for `position`, with the position and its trading pair preselected. */
export function useOpenMarginSwapForPosition() {
  const router = useRouter();
  const { setMarginSwapPositionId } = useMarginSwapPositionStore();
  const { setTokenA, setTokenB, setTokenAStandard, setTokenBStandard } = useMarginSwapTokensStore();

  return useCallback(
    (position: MarginPosition) => {
      const { tokenA, tokenB, tokenAStandard, tokenBStandard } = getPositionTradePair(position);
      setMarginSwapPositionId(position.id);
      setTokenA(tokenA);
      setTokenAStandard(tokenAStandard);
      setTokenB(tokenB);
      setTokenBStandard(tokenBStandard);
      router.push("/margin-swap");
    },
    [router, setMarginSwapPositionId, setTokenA, setTokenAStandard, setTokenB, setTokenBStandard],
  );
}
