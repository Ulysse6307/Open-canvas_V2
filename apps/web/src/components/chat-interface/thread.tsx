import { useGraphContext } from "@/contexts/GraphContext";
import { useToast } from "@/hooks/use-toast";
import { ProgrammingLanguageOptions } from "@opencanvas/shared/types";
import { ThreadPrimitive } from "@assistant-ui/react";
import { Thread as ThreadType } from "@langchain/langgraph-sdk";
import { ArrowDownIcon, PanelRightOpen, SquarePen } from "lucide-react";
import { Dispatch, FC, SetStateAction } from "react";
import { ReflectionsDialog } from "../reflections-dialog/ReflectionsDialog";
import { useLangSmithLinkToolUI } from "../tool-hooks/LangSmithLinkToolUI";
import { TooltipIconButton } from "../ui/assistant-ui/tooltip-icon-button";
import { TighterText } from "../ui/header";
import { Composer } from "./composer";
import { AssistantMessage, UserMessage } from "./messages";
import ModelSelector from "./model-selector";
import { ThreadHistory } from "./thread-history";
import { ThreadWelcome } from "./welcome";
import { useUserContext } from "@/contexts/UserContext";
import { useThreadContext } from "@/contexts/ThreadProvider";
import { useAssistantContext } from "@/contexts/AssistantContext";

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="ghost"
        className="absolute -top-8 rounded-full disabled:invisible"
      >
        <ArrowDownIcon className="text-tamar-violet hover:text-tamar-violet-dark transition-colors duration-200" />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

export interface ThreadProps {
  userId: string | undefined;
  hasChatStarted: boolean;
  handleQuickStart: (
    type: "text" | "code",
    language?: ProgrammingLanguageOptions
  ) => void;
  handleFileImport?: (file: File) => void;
  setChatStarted: Dispatch<SetStateAction<boolean>>;
  switchSelectedThreadCallback: (thread: ThreadType) => void;
  searchEnabled: boolean;
  setChatCollapsed: (c: boolean) => void;
}

export const Thread: FC<ThreadProps> = (props: ThreadProps) => {
  const {
    setChatStarted,
    hasChatStarted,
    handleQuickStart,
    handleFileImport,
    switchSelectedThreadCallback,
  } = props;
  const { toast } = useToast();
  const {
    graphData: { clearState, runId, feedbackSubmitted, setFeedbackSubmitted },
  } = useGraphContext();
  const { selectedAssistant } = useAssistantContext();
  const {
    modelName,
    setModelName,
    modelConfig,
    setModelConfig,
    modelConfigs,
    setThreadId,
  } = useThreadContext();
  const { user } = useUserContext();

  // Render the LangSmith trace link
  useLangSmithLinkToolUI();

  const handleNewSession = async () => {
    if (!user) {
      toast({
        title: "User not found",
        description: "Failed to create thread without user",
        duration: 5000,
        variant: "destructive",
      });
      return;
    }

    setThreadId(null);
    setModelName(modelName);
    setModelConfig(modelName, modelConfig);
    clearState();
    setChatStarted(false);
  };

  return (
    <ThreadPrimitive.Root className="flex flex-col h-full w-full bg-white">
      {/* Header premium */}
      <div className="pr-4 pl-6 pt-4 pb-3 flex flex-row gap-4 items-center justify-between border-b border-tamar-gray/10 bg-white">
        <div className="flex items-center justify-start gap-3">
          <ThreadHistory
            switchSelectedThreadCallback={switchSelectedThreadCallback}
          />
          <TighterText className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-tamar-violet to-[#A259FF]">
            Tamar.ai
          </TighterText>
          {!hasChatStarted && (
            <ModelSelector
              modelName={modelName}
              setModelName={setModelName}
              modelConfig={modelConfig}
              setModelConfig={setModelConfig}
              modelConfigs={modelConfigs}
            />
          )}
        </div>
        {hasChatStarted ? (
          <div className="flex flex-row flex-1 gap-2 items-center justify-end">
            <TooltipIconButton
              tooltip="Collapse Chat"
              variant="ghost"
              className="w-8 h-8 hover:bg-transparent"
              delayDuration={400}
              onClick={() => props.setChatCollapsed(true)}
            >
              <PanelRightOpen className="text-tamar-gray hover:text-tamar-violet transition-colors duration-200" />
            </TooltipIconButton>
            <TooltipIconButton
              tooltip="New chat"
              variant="ghost"
              className="w-8 h-8 hover:bg-transparent"
              delayDuration={400}
              onClick={handleNewSession}
            >
              <SquarePen className="text-tamar-gray hover:text-tamar-violet transition-colors duration-200" />
            </TooltipIconButton>
          </div>
        ) : (
          <div className="flex flex-row gap-2 items-center">
            <ReflectionsDialog selectedAssistant={selectedAssistant} />
          </div>
        )}
      </div>
      {/* Messages area */}
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto scroll-smooth bg-white px-6 pt-8">
        {!hasChatStarted && (
          <ThreadWelcome
            handleQuickStart={handleQuickStart}
            handleFileImport={handleFileImport || (() => {})}
            composer={
              <Composer
                chatStarted={false}
                userId={props.userId}
                searchEnabled={props.searchEnabled}
              />
            }
            searchEnabled={props.searchEnabled}
          />
        )}
        <ThreadPrimitive.Messages
          components={{
            UserMessage: UserMessage,
            AssistantMessage: (prop) => (
              <AssistantMessage
                {...prop}
                feedbackSubmitted={feedbackSubmitted}
                setFeedbackSubmitted={setFeedbackSubmitted}
                runId={runId}
              />
            ),
          }}
        />
      </ThreadPrimitive.Viewport>
      {/* Input area */}
      <div className="mt-4 flex w-full flex-col items-center justify-end rounded-t-lg bg-white border-t border-tamar-gray/10 pb-4 px-4">
        <ThreadScrollToBottom />
        <div className="w-full max-w-2xl">
          {hasChatStarted && (
            <div className="flex flex-col space-y-2">
              <ModelSelector
                modelName={modelName}
                setModelName={setModelName}
                modelConfig={modelConfig}
                setModelConfig={setModelConfig}
                modelConfigs={modelConfigs}
                
              />
              <Composer
                chatStarted={true}
                userId={props.userId}
                searchEnabled={props.searchEnabled}
              />
            </div>
          )}
        </div>
      </div>
    </ThreadPrimitive.Root>
  );
};

export default Thread;
