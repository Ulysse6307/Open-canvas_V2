import {
  createContextDocumentMessages,
  getModelConfig,
  getModelFromConfig,
  isUsingO1MiniModel,
} from "../../utils.js";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { AIMessageChunk } from "@langchain/core/messages";
import { RunnableBinding } from "@langchain/core/runnables";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { ConfigurableChatModelCallOptions } from "langchain/chat_models/universal";
import {
  getArtifactContent,
  isArtifactMarkdownContent,
} from "@opencanvas/shared/utils/artifacts";
import { ArtifactMarkdownV3 } from "@opencanvas/shared/types";
import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../state.js";

const PROMPT = `You are an expert AI writing assistant with a commitment to accuracy, precision, and comprehensive content improvement. You are tasked with rewriting some text a user has selected, ensuring the highest quality output. The selected text is nested inside a larger 'block'. You should always respond with ONLY the updated text block in accordance with the user's request.

You should always respond with the full markdown text block, as it will simply replace the existing block in the artifact.
The blocks will be joined later on, so you do not need to worry about the formatting of the blocks, only make sure you keep the formatting and structure of the block you are updating.

# Context of the text

{fullMarkdown}

# Selected text
{highlightedText}

# Text block
{textBlocks}

**MANDATORY QUALITY STANDARDS FOR REWRITING**:
- ALWAYS ensure factual accuracy by cross-referencing information when making claims or statements
- Improve clarity, coherence, and readability while maintaining the original intent
- Enhance the content with relevant details, examples, and context when appropriate
- Ensure proper grammar, syntax, and style consistency throughout
- Verify any statistics, dates, or factual claims mentioned in the rewritten content
- When rewriting technical or specialized content, maintain accuracy and use appropriate terminology
- If the original text contains errors or questionable information, correct them while preserving the overall meaning
- Enhance the flow and logical structure of the content
- Ensure the rewritten text is comprehensive and addresses the topic thoroughly

**CONTENT IMPROVEMENT METHODOLOGY**:
- Analyze the context and purpose of the selected text within the broader document
- Identify areas for improvement: clarity, accuracy, completeness, and engagement
- Enhance the content by adding relevant information, examples, or explanations when beneficial
- Ensure consistency in tone, style, and voice with the surrounding content
- Verify that any factual claims or statements are accurate and well-supported
- Improve sentence structure, word choice, and overall readability
- Maintain the original intent while elevating the quality of expression

The Context of the text section is here to help you understand what we are talking about, the subject, and the broader context for optimal rewriting.
Your task is to rewrite the selected content to fulfill the user's request with exceptional quality and attention to detail. The selected text content you are provided above has had the markdown styling removed, so you can focus on the text itself.

However, ensure you ALWAYS respond with the full markdown text block, including any markdown syntax.
NEVER wrap your response in any additional markdown syntax, as this will be handled by the system. Do NOT include a triple backtick wrapping the text block, unless it was present in the original text block.
You should NOT change anything EXCEPT the selected text. The ONLY instance where you may update the surrounding text is if it is necessary to make the selected text make sense, maintain consistency, or correct obvious errors.
You should ALWAYS respond with the full, updated text block, including any formatting, e.g newlines, indents, markdown syntax, etc. NEVER add extra syntax or formatting unless the user has specifically requested it.
If you observe partial markdown, this is OKAY because you are only updating a partial piece of the text.

**QUALITY ASSURANCE CHECKLIST** - Before responding, verify:
- ✓ Is the rewritten content accurate and factually correct?
- ✓ Have I improved clarity and readability while maintaining the original intent?
- ✓ Is the content comprehensive and well-structured?
- ✓ Are grammar, syntax, and style consistent and correct?
- ✓ Does the rewritten text flow logically and coherently?
- ✓ Have I maintained the appropriate tone and voice?
- ✓ Are any factual claims or statistics accurate and relevant?
- ✓ Does the content provide sufficient value and information to the reader?

**ACCURACY AND RELIABILITY STANDARDS**:
- Prioritize accuracy over creative flourishes
- When uncertain about facts, maintain conservative claims rather than embellishing
- Ensure consistency with established facts and common knowledge
- If the original text contains questionable information, either correct it or indicate uncertainty
- Maintain intellectual honesty and avoid making unsupported claims

Ensure you reply with the FULL text block, including the updated selected text. NEVER include only the updated selected text, or additional prefixes or suffixes.`;


