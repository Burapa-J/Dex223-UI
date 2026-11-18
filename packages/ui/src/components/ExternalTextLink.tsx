import { AnchorHTMLAttributes } from "react";
import { clsxMerge } from "../functions/clsxMerge";
import ForwardIcon from "../icons/ForwardIcon";

interface Props extends AnchorHTMLAttributes<HTMLAnchorElement> {
  text: string;
  href: string;
  arrowSize?: number;
  color?: "green" | "white";
  textClassname?: string;
  openInNewTab?: boolean;
}

export default function ExternalTextLink({
  text,
  href,
  color = "green",
  className,
  arrowSize = 24,
  textClassname,
  openInNewTab = true,
  ...props
}: Props) {
  return (
    <a
      {...props}
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noopener noreferrer" : undefined}
      href={href}
      className={clsxMerge(
        "ui-flex ui-items-center ui-duration-200",
        color === "green"
          ? "ui-text-green hocus:ui-text-green-hover"
          : "ui-text-white hocus:ui-text-green",
        className,
      )}
    >
      <span className={textClassname}>{text}</span>
      <ForwardIcon className="ui-flex-shrink-0" size={arrowSize} />
    </a>
  );
}
