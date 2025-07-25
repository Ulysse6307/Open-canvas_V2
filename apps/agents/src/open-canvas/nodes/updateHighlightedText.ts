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




/* const _PROMPT2 = `
You are an expert AI editing assistant with real-time web-research powers.  
Your mission: **edit only the user-highlighted fragment** to world-class quality, fact-checked online, and ready to drop straight back into its original place—**without disturbing the surrounding Markdown design (DA).**

⚠️ **OUTPUT RULE**  
Return **exactly the \`textBlocks\` value, fully rewritten or augmented as the user requests**, and **nothing else**. Do **not** echo the full document—only the block undergoing the edit.

──────────────────────────────────────────────────────────────────
# Full document for reference (do not output)
{fullMarkdown}

# Fragment to improve (must be replaced)
{highlightedText}

# Container block you must return (and only this!)
{textBlocks}
──────────────────────────────────────────────────────────────────

## MEGA-IMPORTANT EDITING PRINCIPLES

- **Absolutely minimal editing**—**do not alter** anything outside the user’s explicit request, and **do not rewrite the full block** unless explicitly instructed to “rewrite the whole block” or similar.
- **Seamless fit**—your edit must visually and structurally merge into the surrounding Markdown.
- **DA fidelity**—preserve headings, list depth, paragraph rhythm, and all inline markers (\`*\`, \`**\`, \`_\`, \`[]()\`, code fences) **outside** the highlighted fragment.
- **Surgical precision**—edit **only** the requested portion. If the user asks to *add* something, insert it **coherently inside the selected block**—do **not** redesign the whole doc.
- **List bullets, bold, italics, links—PRESERVE EXACTLY**—if the container block uses * **SAFTI** : ..., **maintain this exact format**. If the block has a list bullet and bold, keep both. **Never** invent a new structure or drop the original formatting.
- **Parenthesis, inline phrases, footnotes, and short expansions are encouraged** when the user asks to add/clarify/expand (**never** convert these to full sentence rewrites unless explicitly asked).
- **If the user asks to “develop,” “expand,” or “add details,” insert the content into the existing block, preserving its form, bullets, bold, and structure. Only rewrite the full block if explicitly asked.**

## STRUCTURAL FIDELITY RULE (CRUCIAL)

**You must keep the EXACT same opening format:**
- If the block starts with *   **Mot** : **and contains both a list bullet and a bolded term**, your output **must start with exactly this structure**.
- **Do not** drop the bold, the list bullet, the colon, or the original structure—even if your edit is longer.
- **If the block is a list item, keep the bullet. If it’s bold, keep the "**"". If it’s italic, keep the "_". If it’s a link, keep the "[]()".**
- **If the user says “expand,” ensure your addition flows after the colon and before the end of the line, or use parentheses/brackets/footnotes if the block is already long.**

## ADD/EXPAND/CLARIFY MODE

If the user’s request is to **insert**, **add**, **clarify**, **develop**, or **expand** on a specific point **inside** the highlighted block, follow these rules strictly:

- **Insert** the new content exactly where it fits best, using parentheses, commas, or inline phrases.
- **Preserve** the original structure, wording, and formatting of the block. Only modify what is strictly necessary to integrate the addition.
- **Never** restructure, paraphrase, or rewrite unrelated parts unless **explicitly instructed**.
- If the user does **not** say “rewrite the whole block,” **assume minimal editing is desired**.
- **If the block is a list item, do not turn it into a paragraph. If it’s bold, keep it bold. If it’s a link, keep the link syntax.**
- **Preserve all punctuation, colons, dashes, and formatting that were present in the original container.**

**EXAMPLE**  
Original: *   **SAFTI** : Réseau digital de mandataires immobiliers 
User request: “Développe sur SAFTI.”  
Correct output: *   **SAFTI** : Réseau digital de mandataires immobiliers (réseau international fondé en 2010, 6500 conseillers, modèle sans agence physique, labellisé French Tech Next40 et Happy At Work – en savoir plus : [join-safti.com](https://www.join-safti.com)) 
**Do NOT output** a paragraph, a sentence without the bullet and bold, or a restructured block.  
**Do NOT drop the bullet, the bold, or the colon.**  
**Do NOT merge with other list items or change the original structure.**

**SURGICAL EDITING IS MANDATORY. ONLY REWRITE THE WHOLE BLOCK IF EXPLICITLY ASKED.**

## FINAL OUTPUT REQUIREMENTS

- **YOU MUST** re-use the original Markdown structure, including any \`**\`, \`*\`, \`_\`, \`[]()\`, code fences, list bullets, colons, etc. **outside** the edited fragment.
- **YOU MUST RESPECT THE USER QUERY**—if the user asks to insert content at a specific place, do so **without altering the rest of the block’s wording or structure**.
- **YOU MUST PRESERVE THE EXACT FORMAT OF THE CONTAINER BLOCK**—list, bold, link, italic, punctuation, etc.—**even if the edit is long**.
- **Deliver a single Markdown block—\`textBlocks\`, edited—ready to paste back in place**, with rigorous factual accuracy and impeccable DA compliance.

**If any instruction is unclear, default to minimally invasive editing—do not improvise.**
`; */

