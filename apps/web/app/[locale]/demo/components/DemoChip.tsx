import { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

import { clsxMerge } from "@/functions/clsxMerge";

export type DemoChipTone =
  | "neutral"
  | "surface"
  | "muted"
  | "success"
  | "purple"
  | "erc20"
  | "solid-success"
  | "solid-purple";

export type DemoChipSize = "small" | "medium";

type ChipStyleProps = {
  tone?: DemoChipTone;
  size?: DemoChipSize;
  leading?: ReactNode;
};

const toneClassNames: Record<DemoChipTone, string> = {
  neutral: "border-secondary-border bg-transparent text-secondary-text",
  surface: "border-transparent bg-primary-bg text-primary-text",
  muted: "border-transparent bg-tertiary-bg text-secondary-text",
  success: "border-green/30 bg-green-bg text-green",
  purple: "border-purple/30 bg-purple-bg text-purple",
  erc20: "border-transparent bg-erc-20-bg text-erc-20-text",
  "solid-success": "border-transparent bg-green text-black",
  "solid-purple": "border-transparent bg-purple text-black",
};

const sizeClassNames: Record<DemoChipSize, string> = {
  small: "min-h-6 px-2 py-0.5 text-12",
  medium: "min-h-8 px-3 py-1 text-14",
};

const interactiveToneClassNames: Record<DemoChipTone, string> = {
  neutral: "hocus:border-primary-text hocus:text-primary-text",
  surface: "hocus:border-secondary-border hocus:bg-tertiary-bg",
  muted: "hocus:bg-primary-bg hocus:text-primary-text",
  success: "hocus:border-green hocus:bg-green-bg-hover hocus:text-primary-text",
  purple: "hocus:border-purple hocus:bg-purple-bg-hover hocus:text-primary-text",
  erc20: "hocus:border-erc-20-text",
  "solid-success": "hocus:bg-green-hover",
  "solid-purple": "hocus:bg-purple-hover",
};

function chipClassName({
  tone = "neutral",
  size = "small",
  interactive = false,
  className,
}: ChipStyleProps & { interactive?: boolean; className?: string }) {
  return clsxMerge(
    // rounded-full is 50% in this project's theme, which makes wide labels elliptical.
    // Match the fixed-radius badges and input buttons used by margin-swap.
    "inline-flex max-w-full shrink-0 items-center justify-center gap-1.5 rounded-5 border font-medium whitespace-nowrap",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-200",
    toneClassNames[tone],
    sizeClassNames[size],
    interactive &&
      "cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2 focus-visible:ring-offset-primary-bg disabled:pointer-events-none disabled:opacity-50",
    interactive && interactiveToneClassNames[tone],
    className,
  );
}

export function DemoChip({
  tone = "neutral",
  size = "small",
  leading,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & ChipStyleProps) {
  return (
    <span className={chipClassName({ tone, size, className })} {...props}>
      {leading}
      {children}
    </span>
  );
}

export function DemoChipButton({
  tone = "neutral",
  size = "small",
  leading,
  children,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & ChipStyleProps) {
  return (
    <button
      type={type}
      className={chipClassName({ tone, size, interactive: true, className })}
      {...props}
    >
      {leading}
      {children}
    </button>
  );
}
