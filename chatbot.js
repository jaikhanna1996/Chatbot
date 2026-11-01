import "dotenv/config";
import OpenAI from "openai";
import { tavily } from "@tavily/core";

const systemMessage = {
  role: "system",
  content:
    `You are Jarvis, a helpful assistant who answers questions clearly. Current date-time: ${new Date().toISOString()}. If a user asks for web information, use the webSearch tool when needed. Format responses as readable Markdown: use short paragraphs, headings when useful, and separate list items onto their own lines. When giving multiple facts or results, use a numbered or bulleted list instead of putting them in one long sentence. Keep the response concise and easy to scan.`
};

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

const client = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

export async function getChatbotReply(question, chatHistory = []) {
  if (!question || typeof question !== "string") {
    throw new Error("Question is required.");
  }

  if (!Array.isArray(chatHistory)) {
    throw new Error("Chat history must be an array.");
  }

  if (question.trim().toLowerCase() === "exit") {
    return "Exiting...";
  }

  const previousMessages = chatHistory
    .filter(
      (message) =>
        message &&
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string"
    )
    .map(({ role, content }) => ({ role, content }));
  const messages = [
    systemMessage,
    ...previousMessages,
    { role: "user", content: question.trim() },
  ];

  while (true) {
    const response = await client.chat.completions.create({
      model: "openai/gpt-oss-20b",
      temperature: 0,
      messages,
      tools: [
        {
          type: "function",
          function: {
            name: "webSearch",
            description: "Search the web for information",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "The search query to look up on the web",
                },
              },
              required: ["query"],
            },
          },
        },
      ],
    });

    const message = response.choices[0].message;
    messages.push(message);

    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.function.name === "webSearch") {
          const args = JSON.parse(toolCall.function.arguments);
          const toolResult = await webSearch(args.query);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }
      }
      continue;
    }

    return message.content || "I could not generate a response.";
  }
}

async function webSearch(query) {
  const tavilyResponse = await tvly.search(query);
  return tavilyResponse.results
    .map((result) => result.content)
    .join("\n");
}
