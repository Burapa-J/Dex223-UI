import { useId, useMemo } from "react";

/** A 7-day price line, green when the week closed higher and red when lower. */
export default function Sparkline({
  points,
  width = 136,
  height = 40,
}: {
  points: number[] | null | undefined;
  width?: number;
  height?: number;
}) {
  const gradientId = useId().replace(/:/g, "");
  const shape = useMemo(() => {
    const values = (points ?? []).filter((p) => Number.isFinite(p));
    if (values.length < 2) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const pad = 2;
    const coords = values.map((v, i) => [
      (i / (values.length - 1)) * width,
      pad + (1 - (v - min) / span) * (height - pad * 2),
    ]);
    const line = coords
      .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`)
      .join("");
    return {
      line,
      area: `${line}L${width},${height}L0,${height}Z`,
      up: values[values.length - 1] >= values[0],
    };
  }, [points, width, height]);

  if (!shape) return <div style={{ width, height }} />;
  const color = shape.up ? "#70C59E" : "#D24B4B";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={shape.area} fill={`url(#${gradientId})`} />
      <path d={shape.line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
