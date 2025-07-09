import * as Icons from "lucide-react";
import { LucideIcon } from "lucide-react";
import React from "react";

export const getIcon = (
  iconName?: string,
  color?: string
): React.ReactNode => {
  const finalColor = color || "#6B46C1";
  if (!iconName) {
    return (
      <Icons.User
        className="size-full lucide-user"
        stroke={finalColor}
        style={{ stroke: finalColor, color: finalColor }}
      />
    );
  }
  const Icon = Icons[iconName as keyof typeof Icons] as LucideIcon;
  if (Icon) {
    return (
      <Icon
        className="size-full lucide-user"
        stroke={finalColor}
        style={{ stroke: finalColor, color: finalColor }}
      />
    );
  }
  return (
    <Icons.User
      className="size-full lucide-user"
      stroke={finalColor}
      style={{ stroke: finalColor, color: finalColor }}
    />
  );
};
