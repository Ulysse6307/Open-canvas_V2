import { v4 as uuidv4 } from "uuid";
import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../../state.js";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { optionallyUpdateArtifactMeta } from "./update-meta.js";
import {
  buildPrompt,
  createNewArtifactContent,
  validateState,
} from "./utils.js";
import {
  createContextDocumentMessages,
  getFormattedReflections,
  getModelConfig,
  getModelFromConfig,
  isUsingO1MiniModel,
  optionallyGetSystemPromptFromConfig,
} from "../../../utils.js";
import { isArtifactMarkdownContent } from "@opencanvas/shared/utils/artifacts";
import { AIMessage } from "@langchain/core/messages";
import {
  extractThinkingAndResponseTokens,
  isThinkingModel,
} from "@opencanvas/shared/utils/thinking";

import { REWRITE_OR_GENERATE_ARTIFACT_FROM_WEB_PROMPT } from "../../prompts.js";

export const rewriteArtifact = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  const { modelName } = getModelConfig(config);

  console.log("MODELLLLLE CONFIIIIIIG",getModelConfig(config));

const baseModel = await getModelFromConfig(config);
const modelWithTools = baseModel.bindTools([{ type: "web_search_preview" }]);
const LLMconfig = modelWithTools.withConfig({ runName: "rewrite_artifact_model_call" });

    

  //const smallModelWithConfig = (await getModelFromConfig(config)).withConfig({
    //runName: "rewrite_artifact_model_call",
  //});

  const memoriesAsString = await getFormattedReflections(config);
  const { currentArtifactContent, recentHumanMessage } = validateState(state);

  const artifactMetaToolCall = await optionallyUpdateArtifactMeta(
    state,
    config
  );
  const artifactType = artifactMetaToolCall.type;
  const isNewType = artifactType !== currentArtifactContent.type;

  const artifactContent = isArtifactMarkdownContent(currentArtifactContent)
    ? currentArtifactContent.fullMarkdown
    : currentArtifactContent.code;
  


  const formattedPrompt = buildPrompt({
    artifactContent,
    memoriesAsString,
    isNewType,
    artifactMetaToolCall,
  });

  const userSystemPrompt = optionallyGetSystemPromptFromConfig(config);
  const fullSystemPrompt = userSystemPrompt
    ? `${userSystemPrompt}\n${formattedPrompt}`
    : formattedPrompt;

  const contextDocumentMessages = await createContextDocumentMessages(config);
  const isO1MiniModel = isUsingO1MiniModel(config);
  let newArtifactResponse;
    console.log("CE QUE PREND L4ARTIFCAT EN ENTREE", ...contextDocumentMessages,...state._messages);

  if (state.webSearchRewriteArtifact) {
    newArtifactResponse = await LLMconfig.invoke([
    { role: isO1MiniModel ? "user" : "system", content: REWRITE_OR_GENERATE_ARTIFACT_FROM_WEB_PROMPT },
    ...contextDocumentMessages,
    ...state._messages,
  ]);
  }
  else{
    newArtifactResponse = await LLMconfig.invoke([
    { role: isO1MiniModel ? "user" : "system", content: fullSystemPrompt },
    ...contextDocumentMessages,
    recentHumanMessage,
  ]);
  }
  

  console.log("EST CE QUE WEBSEARCH ENABLE", state.webSearchEnabled);
  console.log("STATE WEBSEARCH REWRITE ARTIFACT AVANT RESET", state.webSearchRewriteArtifact);
 


  let thinkingMessage: AIMessage | undefined;
  let artifactContentText = newArtifactResponse.content as string;

  if (isThinkingModel(modelName)) {
    const { thinking, response } =
      extractThinkingAndResponseTokens(artifactContentText);
    thinkingMessage = new AIMessage({
      id: `thinking-${uuidv4()}`,
      content: thinking,
    });
    artifactContentText = response;
  }

  const newArtifactContent = createNewArtifactContent({
    artifactType,
    state,
    currentArtifactContent,
    artifactMetaToolCall,
    newContent: artifactContentText as string,
  });

  state.webSearchRewriteArtifact = false; // Reset the flag after use
  console.log("STATE WEBSEARCH REWRITE ARTIFACT APRES RESET", state.webSearchRewriteArtifact);

  return {
    artifact: {
      ...state.artifact,
      currentIndex: state.artifact.contents.length + 1,
      contents: [...state.artifact.contents, newArtifactContent],
    },
    messages: [...(thinkingMessage ? [thinkingMessage] : [])],
    _messages: [...(thinkingMessage ? [thinkingMessage] : [])],
  };
};