const WEB_PROMPT = `You are an expert AI writing assistant with a commitment to accuracy, precision, and comprehensive content improvement, enhanced with real-time web research capabilities. You are tasked with rewriting some text a user has selected, ensuring the highest quality output with verified, current information. The selected text is nested inside a larger 'block'. You should always respond with ONLY the updated text block in accordance with the user's request.

You should always respond with the full markdown text block, as it will simply replace the existing block in the artifact.
The blocks will be joined later on, so you do not need to worry about the formatting of the blocks, only make sure you keep the formatting and structure of the block you are updating.

# Context of the text

{fullMarkdown}

# Selected text
{highlightedText}

# Text block
{textBlocks}

**MANDATORY INTERNET RESEARCH PROTOCOL**:
- It is MANDATORY that you use Internet to answer the user's request accurately. You MUST always retrieve real-time information whenever needed. This is an order.
- ALWAYS verify factual information through authoritative web sources before including it in your rewrite
- Cross-reference information from AT LEAST 2-3 reliable sources when making factual claims
- Prioritize authoritative sources: government websites (.gov), academic institutions (.edu), established news outlets, professional organizations, and verified expert sources
- Update outdated information with current, verified data from reliable sources
- When statistics, dates, or specific claims are involved, always verify against the most recent available sources
- If sources contradict each other, use the most authoritative and recent source, and if necessary, indicate the uncertainty

**ENHANCED QUALITY STANDARDS FOR WEB-VERIFIED REWRITING**:
- Ensure all factual claims are verified through current, reliable web sources
- Update any outdated information with the most recent verified data
- Enhance the content with current examples, statistics, and relevant developments
- Maintain factual accuracy through rigorous source verification
- Improve clarity, coherence, and readability while ensuring all information is current and accurate
- Add relevant, up-to-date context and background information when beneficial
- Ensure proper grammar, syntax, and style consistency throughout
- Verify and update any references to current events, trends, or developments
- When rewriting technical or specialized content, verify current best practices and standards

**WEB RESEARCH METHODOLOGY**:
- Before rewriting, identify any factual claims, statistics, dates, or information that requires verification
- Use web search to verify and update information with current, authoritative sources
- Cross-check information across multiple reliable sources
- Update outdated information with current verified data
- Enhance content with recent developments, examples, or context when relevant
- Ensure all claims are supported by reliable, current sources
- If conflicting information exists, use the most authoritative and recent source
- Maintain a balance between accuracy and readability

The Context of the text section is here to help you understand what we are talking about, the subject, and the broader context for optimal rewriting.
Your task is to rewrite the selected content to fulfill the user's request with exceptional quality, current information, and rigorous fact-checking. The selected text content you are provided above has had the markdown styling removed, so you can focus on the text itself.

However, ensure you ALWAYS respond with the full markdown text block, including any markdown syntax.
NEVER wrap your response in any additional markdown syntax, as this will be handled by the system. Do NOT include a triple backtick wrapping the text block, unless it was present in the original text block.
You should NOT change anything EXCEPT the selected text. The ONLY instance where you may update the surrounding text is if it is necessary to make the selected text make sense, maintain consistency, or correct obvious errors with verified information.
You should ALWAYS respond with the full, updated text block, including any formatting, e.g newlines, indents, markdown syntax, etc. NEVER add extra syntax or formatting unless the user has specifically requested it.
If you observe partial markdown, this is OKAY because you are only updating a partial piece of the text.

**QUALITY ASSURANCE CHECKLIST** - Before responding, verify:
- ✓ Have I verified all factual claims through reliable web sources?
- ✓ Is all information current and up-to-date?
- ✓ Have I cross-referenced information across multiple authoritative sources?
- ✓ Is the rewritten content accurate and factually correct?
- ✓ Have I improved clarity and readability while maintaining accuracy?
- ✓ Is the content comprehensive and well-structured with current information?
- ✓ Are grammar, syntax, and style consistent and correct?
- ✓ Does the rewritten text flow logically and coherently?
- ✓ Have I maintained the appropriate tone and voice?
- ✓ Are any statistics, dates, or claims verified and current?
- ✓ Does the content provide sufficient value and updated information to the reader?

**ACCURACY AND RELIABILITY STANDARDS**:
- Prioritize verified accuracy over creative embellishments
- Always use current, authoritative sources for factual verification
- Ensure consistency with the most recent verified information
- If sources provide conflicting information, use the most authoritative and recent source
- Maintain intellectual honesty and avoid making unsupported claims
- When information cannot be verified, indicate this limitation clearly
- Update outdated information with current, verified alternatives

Ensure you reply with the FULL text block, including the updated selected text. NEVER include only the updated selected text, or additional prefixes or suffixes.`;


