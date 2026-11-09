"use client";

import clsx from "clsx";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Svg from "@/components/atoms/Svg";
import { useColorScheme } from "@/lib/color-scheme";
import addToast from "@/other/toast";

import ChartCanvas, {
  ChartCanvasHandle,
  COMPARE_VALUES,
  CompareSeries,
  IndicatorValues,
  LoadState,
  PaneLayout,
} from "./ChartCanvas";
import ChartFooter from "./ChartFooter";
import { PaneLabels, PriceLegend } from "./ChartLegend";
import CompareMenu from "./CompareMenu";
import { Bar, Datafeed, Resolution, RESOLUTIONS, resolutionSeconds, Trade } from "./datafeed/types";
import { Drawing, DrawingTool } from "./drawings/primitive";
import DrawingToolbar from "./DrawingToolbar";
import { formatPrice } from "./format";
import IndicatorsMenu from "./IndicatorsMenu";
import {
  ChartType,
  useChartPreferences,
  useChartPreferencesReady,
  useTradingChartStore,
} from "./store";
import { accentClasses, chartTheme } from "./theme";
import {
  ChartSkeleton,
  ChartTypeIcon,
  EmptyState,
  FullscreenIcon,
  SegmentButton,
  Segmented,
  ToolButton,
} from "./ui";

const CHART_TYPES: ChartType[] = ["candles", "line", "area"];

export interface IntervalOption {
  value: string;
  label: string;
  disabled?: boolean;
  title?: string;
}

interface Props {
  datafeed: Datafeed;
  symbol: string;
  /** "ETH/USDC": the legend, watermark, alerts and saved image name. */
  label: string;
  /** Short source for the legend, e.g. "Dex223" or "Binance". */
  sourceShort: string;
  /** One line under the chart saying where the data comes from. */
  sourceLong: string;
  volumeUnit: string;
  /** The interval buttons: resolutions on a trading chart, ranges on a coin page. */
  intervals: IntervalOption[];
  interval: string;
  onInterval: (value: string) => void;
  resolution: Resolution;
  initialVisible?: number;
  pageSize?: number;
  heightClassName: string;
  myTrades?: Trade[];
  onLastBar?: (bar: Bar | null) => void;
  onTrades?: (trades: Trade[]) => void;
  alerts?: boolean;
  className?: string;
}

/**
 * The chart itself, with its toolbar, drawing tools, indicators, legends and footer.
 * Shared by the swap and margin pages (a Dex223 pool) and the coin pages (Binance or
 * CoinGecko), which wrap it with their own headers.
 */
