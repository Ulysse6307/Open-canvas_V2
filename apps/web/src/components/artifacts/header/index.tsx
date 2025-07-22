import { ReflectionsDialog } from "../../reflections-dialog/ReflectionsDialog";
import { ArtifactTitle } from "./artifact-title";
import { NavigateArtifactHistory } from "./navigate-artifact-history";
import { ArtifactCodeV3, ArtifactMarkdownV3 } from "@opencanvas/shared/types";
import { Assistant } from "@langchain/langgraph-sdk";
import { PanelRightClose, Upload} from "lucide-react";
import { TooltipIconButton } from "@/components/ui/assistant-ui/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { exportArtifact } from "./Artifact_Export";


interface ArtifactHeaderProps {
  isBackwardsDisabled: boolean;
  isForwardDisabled: boolean;
  setSelectedArtifact: (index: number) => void;
  currentArtifactContent: ArtifactCodeV3 | ArtifactMarkdownV3;
  isArtifactSaved: boolean;
  totalArtifactVersions: number;
  selectedAssistant: Assistant | undefined;
  artifactUpdateFailed: boolean;
  chatCollapsed: boolean;
  setChatCollapsed: (c: boolean) => void;
}

export function ArtifactHeader(props: ArtifactHeaderProps) {

  // Function that handles the export button click
  const handleExport = async () => {
    try {
      await exportArtifact(
        props.currentArtifactContent,
        props.currentArtifactContent.title
      );
      
      // Show success message (you can add toast here if available)
      console.log(`${props.currentArtifactContent.title} exported successfully`);
    } catch (err) {
      console.error("Export failed:", err);
      // Show error message (you can add toast here if available)
      alert(err instanceof Error ? err.message : "Export failed with unknown error");
    }
  };

  return (
    <div className="flex flex-row items-center justify-between">
      <div className="flex flex-row items-center justify-center gap-2">
        {props.chatCollapsed && (
          <TooltipIconButton
            tooltip="Expand Chat"
            variant="ghost"
            className="ml-2 mb-1 w-8 h-8 hover:bg-transparent"
            delayDuration={400}
            onClick={() => props.setChatCollapsed(false)}
          >
            <PanelRightClose className="text-tamar-gray hover:text-tamar-violet transition-colors duration-200" />
          </TooltipIconButton>
        )}
        <ArtifactTitle
          title={props.currentArtifactContent.title}
          isArtifactSaved={props.isArtifactSaved}
          artifactUpdateFailed={props.artifactUpdateFailed}
        />
        
      </div>
      <div className="flex gap-2 items-end mt-[10px] mr-[6px]">
        <Button variant="ghost" className="bg-white border-0 shadow-none rounded-lg p-0 h-10 w-10 flex items-center justify-center cursor-pointer transition-none hover:bg-white focus:bg-white active:bg-white" style={{ transition: "none" }}
        onClick={handleExport}>
            <Upload stroke="currentColor"className="text-tamar-gray hover:text-tamar-violet transition-colors duration-200 h-5 w-5"/>
        </Button>
        <NavigateArtifactHistory
          isBackwardsDisabled={props.isBackwardsDisabled}
          isForwardDisabled={props.isForwardDisabled}
          setSelectedArtifact={props.setSelectedArtifact}
          currentArtifactIndex={props.currentArtifactContent.index}
          totalArtifactVersions={props.totalArtifactVersions}
        />
        <ReflectionsDialog selectedAssistant={props.selectedAssistant} />
      </div>
    </div>
  );
}
