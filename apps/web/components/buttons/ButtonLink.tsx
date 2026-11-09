import { AnchorHTMLAttributes } from "react";

import {
  ButtonColor,
  ButtonSize,
  ButtonStyleProps,
  ButtonVariant,
  getButtonClassName,
} from "./Button";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & ButtonStyleProps;

export default function ButtonLink({
  variant = ButtonVariant.CONTAINED,
  size = ButtonSize.LARGE,
  mobileSize,
  tabletSize,
  fullWidth,
  colorScheme = ButtonColor.GREEN,
  isLoading,
  className,
  children,
  ...props
}: Props) {
  return (
    <a
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
      aria-disabled={isLoading || undefined}
      {...props}
    >
      {children}
    </a>
  );
}
