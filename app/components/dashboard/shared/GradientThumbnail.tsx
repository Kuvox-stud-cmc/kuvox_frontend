import type { ReactNode } from "react";

import { CARD_GRADIENTS } from "~/components/dashboard/constants/dashboard.constants";

interface GradientThumbnailProps {
  index?: number;
  icon?: string;
  iconClassName?: string;
  className?: string;
  children?: ReactNode;
}

export function GradientThumbnail({
  index = 0,
  icon = "image",
  iconClassName = "text-[40px] text-on-surface-variant/20",
  className = "",
  children,
}: GradientThumbnailProps) {
  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${CARD_GRADIENTS[index % CARD_GRADIENTS.length]} ${className}`}
    >
      {children ?? (
        <span className={`material-symbols-outlined ${iconClassName}`}>{icon}</span>
      )}
    </div>
  );
}
