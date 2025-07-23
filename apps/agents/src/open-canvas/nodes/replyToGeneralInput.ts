import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getArtifactContent } from "@opencanvas/shared/utils/artifacts";
import { Reflections } from "@opencanvas/shared/types";
import {
  createContextDocumentMessages,
  ensureStoreInConfig,
  formatArtifactContentWithTemplate,
  formatReflections,
  getModelFromConfig,
  isUsingO1MiniModel,
} from "../../utils.js";
import { CURRENT_ARTIFACT_PROMPT, NO_ARTIFACT_PROMPT } from "../prompts.js";
import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../state.js";
import { AIMessage, AIMessageChunk } from "@langchain/core/messages";

/**
 * Generate responses to questions. Does not generate artifacts.
 */
export const replyToGeneralInput = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  

  let smallModel;

  if(state.webSearchEnabled ) {
    smallModel = await getModelFromConfig(config,{webSearchEnabled: state.webSearchEnabled,});
    console.log("ON EST LAAAAA Web search enabled")

  }
  else{
    smallModel = await getModelFromConfig(config);
    console.log("ON EST LAAAAA Web search pas enabled !")
  }
  

  const prompt = `You are an AI assistant tasked with responding to the users question.
  
The user has generated artifacts in the past. Use the following artifacts as context when responding to the users question.

You also have the following reflections on style guidelines and general memories/facts about the user to use when generating your response.
<reflections>
{reflections}
</reflections>

{currentArtifactPrompt}`;

  const currentArtifactContent = state.artifact
    ? getArtifactContent(state.artifact)
    : undefined;

  const store = ensureStoreInConfig(config);
  const assistantId = config.configurable?.assistant_id;
  if (!assistantId) {
    throw new Error("`assistant_id` not found in configurable");
  }
  const memoryNamespace = ["memories", assistantId];
  const memoryKey = "reflection";
  const memories = await store.get(memoryNamespace, memoryKey);
  const memoriesAsString = memories?.value
    ? formatReflections(memories.value as Reflections)
    : "No reflections found.";

  const formattedPrompt = prompt
    .replace("{reflections}", memoriesAsString)
    .replace(
      "{currentArtifactPrompt}",
      currentArtifactContent
        ? formatArtifactContentWithTemplate(
            CURRENT_ARTIFACT_PROMPT,
            currentArtifactContent
          )
        : NO_ARTIFACT_PROMPT
    );

  const contextDocumentMessages = await createContextDocumentMessages(config);
  const isO1MiniModel = isUsingO1MiniModel(config);
  console.log("COntenu du message:",contextDocumentMessages,state._messages, "ET LE PROMMPT", formattedPrompt);

  let response;

  if (state.webSearchEnabled) {
    function stripIds(messages) {
      return messages.map(m => ({
        role: m._getType() === 'human' ? 'user' : m._getType() === 'ai' ? 'assistant' : m._getType(),
        content: m.content
      }));
    }

    function transformWebSearchResponse(webSearchResponse) {
      // Extract the text content from the websearch response
      let textContent = "";
      if (Array.isArray(webSearchResponse.content) && webSearchResponse.content[0]?.text) {
        textContent = webSearchResponse.content[0].text;
      }
      
      // Create a completely new AIMessageChunk that matches the expected format
      const usage = webSearchResponse.usage_metadata || {};
      
      return new AIMessageChunk({
        content: textContent,
        id: `chatcmpl-${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 10)}`,
        additional_kwargs: {},
        response_metadata: {
          usage: {
            prompt_tokens: usage.input_tokens || 0,
            completion_tokens: usage.output_tokens || 0,
            total_tokens: usage.total_tokens || 0,
            prompt_tokens_details: {
              cached_tokens: 0,
              audio_tokens: 0
            },
            completion_tokens_details: {
              reasoning_tokens: 0,
              audio_tokens: 0,
              accepted_prediction_tokens: 0,
              rejected_prediction_tokens: 0
            }
          }
        },
        tool_calls: [],
        tool_call_chunks: [],
        invalid_tool_calls: [],
        usage_metadata: {
          input_tokens: usage.input_tokens || 0,
          output_tokens: usage.output_tokens || 0,
          total_tokens: usage.total_tokens || 0,
          input_token_details: {
            audio: 0,
            cache_read: 0
          },
          output_token_details: {
            audio: 0,
            reasoning: 0
          }
        }
      });
    }
    
    console.log("VOICI ce que l'on met pour les messages Web :",contextDocumentMessages, state._messages);
    response = await smallModel.invoke([
    { role: isO1MiniModel ? "user" : "system", content: formattedPrompt },
    ...stripIds(contextDocumentMessages),
    ...stripIds(state._messages),]);
      
      console.log("Response BEFORE transformation:", response);
      const transformedResponse = transformWebSearchResponse(response);
      console.log("Response AFTER transformation:", transformedResponse);
      console.log("WEBSEARCH: About to return from replyToGeneralInput");
      
      return {
    messages: [transformedResponse],
    _messages: [transformedResponse],
  };
  }

  else {response = await smallModel.invoke([
    { role: isO1MiniModel ? "user" : "system", content: formattedPrompt },
    ...contextDocumentMessages,
    ...state._messages,
  ]);
  console.log("Response content:, sans websearch", response);
    return {
    messages: [response],
    _messages: [response],
  };}
};
