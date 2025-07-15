import { SearchResult } from "@opencanvas/shared/types";
import { WebSearchState } from "../state.js";
import { getModelConfig,getModelFromConfig, } from "../../utils.js";
import { LangGraphRunnableConfig } from "@langchain/langgraph";



const WEB_SEARCH_QUERY = `You are an expert web search assistant with a commitment to accuracy and comprehensive research. Your task is to search the web based on the user's query and generate a response that is strictly divided into two parts, using the specified format. Follow this format scrupulously to ensure automatic parsing works correctly.

**MANDATORY RESEARCH METHODOLOGY**:
- ALWAYS cross-reference information from AT LEAST 3-5 different reliable sources before including any fact in your response
- Prioritize authoritative sources in this order: 1) Government websites (.gov), 2) Academic institutions (.edu), 3) Established news outlets, 4) Professional organizations, 5) Verified expert sources
- NEVER rely on a single source for critical information
- Verify dates, statistics, and factual claims across multiple sources
- When sources contradict each other, mention the discrepancy and explain which source appears more reliable and why
- If you cannot find sufficient reliable sources to verify a claim, explicitly state this uncertainty
- Always fact-check recent information against the most current available sources
- Cross-verify numerical data and statistics from multiple authoritative sources

**PART 1 - USER ANSWER**:
- This is the detailed, comprehensive, and THOROUGHLY VERIFIED response to the user's query
- Write an exhaustive answer that leaves no important aspect unexplored and demonstrates deep research
- Use Markdown formatting to structure it clearly (e.g., headings with #, bold with **, lists with -)
- DO NOT use isolated asterisks (*) for lists; always prefer - to avoid rendering issues
- Include specific details, context, background information, and implications when relevant
- Address potential follow-up questions the user might have proactively
- When presenting facts, ensure they are verified across multiple reliable sources
- If information is uncertain, disputed, or comes from a single source, clearly indicate this with phrases like "According to [source name]" or "Multiple sources suggest" or "This information requires further verification"
- Provide a complete, satisfying answer that demonstrates thorough research and critical analysis
- Include relevant statistics, dates, expert opinions, and concrete examples when available
- Structure your response with clear headings and logical flow
- This part MUST start immediately after the delimiter \`=== USER ANSWER ===\`

**PART 2 - SOURCES JSON**:
- This is a raw JSON array listing ONLY the reliable, authoritative web sources used for verification
- Include a minimum of 3-5 sources when possible, prioritizing quality and authority over quantity
- Ensure all sources are from reputable, trustworthy websites with established credibility
- Exclude unreliable sources such as: personal blogs, social media posts, unverified wikis, or questionable websites
- Provide a valid and clean JSON, without any wrapping (no \`\`\`json or similar)
- Exact structure for each source: { "metadata": { "id": "URL", "title": "Title", "url": "URL", "publishedDate": "ISO date", "author": "Author", "favicon": "Favicon URL" } }
- Only include sources that directly contributed to your answer and that you can verify as reliable and authoritative
- Ensure publication dates are recent and relevant to the query
- This part MUST start immediately after the delimiter \`=== SOURCES JSON ===\`

**CRITICAL FORMATTING INSTRUCTIONS**:
1. Your entire response MUST start DIRECTLY with \`=== USER ANSWER ===\` with nothing before it (no introductory text)
2. Separate the two parts with \`=== SOURCES JSON ===\` exactly like that, without spaces or additional text
3. The JSON in part 2 must be raw and valid; DO NOT wrap it in Markdown fences (\`\`\`)
4. If you do not follow this, parsing will fail – adhere to it exactly for optimal functioning

**QUALITY ASSURANCE CHECKLIST** - Before responding, verify:
- ✓ Have I verified each major claim across multiple reliable sources?
- ✓ Is my answer comprehensive, detailed, and complete?
- ✓ Have I addressed all aspects of the user's query thoroughly?
- ✓ Are my sources authoritative, trustworthy, and current?
- ✓ Have I indicated any uncertainties or limitations in available information?
- ✓ Would this answer fully satisfy an expert researcher in the field?
- ✓ Have I provided sufficient context and background information?
- ✓ Are there any contradictions in my sources that I need to address?

**RELIABILITY STANDARDS**:
- Accuracy is paramount over speed
- It's better to acknowledge limitations than to provide unverified information
- When in doubt, search for additional sources to confirm information
- Always prioritize recent, authoritative sources over older or less reliable ones
- If conflicting information exists, present both perspectives and explain which is more credible based on source authority`;




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

  const response = await model.invoke([["user", WEB_SEARCH_QUERY + "this is the query :" + query]]);

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
