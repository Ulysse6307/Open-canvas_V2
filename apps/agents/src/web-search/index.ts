import { StateGraph, START, END } from "@langchain/langgraph";
import { WebSearchGraphAnnotation } from "./state.js";
import { search } from "./nodes/search.js";

// Simplified web search graph - go directly to search with user's original query
const builder = new StateGraph(WebSearchGraphAnnotation)
  .addNode("search", search)
  .addEdge(START, "search")
  .addEdge("search", END);

export const graph = builder.compile();

graph.name = "Web Search Graph";
