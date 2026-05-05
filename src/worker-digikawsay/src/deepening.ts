// ── DigiKawsay AG-05 Co-Pilot: Real-Time Deepening ─────────────────────────
// Opción B: AG-05 as a co-pilot that generates auto-directives
// when it detects deepening opportunities.
// 2026-05-03: Initial implementation

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import type { NarrativeMemory } from './narrative';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CopilotDirective {
  content: string;
  reason: string;
  tokenUsage: any;
}

// ── Activation Logic ───────────────────────────────────────────────────────

/**
 * Decide if the AG-05 co-pilot should activate on this turn.
 * Returns true only when intervention would add value without excess cost.
 */
export function shouldActivateCopilot(
  turnCount: number,
  depthScore: number,
  previousDepthScore: number | null,
  currentPhase: string,
  hasPendingHumanDirective: boolean,
): boolean {
  // Never activate if there's a human directive pending — human has priority
  if (hasPendingHumanDirective) return false;

  // Never activate in CLOSED phase
  if (currentPhase === 'CLOSED') return false;

  // Don't activate in the first 3 turns — let rapport build
  if (turnCount < 4) return false;

  // Activate every 4 turns as a periodic check
  if (turnCount % 4 === 0) return true;

  // Activate on stagnation: 2 consecutive low depth scores
  if (
    previousDepthScore !== null &&
    previousDepthScore < 30 &&
    depthScore < 30
  ) {
    return true;
  }

  return false;
}

// ── Directive Generation ───────────────────────────────────────────────────

const COPILOT_PROMPT = `Eres el co-piloto analítico de VAL (agente facilitador de investigación organizacional).

Tu tarea: genera UNA directiva breve (1-2 oraciones) para que VAL profundice en su próximo turno con este participante.

CONTEXTO:
- Resumen narrativo: {NARRATIVE}
- Último mensaje del participante: {LAST_USER_TEXT}
- Clasificación: emoción={EMOTION} / praxis={PRAXIS} / profundidad={DEPTH}/100
- Fase actual: {PHASE}
- Temas no explorados: {UNEXPLORED}

REGLAS para la directiva:
1. Debe ser una instrucción CONCRETA para VAL, no una reflexión teórica
2. Debe anclarse en algo ESPECÍFICO que el participante dijo
3. NO repetir preguntas que VAL ya hizo
4. Si la profundidad es baja, la directiva debe romper la superficialidad
5. Si hay saberes no explorados, prioriza profundizar en ellos

Responde SOLO con JSON:
{"directive": "texto de la directiva", "reason": "por qué esta directiva ahora"}`;

/**
 * Generate a deepening auto-directive using Gemini Flash.
 * Cost: ~500 prompt + ~100 completion tokens.
 */
export async function generateDeepeningDirective(
  narrativeSummary: string,
  lastUserText: string,
  emotion: string,
  praxis: string,
  depthScore: number,
  currentPhase: string,
  unexploredThemes: string[],
  geminiKey: string,
): Promise<CopilotDirective> {
  const prompt = COPILOT_PROMPT
    .replace('{NARRATIVE}', narrativeSummary || 'Sin resumen aún')
    .replace('{LAST_USER_TEXT}', lastUserText.slice(0, 300))
    .replace('{EMOTION}', emotion)
    .replace('{PRAXIS}', praxis)
    .replace('{DEPTH}', String(Math.round(depthScore)))
    .replace('{PHASE}', currentPhase)
    .replace('{UNEXPLORED}', unexploredThemes.length > 0 ? unexploredThemes.join(', ') : 'ninguno identificado');

  try {
    const llm = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      apiKey: geminiKey,
      temperature: 0.3,
      maxOutputTokens: 150,
    });

    const result = await llm.invoke([new HumanMessage(prompt)]);
    let raw = (result.content as string).trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) raw = jsonMatch[0];

    const parsed = JSON.parse(raw);
    return {
      content: parsed.directive || 'Profundiza en lo último que mencionó el participante.',
      reason: parsed.reason || 'auto-generated',
      tokenUsage: result.usage_metadata || result.response_metadata?.tokenUsage || null,
    };
  } catch (err: any) {
    console.error('[AG-05 Copilot] Generation error:', err.message);
    return {
      content: 'Pide al participante un ejemplo concreto de lo último que mencionó.',
      reason: 'fallback — LLM error',
      tokenUsage: null,
    };
  }
}

/**
 * Insert an auto-directive into wizard_directives table.
 * Marked as issued_by='ag05_copilot' to differentiate from human directives.
 */
export async function insertAutoDirective(
  db: D1Database,
  participantId: string,
  projectId: string,
  directive: CopilotDirective,
): Promise<string> {
  const directiveId = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO wizard_directives (id, participant_id, project_id, content, urgency, status, issued_by, effect_summary)
     VALUES (?, ?, ?, ?, 'AUTO', 'PENDING', 'ag05_copilot', ?)`
  ).bind(
    directiveId,
    participantId,
    projectId,
    directive.content,
    directive.reason,
  ).run();

  console.log(`[AG-05 Copilot] Auto-directive ${directiveId.substring(0, 8)} created for ${participantId.substring(0, 8)}`);
  return directiveId;
}
