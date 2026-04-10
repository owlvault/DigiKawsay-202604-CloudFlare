import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

export async function runAgentCycle(input: string, threadId: string, geminiKey: string): Promise<string> {
  if (!geminiKey) {
    return "Error: GEMINI_API_KEY no está configurada en los secretos del sistema.";
  }

  try {
    const llm = new ChatGoogleGenerativeAI({
      modelName: "gemini-2.5-flash",
      apiKey: geminiKey,
      temperature: 0.7,
      maxOutputTokens: 300,
    });

    const sysPrompt = 
      "Eres VAL (Vanguardia de Asistencia Lógica), el agente facilitador " +
      "empático de la plataforma DigiKawsay. Recibes a los usuarios con " +
      "calidez y guías su participación. Mantén tus respuestas conversacionales y no " +
      "muy largas.";

    console.log(`[Agent VAL] Invocando LLM para el thread: ${threadId}`);
    
    // Invocación a Gemini
    const response = await llm.invoke([
      ["system", sysPrompt],
      ["human", input]
    ]);

    return response.content as string;
  } catch (error: any) {
    console.error("[Agent VAL] Error invocando Gemini:", error);
    return `Error procesando cognitivamente: ${error.message}`;
  }
}
