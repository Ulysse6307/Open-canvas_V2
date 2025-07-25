import {
  createContextDocumentMessages,
  getFormattedReflections,
  getModelConfig,
  getModelFromConfig,
  isUsingO1MiniModel,
  optionallyGetSystemPromptFromConfig,
} from "../../../utils.js";
import { ArtifactV3 } from "@opencanvas/shared/types";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../../state.js";
import { ARTIFACT_TOOL_SCHEMA } from "./schemas.js";
import { createArtifactContent, formatNewArtifactPrompt } from "./utils.js";
import { z } from "zod";
import { REWRITE_OR_GENERATE_ARTIFACT_FROM_WEB_PROMPT } from "../../prompts.js";


/**
 * Generate a new artifact based on the user's query.
 */
export const generateArtifact = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  
  console.log("OOOOOOOOKKKKKKKKK")
  const { modelName } = getModelConfig(config, {
    isToolCalling: true,
  });
  const smallModel = await getModelFromConfig(config, {
    temperature: 0.5,
    isToolCalling: true,
  });

  const modelWithArtifactTool = smallModel.bindTools(
    [
      {
        name: "generate_artifact",
        description: ARTIFACT_TOOL_SCHEMA.description,
        schema: ARTIFACT_TOOL_SCHEMA,
      },
    ],
    {
      tool_choice: "generate_artifact",
    }
  );

  const memoriesAsString = await getFormattedReflections(config);
  const formattedNewArtifactPrompt = formatNewArtifactPrompt(
    memoriesAsString,
    modelName
  );

  const userSystemPrompt = optionallyGetSystemPromptFromConfig(config);
  const fullSystemPrompt = userSystemPrompt
    ? `${userSystemPrompt}\n${formattedNewArtifactPrompt}`
    : formattedNewArtifactPrompt;

  const contextDocumentMessages = await createContextDocumentMessages(config);
  const isO1MiniModel = isUsingO1MiniModel(config);

  let response;

  console.log("State webSearchGENERATEArtifact:", state.webSearchRewriteArtifact);

  if (state.webSearchRewriteArtifact) {
    // For generate-artifact, we don't have existing artifact content, so we use empty string
    const formattedWebSearchPrompt = REWRITE_OR_GENERATE_ARTIFACT_FROM_WEB_PROMPT
      .replace("{reflections}", memoriesAsString)
      .replace("{artifactContent}", "No existing artifact - generating new artifact");
    const fullWebSearchSystemPrompt = userSystemPrompt
      ? `${userSystemPrompt}\n${formattedWebSearchPrompt}`
      : formattedWebSearchPrompt;
    
    response = await modelWithArtifactTool.invoke(
    [
      { role: isO1MiniModel ? "user" : "system", content: fullWebSearchSystemPrompt },
      ...contextDocumentMessages,
      ...state._messages,
    ],
    { runName: "generate_artifact" }
  );
  console.log("CE QU'IL RECOIT:", fullWebSearchSystemPrompt, "MAIS AUSSI CONTEXT:", contextDocumentMessages, "ET MESSAGES:", state._messages);

  }
  else{
    response = await modelWithArtifactTool.invoke(
    [
      { role: isO1MiniModel ? "user" : "system", content: fullSystemPrompt },
      ...contextDocumentMessages,
      ...state._messages,
    ],
    { runName: "generate_artifact" }
  );
  }
  console.log("GENERATE Artifact Response:", response);


  state.webSearchRewriteArtifact = false; // Reset the web search rewrite artifact flag

  const args = response.tool_calls?.[0].args as
    | z.infer<typeof ARTIFACT_TOOL_SCHEMA>
    | undefined;
  if (!args) {
    throw new Error("No args found in response");
  }

  const newArtifactContent = createArtifactContent(args);
  const newArtifact: ArtifactV3 = {
    currentIndex: 1,
    contents: [newArtifactContent],
  };
  

  return {
    artifact: newArtifact,
  };
};
