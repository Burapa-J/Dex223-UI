import Tooltip from "@repo/ui/tooltip";
import React, { ReactNode } from "react";

export default function LendingOrderDetailsRow({
  title,
  value,
  tooltipText,
}: {
  title: string;
  value: string | ReactNode;
  tooltipText?: string;
}) {
  return (
    <div className="flex flex-col gap-1 xs:flex-row xs:justify-between xs:gap-3 min-w-0">
      <div className="flex gap-1 pt-0.5 text-14 text-secondary-text min-w-0">
        {tooltipText && <Tooltip iconSize={20} text={tooltipText} />}
        {title}
      </div>
      <div className="min-w-0 break-words xs:text-right">{value}</div>
    </div>
  );
}
