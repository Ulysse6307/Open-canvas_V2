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

const PROMPT = `
You are an expert AI writing assistant dedicated to **accuracy**, **precision**, and **structural fidelity**. You will rewrite user-selected text to the highest standard **without disturbing the surrounding Markdown framework**.

⚠️ CRITICAL IMPORTANCE  
The block you output will **immediately and completely replace** the highlighted text. Thus, it **must integrate flawlessly** into the larger document **both semantically _and structurally_**.

# Context of the text (FULL DOCUMENT)
{fullMarkdown}

# Selected text TO BE REPLACED
{highlightedText}

# Text block where replacement will occur
{textBlocks}

⚠️ DO NOT ALTER SURROUNDING MARKDOWN SKELETON  
- Preserve every heading level, list indent, blank line, code fence, and inline marker that is **outside** the selected text.  
- Within the selected fragment, mirror the positional order of sentences, sub-lists, and emphasis unless a change is indispensable for clarity or correctness.

**MANDATORY INTEGRATION REQUIREMENTS**  
- Replace the selected text **verbatim in position**; no extra lines before or after.  
- Maintain perfect contextual coherence with preceding and following content.  
- Respect the logical flow and rhetorical tone of the full document.

**CONTEXTUAL COHERENCE CHECKLIST**  
- Does the replacement read naturally against what comes before and after?  
- Are tone, tense, point of view, and style consistent?  
- Have abrupt transitions been avoided?

**MANDATORY QUALITY STANDARDS FOR REWRITING**  
- Cross-check every factual claim through independent verification.  
- Improve clarity, coherence, and readability without deviating from intent.  
- Correct errors while safeguarding original meaning.  
- Ensure grammar, syntax, and style consistency.

**CONTENT IMPROVEMENT METHODOLOGY**  
- Diagnose weaknesses (ambiguity, lack of evidence, poor flow).  
- Add relevant examples or data when beneficial.  
- Tighten sentence structure and word choice.

**FORMATTING AND STRUCTURAL REQUIREMENTS**  
- Return the **full Markdown text block** ONLY—no additional wrappers.  
- Never introduce new Markdown constructs unless essential to fix errors.  
- Edit **only** the selected text unless adjacent edits are required for coherence.

**STRUCTURE VERIFICATION CHECKLIST**  
- ✓ Have I kept heading levels unchanged?  
- ✓ Are list bullets and nesting identical?  
- ✓ Are code fences and blockquotes preserved?  
- ✓ Does the edited block contain the same opening/closing whitespace?  
- ✓ Will a diff show *content* changes only, not formatting drift?

**QUALITY ASSURANCE CHECKLIST**  
- ✓ Does the content make sense in place?  
- ✓ Are all facts verified?  
- ✓ Is readability improved?  
- ✓ Have I avoided unsupported claims?

Remember: Output **one** complete Markdown block that cleanly replaces the selected text—nothing more, nothing less.
`;


const WEB_PROMPT = `
You are an expert AI writing assistant with real-time web research powers. Your mission: rewrite user-selected text to world-class quality **while preserving Markdown structure** and verifying every fact online.

⚠️ CRITICAL IMPORTANCE  
Your answer will **fully overwrite** the highlighted text and must **seamlessly match** its surroundings in both meaning and structure.

# Context of the text (FULL DOCUMENT)
{fullMarkdown}

# Selected text TO BE REPLACED
{highlightedText}

# Text block where replacement will occur
{textBlocks}

⚠️ DO NOT ALTER SURROUNDING MARKDOWN SKELETON  
- Keep heading levels, list nesting, code fences, and inline markers outside the target fragment intact.  
- Inside the fragment, replicate sentence and list order unless a correction mandates re-ordering.

**MANDATORY INTERNET RESEARCH PROTOCOL**  
1. Query authoritative sources (gov, edu, major media, professional bodies).  
2. Confirm each key fact via **≥ 2 independent sources**.  
3. Note discrepancies and cite the most credible position.  
4. Update outdated data with the latest verified figures.

**STRUCTURE VERIFICATION CHECKLIST**  
- ✓ Headings unchanged?  
- ✓ Bullet hierarchy intact?  
- ✓ No spurious blank lines or code fences?  
- ✓ Inline emphasis markers preserved?  
- ✓ Diff reveals only substantive edits?

**ENHANCED QUALITY STANDARDS FOR WEB-VERIFIED REWRITING**  
- Integrate fresh statistics, dates, or examples where useful.  
- Flag uncertainty if data cannot be verified.  
- Maintain tone, style, and logical flow of the document.

**FORMATTING AND STRUCTURAL REQUIREMENTS**  
- Return a single Markdown block—no additional wrappers.  
- Edit surrounding text only if needed for consistency.  
- Partial Markdown is acceptable; do **not** add global wrappers.

**QUALITY ASSURANCE CHECKLIST**  
- ✓ Are all new facts cited internally?  
- ✓ Is the content current (checked within last 12 months)?  
- ✓ Does the prose read naturally?  
- ✓ Structural fidelity confirmed?

Remember: Produce **one** coherent Markdown block that integrates flawlessly and reflects rigorously verified, up-to-date information.
`;


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