export default function ProChart({
  datafeed,
  symbol,
  label,
  sourceShort,
  sourceLong,
  volumeUnit,
  intervals,
  interval,
  onInterval,
  resolution,
  initialVisible,
  pageSize,
  heightClassName,
  myTrades,
  onLastBar,
  onTrades,
  alerts = true,
  className,
}: Props) {
  const t = useTranslations("TradingChart");
  const scheme = useColorScheme();
  const theme = useMemo(() => chartTheme(scheme), [scheme]);
  const accent = useMemo(() => accentClasses(scheme), [scheme]);
  const {
    chartType,
    showVolume,
    indicators,
    drawings: allDrawings,
    magnet,
    scaleMode,
    setChartType,
    setShowVolume,
    setIndicators,
    setDrawings,
    setMagnet,
    setScaleMode,
  } = useTradingChartStore();

  // Saved preferences (indicators, drawings, alerts) load here rather than relying on a
  // page layout to do it: every page with a chart gets them, and nothing is written back
  // over them before they have loaded.
  useChartPreferences();
  const preferencesReady = useChartPreferencesReady();

  const canvasRef = useRef<ChartCanvasHandle>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<{ bar: Bar; values?: IndicatorValues } | null>(null);
  const [last, setLast] = useState<{ bar: Bar; values?: IndicatorValues } | null>(null);
  const [tool, setTool] = useState<DrawingTool>("cursor");
  const [selectedDrawing, setSelectedDrawing] = useState<string | null>(null);
  const [paneLayout, setPaneLayout] = useState<PaneLayout[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [fullscreen, setFullscreen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Comparisons belong to the symbol they were made on.
  const [compare, setCompare] = useState<CompareSeries[]>([]);
  useEffect(() => setCompare([]), [symbol]);
  const effectiveScale = compare.length ? "percent" : scaleMode;
  // Narrow charts (the form column on a laptop, tablets, phones) get a compact toolbar.
  const [width, setWidth] = useState(1000);
  const compact = width < 760;
  // Phones: the toolbar wraps onto a second row rather than hiding controls off-screen.
  const tiny = width < 480;

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const drawings = useMemo(() => allDrawings[symbol] ?? [], [allDrawings, symbol]);
  const drawingsRef = useRef(drawings);
  drawingsRef.current = drawings;
  const onDrawingsChange = useCallback(
    (next: Drawing[]) => setDrawings(symbol, next),
    [setDrawings, symbol],
  );
  const removeIndicator = (id: string) => setIndicators(indicators.filter((c) => c.id !== id));

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // ---------------------------------------------------------------- alerts
  // Checked against every live bar: an alert fires when the close moves across its price.
  const previousClose = useRef<number | null>(null);
  useEffect(() => {
    previousClose.current = null;
  }, [symbol]);

  const checkAlerts = useCallback(
    (bar: Bar | null) => {
      const before = previousClose.current;
      previousClose.current = bar?.close ?? null;
      if (!bar || before === null || before === bar.close) return;
      const crossed = drawingsRef.current.filter(
        (d) =>
          d.type === "alert" &&
          !d.triggered &&
          Math.min(before, bar.close) <= d.points[0].price &&
          d.points[0].price <= Math.max(before, bar.close),
      );
      if (!crossed.length) return;
      const ids = new Set(crossed.map((d) => d.id));
      onDrawingsChange(
        drawingsRef.current.map((d) => (ids.has(d.id) ? { ...d, triggered: true } : d)),
      );
      for (const alert of crossed) {
        const text = t("alert_triggered", {
          pair: label,
          price: formatPrice(alert.points[0].price),
        });
        addToast(text, "info");
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("Dex223", { body: text, tag: alert.id });
        }
      }
    },
    [label, onDrawingsChange, t],
  );

  const chooseTool = (next: DrawingTool) => {
    // Ask once, when the user first reaches for alerts, so they can fire in the background.
    if (
      next === "alert" &&
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().catch(() => {});
    }
    setTool(next);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen?.();
  };

  const saveImage = () => {
    const canvas = canvasRef.current?.screenshot();
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${label.replace("/", "-")}-${resolution}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const legend = hovered ?? last;
  const lastBar = last?.bar ?? null;
  const resolutionLabel = RESOLUTIONS.find((r) => r.value === resolution)?.label ?? "";

  return (
    <div
      ref={rootRef}
      className={clsx(
        "flex flex-col bg-primary-bg",
        fullscreen && "fixed inset-0 z-[100]",
        className,
      )}
    >
      {/* Toolbar */}
      <div
        className={clsx(
          "flex items-center gap-2 px-3 md:px-4 py-2",
          tiny ? "flex-wrap" : "overflow-x-auto no-scrollbar",
        )}
      >
        <Segmented label={t("interval")}>
          {intervals.map((option) => (
            <SegmentButton
              key={option.value}
              active={interval === option.value}
              disabled={option.disabled}
              title={option.title}
              onClick={() => onInterval(option.value)}
            >
              {option.label}
            </SegmentButton>
          ))}
        </Segmented>

        {compact ? (
          <ToolButton
            label={`${t("chart_type")}: ${t(chartType)}`}
            onClick={() =>
              setChartType(CHART_TYPES[(CHART_TYPES.indexOf(chartType) + 1) % CHART_TYPES.length])
            }
          >
            <ChartTypeIcon type={chartType} />
          </ToolButton>
        ) : (
          <Segmented label={t("chart_type")}>
            {CHART_TYPES.map((type) => (
              <SegmentButton
                key={type}
                active={chartType === type}
                onClick={() => setChartType(type)}
                ariaLabel={t(type)}
                title={t(type)}
                icon
              >
                <ChartTypeIcon type={type} />
              </SegmentButton>
            ))}
          </Segmented>
        )}

        <IndicatorsMenu
          indicators={indicators}
          onChange={setIndicators}
          showVolume={showVolume}
          onShowVolume={setShowVolume}
          accent={accent}
          compact={compact}
        />

        <CompareMenu
          symbol={symbol}
          compare={compare}
          onChange={setCompare}
          accent={accent}
          compact={compact}
        />

        <div className="ml-auto flex items-center gap-0.5 shrink-0">
          <ToolButton label={t("reset_view")} onClick={() => canvasRef.current?.resetView()}>
            <Svg iconName="reset" size={18} />
          </ToolButton>
          <ToolButton label={t("save_image")} onClick={saveImage}>
            <Svg iconName="download" size={18} />
          </ToolButton>
          <ToolButton
            label={fullscreen ? t("exit_fullscreen") : t("fullscreen")}
            onClick={toggleFullscreen}
          >
            <FullscreenIcon exit={fullscreen} />
          </ToolButton>
        </div>
      </div>

      {/* Plot */}
      <div
        className={clsx(
          "flex border-t border-secondary-border",
          fullscreen ? "flex-1 min-h-0" : heightClassName,
        )}
      >
        {preferencesReady && (
          <DrawingToolbar
            tool={tool}
            onTool={chooseTool}
            magnet={magnet}
            onMagnet={setMagnet}
            hasSelection={!!selectedDrawing}
            onDeleteSelected={() => canvasRef.current?.deleteSelected()}
            drawingCount={drawings.length}
            onClearAll={() => {
              onDrawingsChange([]);
              setSelectedDrawing(null);
            }}
            accent={accent}
            alerts={alerts}
          />
        )}
        <div className="relative flex-1 min-w-0">
          {preferencesReady && (
            <ChartCanvas
              key={reloadKey}
              ref={canvasRef}
              datafeed={datafeed}
              symbol={symbol}
              resolution={resolution}
              chartType={chartType}
              showVolume={showVolume}
              theme={theme}
              myTrades={myTrades}
              pageSize={pageSize}
              initialVisible={initialVisible}
              watermark={label}
              indicators={indicators}
              scaleMode={effectiveScale}
              compare={compare}
              tool={tool}
              magnet={magnet}
              drawings={drawings}
              onDrawingsChange={onDrawingsChange}
              onToolDone={() => setTool("cursor")}
              onSelectDrawing={setSelectedDrawing}
              onLayout={setPaneLayout}
              onHover={(bar, values) => setHovered(bar ? { bar, values } : null)}
              onLastBar={(bar, values) => {
                setLast(bar ? { bar, values } : null);
                checkAlerts(bar);
                onLastBar?.(bar);
              }}
              onState={setLoadState}
              onTrades={onTrades}
            />
          )}

          {loadState === "ready" && legend && (
            <>
              <PriceLegend
                title={`${label} · ${resolutionLabel} · ${sourceShort}`}
                bar={legend.bar}
                indicators={indicators}
                indicatorValues={legend.values}
                volumeLabel={t("volume")}
                volumeUnit={volumeUnit}
                removeLabel={t("remove")}
                onRemove={removeIndicator}
                compare={compare}
                compareValues={legend.values?.[COMPARE_VALUES]}
                onRemoveCompare={(sym) => setCompare(compare.filter((c) => c.symbol !== sym))}
              />
              <PaneLabels
                layout={paneLayout}
                indicators={indicators}
                indicatorValues={legend.values}
                bar={legend.bar}
                volumeLabel={t("volume")}
                volumeUnit={volumeUnit}
                removeLabel={t("remove")}
                onRemove={removeIndicator}
              />
            </>
          )}

          {(!preferencesReady || loadState === "loading") && <ChartSkeleton />}
          {loadState === "empty" && (
            <EmptyState
              icon="candle"
              title={t("empty_title")}
              description={t("empty_description")}
            />
          )}
          {loadState === "error" && (
            <EmptyState
              icon="warning"
              title={t("error_title")}
              description={t("error_description")}
              action={
                <button
                  type="button"
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="mt-1 px-4 h-9 rounded-2 bg-tertiary-bg text-primary-text text-14 hocus:bg-quaternary-bg duration-200"
                >
                  {t("retry")}
                </button>
              }
            />
          )}
        </div>
      </div>

      <ChartFooter
        source={sourceLong}
        sourceShort={sourceShort}
        compact={compact}
        accent={accent}
        lastBar={lastBar}
        seconds={resolutionSeconds(resolution)}
        scaleMode={effectiveScale}
        onScaleMode={setScaleMode}
        scaleLocked={compare.length ? t("compare_scale_locked") : undefined}
      />
    </div>
  );
}
