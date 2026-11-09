"use client";
import { redirect } from "next/navigation";
import { useTranslations } from "next-intl";
import React, { useMemo } from "react";
import { useAccount } from "wagmi";

import SelectPositionDialog, {
  SelectedPositionInfo,
} from "@/app/[locale]/margin-swap/components/SelectPositionDialog";
import TradeForm from "@/app/[locale]/margin-swap/components/TradeForm";
import { useMarginSwapDefaultPair } from "@/app/[locale]/margin-swap/hooks/useMarginSwapDefaultPair";
import { canPositionReceiveToken } from "@/app/[locale]/margin-swap/hooks/useOpenMarginSwapForPosition";
import { useMarginSwapTokensStore } from "@/app/[locale]/margin-swap/stores/useMarginSwapTokensStore";
import { usePositionsByOwner } from "@/app/[locale]/margin-trading/hooks/useMarginPosition";
import { MarginPosition } from "@/app/[locale]/margin-trading/types";
import { useMarginTrade } from "@/app/[locale]/swap/hooks/useTrade";
import { useSwapRecentTransactionsStore } from "@/app/[locale]/swap/stores/useSwapRecentTransactions";
import RecentTransactions from "@/components/common/RecentTransactions";
import SelectedTokensInfo from "@/components/common/SelectedTokensInfo";
import { useTradingChartStore } from "@/components/trading-chart/store";
import TradingChart from "@/components/trading-chart/TradingChart";
import TradingLayout from "@/components/trading-chart/TradingLayout";
import { ThemeColors } from "@/config/theme/colors";
import { ColorSchemeProvider } from "@/lib/color-scheme";

export default function MarginSwapPage() {
  useMarginSwapDefaultPair();

  const t = useTranslations("Margin");
  const { isOpened: showRecentTransactions, setIsOpened: setShowRecentTransactions } =
    useSwapRecentTransactionsStore();
  const { tokenA, tokenB, reset: resetTokens } = useMarginSwapTokensStore();
  const { address } = useAccount();
  const { loading, positions } = usePositionsByOwner({ owner: address });
  const { trade } = useMarginTrade();

  const openedPositions = useMemo(() => {
    return positions?.filter((position) => !position.isLiquidated && !position.isClosed);
  }, [positions]);

  const [matchingPositions, otherPositions] = useMemo(() => {
    if (!tokenA && !tokenB) {
      return [openedPositions, openedPositions];
    }

    const matching: MarginPosition[] = [];
    const other: MarginPosition[] = [];

    for (const position of openedPositions ?? []) {
      const hasA = tokenA && position.assets.some((asset) => asset.equals(tokenA));

      const hasB = tokenB && canPositionReceiveToken(position, tokenB);

      // If tokenA is provided → must match assets
      // If tokenB is provided → must match allowedTradingAssets, loanAsset, or collateralAsset
      // If both are provided → both must match
      const matches = (!tokenA || hasA) && (!tokenB || hasB);

      if (matches) {
        matching.push(position);
      } else {
        other.push(position);
      }
    }

    return [matching, other];
  }, [openedPositions, tokenA, tokenB]);

  const { visible: chartVisible, setVisible: setChartVisible } = useTradingChartStore();
  const showChart = chartVisible && !!tokenA && !!tokenB;

  return (
    <ColorSchemeProvider value={ThemeColors.PURPLE}>
      <TradingLayout
        showChart={showChart}
        showRecent={showRecentTransactions}
        form={
          <>
            <div className="flex flex-col gap-2 lg:gap-3">
              <div className="flex justify-between items-center pl-4 pr-5 py-2 text-secondary-text border-l-4 bg-primary-bg rounded-2 border-purple">
                {!address ? (
                  t("swap_connect_to_see_positions")
                ) : !openedPositions?.length ? (
                  t("swap_no_active_positions")
                ) : (
                  <>
                    {!!(tokenA && !tokenB && matchingPositions?.length) &&
                      t("swap_positions_with_a", {
                        count: matchingPositions.length,
                        symbolA: tokenA.symbol ?? "",
                      })}
                    {!!(tokenB && !tokenA && matchingPositions?.length) &&
                      t("swap_positions_for_b", {
                        count: matchingPositions.length,
                        symbolB: tokenB.symbol ?? "",
                      })}
                    {!!(tokenA && tokenB && matchingPositions?.length) &&
                      t("swap_positions_with_a_for_b", {
                        count: matchingPositions.length,
                        symbolA: tokenA.symbol ?? "",
                        symbolB: tokenB.symbol ?? "",
                      })}
                    {(!!tokenA || !!tokenB) &&
                      matchingPositions?.length === 0 &&
                      t("swap_no_positions_for_tokens")}
                    {!tokenA &&
                      !tokenB &&
                      t("swap_you_have_positions", { count: openedPositions.length })}
                  </>
                )}
                <SelectPositionDialog />
              </div>
            </div>

            <SelectedPositionInfo />

            <TradeForm setIsChartVisible={setChartVisible} isChartVisible={chartVisible} />
            <SelectedTokensInfo tokenA={tokenA} tokenB={tokenB} />
          </>
        }
        chart={
          <TradingChart tokenA={tokenA} tokenB={tokenB} routedFee={trade?.route.pools?.[0]?.fee} />
        }
        recent={
          <RecentTransactions
            showRecentTransactions={showRecentTransactions}
            handleClose={() => setShowRecentTransactions(false)}
            store={useSwapRecentTransactionsStore}
          />
        }
      />
    </ColorSchemeProvider>
  );
}
