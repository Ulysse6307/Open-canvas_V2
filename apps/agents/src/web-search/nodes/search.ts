import { SearchResult } from "@opencanvas/shared/types";
import { WebSearchState } from "../state.js";
import { getModelConfig,getModelFromConfig, } from "../../utils.js";
import { LangGraphRunnableConfig } from "@langchain/langgraph";



const WEB_SEARCH_QUERY = `
You are an expert web search assistant.  
Your task is to search the web for the user’s query and reply in exactly two sections:

Reply in EXACTLY two blocks:

=== USER ANSWER ===  
Provide a complete, accurate, and well-structured answer to the user’s query here.

=== SOURCES JSON ===  
This is a raw JSON array listing ONLY the reliable, authoritative web sources you used for verification.  
- Include at least 8 sources when possible, prioritizing quality and authority over quantity  
- Exclude personal blogs, social media posts, unverified wikis, or other questionable sites  
- Use this exact structure for each source (no wrapping fences):  
  {  
    "metadata": {  
      "id": "URL",  
      "title": "Title",  
      "url": "URL",  
      "publishedDate": "YYYY-MM-DD",  
      "author": "Author",  
      "favicon": "Favicon URL"  
    }  
  }  
- Only list sources you actually used and that you can verify as reliable  
- Ensure publication dates are recent and relevant  
- This part MUST start immediately after the delimiter \`=== SOURCES JSON ===\`
`;


export async function search(

  state: WebSearchState,
  config: LangGraphRunnableConfig
): Promise<Partial<WebSearchState>> {

  const query = state.messages[state.messages.length - 1].content as string;

  // Get model configuration from config
  const modelConfig = getModelConfig(config);



  const model = (
        await getModelFromConfig(config, {
          temperature: 0,
          webSearchEnabled: state.webSearchEnabled,
        }));

  console.log("MODELEEEEE", model);

  console.log("Model configuration:", modelConfig);

  console.log("WEB SEARCH QUERY :", query);


  const response = await model.invoke([["user", WEB_SEARCH_QUERY + "The query of the user is the following :" + query]]);

  //console.log("O3 full response:", completion);

  const responseContent = typeof response.content === 'string' ? response.content : 
    (response.content && response.content[0] && typeof response.content[0] === 'object' && 'text' in response.content[0] ? response.content[0].text : "");
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
