import { SearchResult } from "@opencanvas/shared/types";
import { WebSearchState } from "../state.js";
import { getModelConfig } from "../../utils.js";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";


const WEB_SEARCH_QUERY = `You are a web search assistant. Your task is to search the web based on the user's query and generate a response that is strictly divided into two parts, using the specified format. Follow this format scrupulously to ensure automatic parsing works correctly.

**PART 1 - USER ANSWER**:
- This is the detailed and complete response to the user's query.
- Write a comprehensive answer using Markdown formatting to structure it (e.g., headings with #, bold with **, lists with -).
- DO NOT use isolated asterisks (*) for lists; always prefer - to avoid rendering issues.
- This part MUST start immediately after the delimiter \`=== USER ANSWER ===\`.
- Simple example: If the query is "Capital of France", write something like: "The capital of France is Paris, a city rich in history."

**PART 2 - SOURCES JSON**:
- This is a raw JSON array listing the web sources used.
- Provide a valid and clean JSON, without any wrapping (no \`\`\`json or similar).
- Exact structure for each source: { "metadata": { "id": "URL", "title": "Title", "url": "URL", "publishedDate": "ISO date", "author": "Author", "favicon": "Favicon URL" } }
- This part MUST start immediately after the delimiter \`=== SOURCES JSON ===\`.
- Simple example: [{"metadata": {"id": "https://example.com", "title": "Example Page", "url": "https://example.com", "publishedDate": "2023-01-01", "author": "John Doe", "favicon": "https://example.com/favicon.ico"}}]

**CRITICAL FORMATTING INSTRUCTIONS**:
1. Your entire response MUST start DIRECTLY with \`=== USER ANSWER ===\` with nothing before it (no introductory text).
2. Separate the two parts with \`=== SOURCES JSON ===\` exactly like that, without spaces or additional text.
3. The JSON in part 2 must be raw and valid; DO NOT wrap it in Markdown fences (\`\`\`).
4. If you do not follow this, parsing will fail – adhere to it exactly for optimal functioning.`;



export async function search(
  state: WebSearchState,
  config: LangGraphRunnableConfig
): Promise<Partial<WebSearchState>> {

  const query = state.messages[state.messages.length - 1].content as string;

  

  // Get model configuration from config
  const modelConfig = getModelConfig(config);

  console.log("MODELEEEEE", modelConfig.modelName);

  const model = new ChatOpenAI({model: modelConfig.modelName})
  const tool = {"type": "web_search_preview"}
  const model_with_tools = model.bindTools([tool])

  console.log("WEB SEARCH QUERY :", query);

  const response = await model_with_tools.invoke([["user", WEB_SEARCH_QUERY + "this is the query :" + query]]);


  //console.log("O3 full response:", completion);

  const responseContent = response.content[0].text || "";
  console.log("VRAI REPONSE", responseContent);
  console.log( modelConfig.modelName, "content:", responseContent);

  // Parse the two-part response
  const userAnswerMatch = responseContent.match(/=== USER ANSWER ===([\s\S]*?)=== SOURCES JSON ===/);
  const sourcesJsonMatch = responseContent.match(/=== SOURCES JSON ===([\s\S]*?)$/);

  const userAnswer = userAnswerMatch ? userAnswerMatch[1].trim() : "";
  let sourcesJson = sourcesJsonMatch ? sourcesJsonMatch[1].trim() : "";

  ///console.log("Extracted user answer:", userAnswer);
  //console.log("Extracted sources JSON:", sourcesJson);

  // Clean JSON
  if (sourcesJson.startsWith("```json")) {
    sourcesJson = sourcesJson.slice(7).trim();
  }
  if (sourcesJson.endsWith("```")) {
    sourcesJson = sourcesJson.slice(0, -3).trim();
  }

  try {
    const sources = JSON.parse(sourcesJson);
    
    // Convert to SearchResult format with empty pageContent (will be filled later)
    const searchResults: SearchResult[] = sources.map((source: any) => ({
      pageContent: "", // Empty for now, just need URLs for right panel
      metadata: source.metadata
    }));

    //console.log("Parsed search results:", searchResults);
    
    return {
      webSearchResults: searchResults,
      userAnswer: userAnswer // Store O3's answer to use later
    };
  } catch (error) {
    console.error("Failed to parse sources JSON:", error);
    return { 
      webSearchResults: [],
      userAnswer: userAnswer || "Search completed but failed to parse sources."
    };
  }
  
}
