import { ButtonHTMLAttributes } from "react";

import Svg from "@/components/atoms/Svg";
import { IconName } from "@/config/types/IconName";
import { clsxMerge } from "@/functions/clsxMerge";

export const enum ButtonVariant {
  CONTAINED = "contained",
  OUTLINED = "outlined",
}

export const enum ButtonSize {
  EXTRA_SMALL = 20,
  SMALL = 32,
  MEDIUM = 40,
  LARGE = 48,
  EXTRA_LARGE = 60,
}

export const enum ButtonColor {
  GREEN,
  RED,
  LIGHT_GREEN,
  LIGHT_RED,
  LIGHT_YELLOW,
  PURPLE,
  LIGHT_PURPLE,
}

export type ButtonStyleProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  colorScheme?: ButtonColor;
  mobileSize?: ButtonSize;
  tabletSize?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonStyleProps &
  (
    | {
        endIcon?: IconName;
        startIcon?: never;
      }
    | { startIcon?: IconName; endIcon?: never }
  );

const buttonVariantClassnameMap: Record<ButtonVariant, Record<ButtonColor, string>> = {
  [ButtonVariant.CONTAINED]: {
    [ButtonColor.RED]: "bg-red text-primary-text hocus:bg-red-hover",
    [ButtonColor.GREEN]:
      "bg-green text-black hocus:bg-green-hover shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] hocus:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_10px_30px_-12px_rgba(165,231,197,0.6)]",
    [ButtonColor.LIGHT_RED]:
      "bg-red-bg text-secondary-text border-transparent border hocus:border-red-light hocus:bg-red-bg-hover hocus:text-primary-text",
    [ButtonColor.LIGHT_YELLOW]:
      "bg-yellow-bg text-secondary-text border-transparent border hocus:border-yellow-light hocus:bg-yellow-bg-hover hocus:text-primary-text",
    [ButtonColor.LIGHT_GREEN]:
      "bg-green-bg text-secondary-text border-transparent border hocus:border-green hocus:bg-green-bg-hover hocus:text-primary-text",
    [ButtonColor.LIGHT_PURPLE]:
      "bg-purple-bg text-secondary-text border-transparent border hocus:border-purple-hover hocus:bg-purple-bg-hover hocus:text-primary-text",
    [ButtonColor.PURPLE]:
      "bg-purple text-secondary-bg hocus:bg-purple-hover shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] hocus:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_10px_30px_-12px_rgba(165,174,231,0.6)]",
  },
  [ButtonVariant.OUTLINED]: {
    [ButtonColor.RED]:
      "border border-primary-border text-secondary-text hocus:bg-red-bg hocus:border-primary-text hocus:text-primary-text",
    [ButtonColor.GREEN]: "border border-green text-primary-text hocus:bg-green-bg",
    [ButtonColor.LIGHT_RED]: "bg-red-light text-black hocus:bg-red-hover",
    [ButtonColor.LIGHT_YELLOW]: "bg-yellow-light text-black hocus:bg-red-hover",
    [ButtonColor.LIGHT_GREEN]:
      "bg-green-bg text-primary-text border-transparent border hocus:border-green",
    [ButtonColor.PURPLE]: "border border-purple text-primary-text hocus:bg-purple-bg",
    [ButtonColor.LIGHT_PURPLE]:
      "bg-purple-bg text-primary-text border-transparent border hocus:border-purple",
  },
};

const buttonSizeClassnameMap: Record<ButtonSize, string> = {
  [ButtonSize.EXTRA_SMALL]: "lg:text-12 lg:min-h-5 lg:rounded-20 lg:px-4",
  [ButtonSize.SMALL]: "lg:text-14 lg:font-medium lg:min-h-8 lg:rounded-20 lg:px-6",
  [ButtonSize.MEDIUM]: "lg:text-16 lg:font-medium lg:min-h-10 lg:rounded-2 lg:px-6",
  [ButtonSize.LARGE]: "lg:text-16 lg:font-medium lg:min-h-12 lg:rounded-3 lg:px-6",
  [ButtonSize.EXTRA_LARGE]: "lg:text-18 lg:font-medium lg:min-h-[60px] lg:rounded-3 lg:px-6",
};

const tabletButtonSizeClassnameMap: Record<ButtonSize, string> = {
  [ButtonSize.EXTRA_SMALL]: "sm:text-12 sm:min-h-5 sm:rounded-20 sm:px-4",
  [ButtonSize.SMALL]: "sm:text-14 sm:font-medium sm:min-h-8 sm:rounded-20 sm:px-6",
  [ButtonSize.MEDIUM]: "sm:text-16 sm:font-medium sm:rounded-2 sm:min-h-10 sm:px-6",
  [ButtonSize.LARGE]: "sm:text-16 sm:font-medium sm:rounded-3 sm:min-h-12 sm:px-6",
  [ButtonSize.EXTRA_LARGE]: "sm:text-18 sm:font-medium sm:rounded-3 sm:min-h-[60px] sm:px-6",
};

const mobileButtonSizeClassnameMap: Record<ButtonSize, string> = {
  [ButtonSize.EXTRA_SMALL]: "text-12 min-h-5 rounded-20 px-4",
  [ButtonSize.SMALL]: "text-14 font-medium rounded-2 min-h-8 px-6",
  [ButtonSize.MEDIUM]: "text-16 font-medium rounded-2 min-h-10 px-6",
  [ButtonSize.LARGE]: "text-16 font-medium rounded-3 min-h-12 px-6",
  [ButtonSize.EXTRA_LARGE]: "text-18 font-medium rounded-3 min-h-[60px] px-6",
};

const disabledClassnameMap: Record<ButtonVariant, string> = {
  [ButtonVariant.CONTAINED]: "disabled:bg-tertiary-bg disabled:text-secondary-text",
  [ButtonVariant.OUTLINED]: "disabled:text-secondary-text disabled:border-secondary-border",
};

export function getButtonClassName({
  variant = ButtonVariant.CONTAINED,
  size = ButtonSize.LARGE,
  mobileSize,
  tabletSize,
  fullWidth,
  colorScheme = ButtonColor.GREEN,
  isLoading,
  className,
}: ButtonStyleProps & { className?: string }) {
  const resolvedMobileSize = mobileSize || size;
  const resolvedTabletSize = tabletSize || size;

  return clsxMerge(
    "flex items-center justify-center gap-2 transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.98] disabled:pointer-events-none",
    buttonVariantClassnameMap[variant][colorScheme],
    buttonSizeClassnameMap[size],
    tabletButtonSizeClassnameMap[resolvedTabletSize],
    mobileButtonSizeClassnameMap[resolvedMobileSize],
    fullWidth && "w-full",
    disabledClassnameMap[variant],
    isLoading && "opacity-50 pointer-events-none",
    className,
  );
}

export default function Button({
  variant = ButtonVariant.CONTAINED,
  size = ButtonSize.LARGE,
  mobileSize,
  tabletSize,
  startIcon,
  endIcon,
  fullWidth,
  colorScheme = ButtonColor.GREEN,
  children,
  className,
  isLoading,
  ...props
}: Props) {
  return (
    <button
      className={getButtonClassName({
        variant,
        size,
        mobileSize,
        tabletSize,
        fullWidth,
        colorScheme,
        isLoading,
        className,
      })}
      {...props}
    >
      {startIcon && <Svg iconName={startIcon} />}
      {children}
      {endIcon && <Svg iconName={endIcon} />}
    </button>
  );
}
