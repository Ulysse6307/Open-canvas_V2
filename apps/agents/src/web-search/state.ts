import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { SearchResult } from "@opencanvas/shared/types";

export const WebSearchGraphAnnotation = Annotation.Root({
  /**
   * The chat history to search the web for.
   * Will use the latest user message as the query.
   */
  ...MessagesAnnotation.spec,
  /**
   * The search query.
   */
  query: Annotation<string>,
  /**
   * The search results
   */
  webSearchResults: Annotation<SearchResult[]>,
  /**
   * Whether or not to search the web based on the user's latest message.
   */
  shouldSearch: Annotation<boolean>,
  /**
   * The user answer from O3's web search response
   */
  userAnswer: Annotation<string>,
});

export type WebSearchState = typeof WebSearchGraphAnnotation.State;