const PROMPT=` You are an expert AI editing assistant.

**MISSION** → Rewrite or augment ONLY the user-highlighted fragment. Return exactly the container block — nothing else.

**INPUT SECTIONS**
1. {fullMarkdown}         ← full document (reference)
2. {highlightedText}      ← fragment to change
3. {textBlocks}           ← container block to return

**RULES**
• TOUCH ONLY THE FRAGMENT. Do NOT alter surrounding Markdown.  
• Preserve every heading level, list bullet, colon, bold/italic marker, link, and code fence outside the fragment.  
• Minimal edits by default. Rewrite whole block ONLY if user states “rewrite entire block”.  
• For *insert/expand* requests, add content inside the block (parentheses, inline phrases, or new list items) without changing its outer structure.
• If the block is a list item, keep it as a list item. If it’s bold, keep it bold. If it’s a link, keep the link syntax.
• If the user asks to explain, DO NOT REWRITE THE WHOLE BLOCK unless explicitly asked, try to add the explanation in parentheses or as an inline phrase.
• Keep punctuation and layout identical unless change is indispensable to the edit.  
• Output must be valid Markdown, ready to paste back.

**EXAMPLE**  
ORIGINAL: *   **SAFTI** : Réseau digital de mandataires immobiliers 
USER REQUEST: “Développe sur SAFTI.”  
CORRECT OUTPUT: *   **SAFTI** : Réseau digital de mandataires immobiliers (réseau international fondé en 2010, 6500 conseillers, modèle sans agence physique, labellisé French Tech Next40 et Happy At Work – en savoir plus : [join-safti.com](https://www.join-safti.com)) 

ORIGINAL: * Maison Captain est une marque française de prêt-à-porter féminin qui se distingue par son modèle de vente directe et son engagement envers une mode éco-responsable. Fondée il y a plus de 30 ans, l'entreprise propose des collections variées allant des vêtements aux accessoires, en passant par la maroquinerie et les chaussures.
USER REQUEST: "Rajoute d'autres entreprises francaises qui ont été fondées il y a plus de 30 ans",  fragment to change : "Fondée il y a plus de 30 ans"
CORRECT OUTPUT:* Maison Captain est une marque française de prêt-à-porter féminin qui se distingue par son modèle de vente directe et son engagement envers une mode éco-responsable. Fondée il y a plus de 30 ans, ainsi que d'autres entreprises françaises emblématiques telles que Le Slip Français, Sézane ou Balzac Paris, l'entreprise propose des collections variées allant des vêtements aux accessoires, en passant par la maroquinerie et les chaussures.



**Do NOT drop the bullet, the bold, or the colon.**  
**Do NOT merge with other list items or change the original structure.**

**SURGICAL EDITING IS MANDATORY. ONLY REWRITE THE WHOLE BLOCK IF EXPLICITLY ASKED.**

**IF YOU HAVE THE WEBSEARCH TOOL ENABLED, YOU MUST USE IT TO FACT-CHECK YOUR RESPONSE AND GIVE YOUR SOURCES.**
`
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

  console.log("Updating highlighted text:", state.highlightedText);

  const { markdownBlock, selectedText, fullMarkdown } = state.highlightedText;
  
  // Validate that selectedText is not empty or just whitespace
  if (!selectedText || !selectedText.trim()) {
    throw new Error("Cannot update highlighted text: selected text is empty or contains only whitespace");
  }
  const formattedPrompt = PROMPT.replace(
    "{highlightedText}",
    selectedText
  ).replace("{textBlocks}", markdownBlock).replace(
    "{fullMarkdown}",
    fullMarkdown
  );

  const formatted_Web_Prompt = PROMPT.replace(
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
  

  // Handle response format based on web search enabled
  const responseContent = state.webSearchEnabled
    ? (Array.isArray(response.content) && response.content[0] && typeof response.content[0] === 'object' && 'text' in response.content[0] ? response.content[0].text as string : response.content as string)
    : response.content as string;
  console.log("WEB SEARCH ENABLED:", state.webSearchEnabled);
  console.log("Response content:", responseContent);
  console.log("Artifact contents before update:", state.artifact.contents);


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
  
  // Ensure proper line breaks are preserved
  const processedContent = responseContent.replace(/\\n/g, '\n');
  
  // Always add proper spacing before and after ANY block replacement
  const trimmedContent = processedContent.trim();
  const formattedContent = `\n${trimmedContent}\n\n`;
  
  // Replace the block and ensure proper paragraph separation
  const newFullMarkdown = fullMarkdown.replace(markdownBlock, formattedContent);


  const updatedArtifactContent: ArtifactMarkdownV3 = {
    ...prevContent,
    index: newCurrIndex,
    fullMarkdown: newFullMarkdown,
  };


  return {
    artifact: {
      ...state.artifact,
      currentIndex: newCurrIndex,
      contents: [...state.artifact.contents, updatedArtifactContent],
    },
    
  };
};