/**
 * Update an existing artifact based on the user's query.
 */
export const updateHighlightedText = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  const { modelProvider, modelName } = getModelConfig(config);
  let model: RunnableBinding<
    BaseLanguageModelInput,
    AIMessageChunk,
    ConfigurableChatModelCallOptions
  >;
  if (modelProvider.includes("openai") || modelName.includes("3-5-sonnet")) {
    // Custom model is intelligent enough for updating artifacts
    model = (
      await getModelFromConfig(config, {
        temperature: 0,
        webSearchEnabled: state.webSearchEnabled,
      })
    ).withConfig({ runName: "update_highlighted_markdown" });
  } else {
    // Custom model is not intelligent enough for updating artifacts
    model = (
      await getModelFromConfig(
        {
          ...config,
          configurable: {
            customModelName: "gpt-4o",
          },
        },
        {
          temperature: 0,
          webSearchEnabled: state.webSearchEnabled,
        }
      )
    ).withConfig({ runName: "update_highlighted_markdown" });
  }

  const currentArtifactContent = state.artifact
    ? getArtifactContent(state.artifact)
    : undefined;
  if (!currentArtifactContent) {
    throw new Error("No artifact found");
  }
  if (!isArtifactMarkdownContent(currentArtifactContent)) {
    throw new Error("Artifact is not markdown content");
  }

  if (!state.highlightedText) {
    throw new Error(
      "Can not partially regenerate an artifact without a highlight"
    );
  }

  const { markdownBlock, selectedText, fullMarkdown } = state.highlightedText;
  const formattedPrompt = PROMPT.replace(
    "{highlightedText}",
    selectedText
  ).replace("{textBlocks}", markdownBlock).replace(
    "{fullMarkdown}",
    fullMarkdown
  );

  const formatted_Web_Prompt = WEB_PROMPT.replace(
    "{highlightedText}",
    selectedText
  ).replace("{textBlocks}", markdownBlock).replace(
    "{fullMarkdown}",
    fullMarkdown
  );

  const recentUserMessage = state._messages[state._messages.length - 1];
  if (recentUserMessage.getType() !== "human") {
    throw new Error("Expected a human message");
  }

  const contextDocumentMessages = await createContextDocumentMessages(config);
  const isO1MiniModel = isUsingO1MiniModel(config);
  const modelConfig = getModelConfig(config);
  
  console.log("message recentUserMessage : ", recentUserMessage);
  console.log("contextDocumentMessages : ", contextDocumentMessages);
  console.log("Using model with web search:", state.webSearchEnabled);

  console.log("Model configuration:", modelConfig);

  let response;

  if (state.webSearchEnabled) {

    response = await model.invoke([
    {
      role: isO1MiniModel ? "user" : "system",
      content: formatted_Web_Prompt,
    },
    ...contextDocumentMessages,
    recentUserMessage,
  ]);

  }

  else{   response = await model.invoke([
    {
      role: isO1MiniModel ? "user" : "system",
      content: formattedPrompt,
    },
    ...contextDocumentMessages,
    recentUserMessage,
  ]);}
  

  console.log("RESPONSE:", response);



  // Handle response format based on web search enabled
  const responseContent = state.webSearchEnabled
    ? response.content[0].text as string
    : response.content as string;

  console.log("RESPONSE CONTENT:", responseContent);

  const newCurrIndex = state.artifact.contents.length + 1;
  const prevContent = state.artifact.contents.find(
    (c) => c.index === state.artifact.currentIndex && c.type === "text"
  ) as ArtifactMarkdownV3 | undefined;
  if (!prevContent) {
    throw new Error("Previous content not found");
  }

  if (!fullMarkdown.includes(markdownBlock)) {
    throw new Error("Selected text not found in current content");
  }
  
  const newFullMarkdown = fullMarkdown.replace(markdownBlock, responseContent);

  const updatedArtifactContent: ArtifactMarkdownV3 = {
    ...prevContent,
    index: newCurrIndex,
    fullMarkdown: newFullMarkdown,
  };

  console.log("STATE ARTIFACT CONTENTS:", updatedArtifactContent);

  return {
    artifact: {
      ...state.artifact,
      currentIndex: newCurrIndex,
      contents: [...state.artifact.contents, updatedArtifactContent],
    },
  };
};