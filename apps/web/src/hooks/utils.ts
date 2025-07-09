import { Client } from "@langchain/langgraph-sdk";

export const createClient = () => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://51.77.132.16:3001/api";
 

  return new Client({
    apiUrl,
  });
};
