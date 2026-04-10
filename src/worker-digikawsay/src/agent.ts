import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

// ==========================================
// Base State for Digikawsay VAL Agent
// ==========================================
type AgentState = {
  messages: string[];
  emotion: string;
  urgency: string;
};

// Define initial state struct
const agentState = {
  messages: {
    value: (x: string[], y: string[]) => x.concat(y),
    default: () => [],
  },
  emotion: {
    value: (x: string, y: string) => y ?? x,
    default: () => "Neutral"
  },
  urgency: {
    value: (x: string, y: string) => y ?? x,
    default: () => "Low"
  }
};

// ==========================================
// Nodes
// ==========================================
async function preprocessNode(state: AgentState) {
  // Placeholder: call Gemini to extract sentiment and topic from last message
  console.log("Analyzing message...", state.messages[state.messages.length - 1]);
  return { emotion: "Curious" };
}

async function respondNode(state: AgentState) {
  // Placeholder: In real code, setup `new ChatGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY })`
  // and pass the conversation history.
  const aiResponse = "Este es un mensaje de prueba del agente VAL transpilado a JavaScript usando LangGraph.";
  return { messages: [aiResponse] };
}

// ==========================================
// LangGraph Workflow
// ==========================================
export function createValGraph() {
  const workflow = new StateGraph({ channels: agentState })
    .addNode("preprocess", preprocessNode)
    .addNode("respond", respondNode)
    .addEdge(START, "preprocess")
    .addEdge("preprocess", "respond")
    .addEdge("respond", END);

  // Use a MemorySaver. On Cloudflare Workers, a D1Saver or KV-backed memory would be used in prod.
  const memory = new MemorySaver();
  return workflow.compile({ checkpointer: memory });
}

// Helper to execute graph async from a Cloudflare Worker request or Queue
export async function runAgentCycle(input: string, threadId: string) {
  const graph = createValGraph();
  const result = await graph.invoke(
    { messages: [input] }, 
    { configurable: { thread_id: threadId } }
  );
  return result;
}
