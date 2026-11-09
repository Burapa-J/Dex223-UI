"use client";

import { useState } from "react";

import { MarketApiDatafeed } from "@/components/trading-chart/datafeed/marketApi";
import { Bar, Resolution } from "@/components/trading-chart/datafeed/types";
import ProChart from "@/components/trading-chart/ProChart";

const datafeed = new MarketApiDatafeed();

// CoinMarketCap-style ranges, each at a resolution that gives a readable number of bars.
const RANGES: { key: string; resolution: Resolution; bars: number }[] = [
  { key: "1D", resolution: "15", bars: 96 },
  { key: "7D", resolution: "60", bars: 168 },
  { key: "1M", resolution: "240", bars: 180 },
  { key: "3M", resolution: "1D", bars: 90 },
  { key: "1Y", resolution: "1D", bars: 365 },
  { key: "ALL", resolution: "1W", bars: Infinity },
];

/** A coin's chart: the full chart with drawing tools and indicators, over date ranges. */
export default function CoinChart({
  symbol,
  label,
  volumeUnit,
  sourceLong,
  onLastBar,
}: {
  symbol: string;
  /** "ETH/USD" */
  label: string;
  volumeUnit: string;
  sourceLong: string;
  onLastBar?: (bar: Bar | null) => void;
}) {
  const [range, setRange] = useState(RANGES[1]);

  return (
    <ProChart
      className="rounded-5 overflow-hidden"
      datafeed={datafeed}
      symbol={symbol}
      label={label}
      sourceShort={symbol.startsWith("BINANCE:") ? "Binance" : "CoinGecko"}
      sourceLong={sourceLong}
      volumeUnit={volumeUnit}
      intervals={RANGES.map((r) => ({ value: r.key, label: r.key }))}
      interval={range.key}
      onInterval={(key) => setRange(RANGES.find((r) => r.key === key) ?? RANGES[1])}
      resolution={range.resolution}
      initialVisible={range.bars}
      pageSize={Number.isFinite(range.bars) ? Math.max(300, range.bars + 10) : 1000}
      heightClassName="h-[420px] md:h-[520px]"
      onLastBar={onLastBar}
      alerts={!symbol.startsWith("COINGECKO:")}
    />
  );
}
