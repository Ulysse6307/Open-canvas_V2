import { TooltipIconButton } from "@/components/ui/assistant-ui/tooltip-icon-button";
import { Forward } from "lucide-react";

interface NavigateArtifactHistoryProps {
  isBackwardsDisabled: boolean;
  isForwardDisabled: boolean;
  setSelectedArtifact: (prevState: number) => void;
  currentArtifactIndex: number;
  totalArtifactVersions: number;
}

export function NavigateArtifactHistory(props: NavigateArtifactHistoryProps) {
  const prevTooltip = `Previous (${Math.max(1, props.currentArtifactIndex - 1)}/${props.totalArtifactVersions})`;
  const nextTooltip = `Next (${Math.min(props.totalArtifactVersions, props.currentArtifactIndex + 1)}/${props.totalArtifactVersions})`;

  return (
    <div className="flex items-center justify-center gap-1">
      <TooltipIconButton
        tooltip={prevTooltip}
        side="left"
        variant="ghost"
        delayDuration={400}
        onClick={() => {
          if (!props.isBackwardsDisabled) {
            props.setSelectedArtifact(props.currentArtifactIndex - 1);
          }
        }}
        disabled={props.isBackwardsDisabled}
        className="w-fit h-fit p-2 hover:bg-transparent"
      >
        <Forward
          aria-disabled={props.isBackwardsDisabled}
          className="w-6 h-6 text-tamar-gray hover:text-tamar-violet transition-colors duration-200 scale-x-[-1]"
        />
      </TooltipIconButton>
      <TooltipIconButton
        tooltip={nextTooltip}
        variant="ghost"
        side="right"
        delayDuration={400}
        onClick={() => {
          if (!props.isForwardDisabled) {
            props.setSelectedArtifact(props.currentArtifactIndex + 1);
          }
        }}
        disabled={props.isForwardDisabled}
        className="w-fit h-fit p-2 hover:bg-transparent"
      >
        <Forward
          aria-disabled={props.isForwardDisabled}
          className="w-6 h-6 text-tamar-gray hover:text-tamar-violet transition-colors duration-200"
        />
      </TooltipIconButton>
    </div>
  );
}
