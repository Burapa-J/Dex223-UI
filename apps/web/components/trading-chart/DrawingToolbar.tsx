"use client";

import clsx from "clsx";
import { useTranslations } from "next-intl";

import { DrawingTool } from "./drawings/primitive";
import { AccentClasses } from "./theme";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICONS: Record<DrawingTool | "magnet" | "trash" | "clear", React.ReactNode> = {
  alert: (
    <>
      <path {...stroke} d="M6 8.5a4 4 0 018 0v3l1.5 2h-11L6 11.5z" />
      <path {...stroke} d="M8.5 15.5a1.6 1.6 0 003 0" />
    </>
  ),
  cursor: <path {...stroke} d="M5 3l11 6.5-4.8 1.3L9 15.5z" />,
  trend: (
    <>
      <path {...stroke} d="M4 15L16 5" />
      <circle cx="4" cy="15" r="1.8" fill="currentColor" />
      <circle cx="16" cy="5" r="1.8" fill="currentColor" />
    </>
  ),
  hline: (
    <>
      <path {...stroke} d="M2.5 10h15" />
      <circle cx="10" cy="10" r="1.8" fill="currentColor" />
    </>
  ),
  vline: (
    <>
      <path {...stroke} d="M10 2.5v15" />
      <circle cx="10" cy="10" r="1.8" fill="currentColor" />
    </>
  ),
  rect: <rect {...stroke} x="3.5" y="5" width="13" height="10" rx="1" />,
  fib: <path {...stroke} d="M3 4.5h14M3 8h14M3 11h14M3 15.5h14" />,
  measure: (
    <>
      <path {...stroke} d="M3 16L16 3" strokeDasharray="2 2" />
      <path {...stroke} d="M3 11v5h5M16 8V3h-5" />
    </>
  ),
  magnet: <path {...stroke} d="M5 4v6a5 5 0 0010 0V4M5 4h3v6a2 2 0 004 0V4h3M5 7h3M12 7h3" />,
  trash: <path {...stroke} d="M4.5 6h11M8 6V4h4v2M6 6l.8 10h6.4L14 6" />,
  clear: (
    <>
      <path {...stroke} d="M4 15L16 5" opacity="0.5" />
      <path {...stroke} d="M4 5l12 10" />
    </>
  ),
};

const TOOLS: DrawingTool[] = [
  "cursor",
  "trend",
  "hline",
  "vline",
  "rect",
  "fib",
  "measure",
  "alert",
];

export default function DrawingToolbar({
  tool,
  onTool,
  magnet,
  onMagnet,
  hasSelection,
  onDeleteSelected,
  drawingCount,
  onClearAll,
  accent,
  alerts = true,
}: {
  tool: DrawingTool;
  onTool: (tool: DrawingTool) => void;
  magnet: boolean;
  onMagnet: (on: boolean) => void;
  hasSelection: boolean;
  onDeleteSelected: () => void;
  drawingCount: number;
  onClearAll: () => void;
  accent: AccentClasses;
  alerts?: boolean;
}) {
  const t = useTranslations("TradingChart");
  const tools = alerts ? TOOLS : TOOLS.filter((key) => key !== "alert");
  return (
    <div
      role="toolbar"
      aria-label={t("drawing_tools")}
      aria-orientation="vertical"
      className="flex flex-col items-center gap-0.5 py-2 w-10 shrink-0 border-r border-secondary-border bg-primary-bg no-scrollbar max-sm:overflow-y-auto"
    >
      {tools.map((key) => (
        <Button
          key={key}
          accent={accent}
          label={`${t(`tool_${key}`)}`}
          active={tool === key}
          onClick={() => onTool(tool === key && key !== "cursor" ? "cursor" : key)}
        >
          {ICONS[key]}
        </Button>
      ))}
      <span className="w-5 h-px bg-secondary-border my-1.5" aria-hidden />
      <Button
        accent={accent}
        label={t("tool_magnet")}
        active={magnet}
        onClick={() => onMagnet(!magnet)}
      >
        {ICONS.magnet}
      </Button>
      <Button
        accent={accent}
        label={t("tool_delete")}
        disabled={!hasSelection}
        onClick={onDeleteSelected}
      >
        {ICONS.trash}
      </Button>
      <Button accent={accent} label={t("tool_clear")} disabled={!drawingCount} onClick={onClearAll}>
        {ICONS.clear}
      </Button>
    </div>
  );
}

function Button({
  label,
  active,
  disabled,
  onClick,
  accent,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  accent: AccentClasses;
  children: React.ReactNode;
}) {
  return (
    <span className="relative group/tool">
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
        className={clsx(
          "w-8 h-8 inline-flex items-center justify-center rounded-2 duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-border",
          active
            ? accent.soft
            : "text-tertiary-text hocus:text-primary-text hocus:bg-tertiary-bg disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-tertiary-text",
        )}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
          {children}
        </svg>
      </button>
      {/* A styled tooltip to the right, instead of the browser's delayed native one. */}
      <span
        role="presentation"
        className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-30 whitespace-nowrap rounded-2 bg-quaternary-bg border border-secondary-border px-2 py-1 text-12 text-primary-text shadow-popover shadow-black/50 opacity-0 translate-x-[-4px] group-hover/tool:opacity-100 group-hover/tool:translate-x-0 duration-150"
      >
        {label}
      </span>
    </span>
  );
}
