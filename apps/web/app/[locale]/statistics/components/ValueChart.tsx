"use client";

import { area, curveMonotoneX, extent, line, scaleLinear, scaleTime } from "d3";
import { useMemo, useState } from "react";

export interface ValuePoint {
  date: number;
  value: number;
}

interface Props {
  series: ValuePoint[];
  width: number;
  height: number;
  emptyLabel: string;
  isLoading?: boolean;
  color?: string;
  onHover?: (point: ValuePoint | null) => void;
  formatValue?: (value: number) => string;
}

const MARGIN = { top: 8, right: 8, bottom: 20, left: 8 };
const CHART_GREEN = "#7DA491";
const CHART_GUIDE = "#575A5D";

export default function ValueChart({
  series,
  width,
  height,
  emptyLabel,
  isLoading = false,
  color = CHART_GREEN,
  onHover,
}: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const { xScale, yScale, linePath, areaPath } = useMemo(() => {
    if (series.length === 0 || innerWidth <= 0 || innerHeight <= 0) {
      return { xScale: null, yScale: null, linePath: null, areaPath: null };
    }

    const x = scaleTime()
      .domain(extent(series, (d) => new Date(d.date * 1000)) as [Date, Date])
      .range([0, innerWidth]);

    const [lo, hi] = extent(series, (d) => d.value) as [number, number];
    const pad = hi === lo ? Math.abs(hi) * 0.05 || 1 : (hi - lo) * 0.1;
    const y = scaleLinear()
      .domain([Math.max(0, lo - pad), hi + pad])
      .range([innerHeight, 0]);

    const lineGen = line<ValuePoint>()
      .x((d) => x(new Date(d.date * 1000))!)
      .y((d) => y(d.value)!)
      .curve(curveMonotoneX);

    const areaGen = area<ValuePoint>()
      .x((d) => x(new Date(d.date * 1000))!)
      .y0(innerHeight)
      .y1((d) => y(d.value)!)
      .curve(curveMonotoneX);

    return {
      xScale: x,
      yScale: y,
      linePath: lineGen(series),
      areaPath: areaGen(series),
    };
  }, [series, innerWidth, innerHeight]);

  if (isLoading || series.length === 0 || !xScale || !linePath) {
    return (
      <div
        className="flex items-center justify-center text-14 text-secondary-text"
        style={{ width, height }}
      >
        {isLoading ? "…" : emptyLabel}
      </div>
    );
  }

  const pickNearest = (clientX: number, currentTarget: Element) => {
    const rect = currentTarget.getBoundingClientRect();
    const px = clientX - rect.left - MARGIN.left;
    const t = xScale.invert(px).getTime() / 1000;
    let best = 0;
    let bestDist = Infinity;
    series.forEach((p, i) => {
      const d = Math.abs(p.date - t);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setHoverIndex(best);
    onHover?.(series[best]);
  };

  const clearHover = () => {
    setHoverIndex(null);
    onHover?.(null);
  };

  const hoverPoint = hoverIndex !== null ? series[hoverIndex] : null;

  return (
    <svg
      width={width}
      height={height}
      style={{ touchAction: "none" }}
      onMouseLeave={clearHover}
      onMouseMove={(e) => pickNearest(e.clientX, e.currentTarget)}
      onTouchStart={(e) => {
        if (e.touches[0]) pickNearest(e.touches[0].clientX, e.currentTarget);
      }}
      onTouchMove={(e) => {
        if (e.touches[0]) pickNearest(e.touches[0].clientX, e.currentTarget);
      }}
      onTouchEnd={clearHover}
      onTouchCancel={clearHover}
    >
      <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
        <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke={CHART_GUIDE} />
        {areaPath ? <path d={areaPath} fill={color} opacity={0.15} /> : null}
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} />
        {hoverPoint && yScale ? (
          <>
            <line
              x1={xScale(new Date(hoverPoint.date * 1000))!}
              x2={xScale(new Date(hoverPoint.date * 1000))!}
              y1={0}
              y2={innerHeight}
              stroke={CHART_GUIDE}
              strokeDasharray="4 4"
            />
            <circle
              cx={xScale(new Date(hoverPoint.date * 1000))!}
              cy={yScale(hoverPoint.value)!}
              r={4}
              fill={color}
            />
          </>
        ) : null}
      </g>
    </svg>
  );
}
