// ── DigiKawsay Narrative Memory & Dialectic Strategy ───────────────────────
// Opción A: Replaces raw history with condensed semantic memory.
// Gives VAL arc-awareness and adaptive deepening strategies.
// 2026-05-03: Initial implementation

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";

// ── Types ──────────────────────────────────────────────────────────────────

export type DialecticStrategy =
  | 'GENTLE_PROVOCATION'   // 3+ REFLEXION_PASIVA → break narrative inertia
  | 'BRIDGE_TO_AGENCY'     // CATARSIS without PROPUESTA → connect emotion to action
  | 'NORMALIZE_PATTERN'    // GUARDED persistent → "others have mentioned..."
  | 'DEEPENING_LADDERING'  // Shallow responses → "¿Y eso por qué?"
  | 'SAFE_HARBOR'          // DISTRESSED → containment
  | 'ESPEJO_LIGERO'        // Every ~5 turns → inject group convergence
  | 'FREE_FLOW';           // Default — no forced strategy

export interface NarrativeMemory {
  summary: string;
  themes_explored: string[];
  themes_pending: string[];
  depth_trend: 'RISING' | 'FLAT' | 'DECLINING';
  strategy_history: string[];
  turn_at_summary: number;
}

export interface StrategyResult {
  strategy: DialecticStrategy;
  instruction: string;
  espejo_theme?: string; // Only for ESPEJO_LIGERO / NORMALIZE_PATTERN
}

interface TurnClassification {
  emotional_register: string;
  praxis_indicator: string;
  depth_score: number;
}

// ── Strategy Instructions ──────────────────────────────────────────────────

const STRATEGY_INSTRUCTIONS: Record<DialecticStrategy, string> = {
  GENTLE_PROVOCATION:
    'ESTRATEGIA: La conversación se ha mantenido descriptiva por varios turnos. ' +
    'Rompe la inercia con una observación que invite a profundizar: ' +
    '"Me llama la atención que describes todo como si fuera normal. ¿Siempre fue así?" o ' +
    '"¿Hay algo de todo esto que te gustaría que fuera diferente?"',

  BRIDGE_TO_AGENCY:
    'ESTRATEGIA: El participante ha expresado frustración sin llegar a propuestas. ' +
    'Construye un puente hacia la agencia: "Eso que describes suena pesado. ' +
    'Si pudieras cambiar UNA cosa mañana, por pequeña que fuera, ¿cuál sería?"',

  NORMALIZE_PATTERN:
    'ESTRATEGIA: El participante se muestra cauteloso. Normaliza compartiendo ' +
    'un patrón del grupo (sin nombres): "He escuchado a otros del equipo mencionar ' +
    'algo parecido sobre {THEME}. ¿Eso te resuena?"',

  DEEPENING_LADDERING:
    'ESTRATEGIA: Las respuestas han sido superficiales. Aplica laddering: ' +
    'toma lo último que dijo y pregunta "¿Y eso por qué importa?" o "¿Qué implica ' +
    'eso en tu día a día?". No hagas más de 2 niveles de profundización.',

  SAFE_HARBOR:
    'ESTRATEGIA: Se detectan señales de angustia severa. Suspende toda exploración. ' +
    'Acompaña con empatía genuina. No preguntes — solo valida: "Eso no es fácil de cargar. ' +
    'Gracias por compartirlo conmigo."',

  ESPEJO_LIGERO:
    'ESTRATEGIA: Es momento de activar El Espejo Ligero. Menciona un tema que otros ' +
    'del equipo también han señalado: "{THEME}". Pregunta si eso le resuena o si su ' +
    'experiencia es diferente.',

  FREE_FLOW:
    '', // No forced strategy — VAL operates with base prompt
};

// ── Core Functions ─────────────────────────────────────────────────────────

/**
 * Select the dialectic strategy based on accumulated classification history.
 */
export function selectDialecticStrategy(
  recentClassifications: TurnClassification[],
  turnCount: number,
  currentMemory: NarrativeMemory | null,
): DialecticStrategy {
  if (recentClassifications.length === 0) return 'FREE_FLOW';

  const last3 = recentClassifications.slice(-3);
  const last5 = recentClassifications.slice(-5);

  // Priority 1: DISTRESSED → always SAFE_HARBOR
  if (last3.some(c => c.emotional_register === 'DISTRESSED')) {
    return 'SAFE_HARBOR';
  }

  // Priority 2: Stagnation — 3+ consecutive REFLEXION_PASIVA with low depth
  const passiveStreak = last3.every(c => c.praxis_indicator === 'REFLEXION_PASIVA');
  const lowDepth = last3.every(c => c.depth_score < 40);
  if (passiveStreak && lowDepth) {
    return 'GENTLE_PROVOCATION';
  }

  // Priority 3: Shallow responses — depth_score < 30 for 2+ consecutive
  const last2 = recentClassifications.slice(-2);
  if (last2.length >= 2 && last2.every(c => c.depth_score < 30)) {
    return 'DEEPENING_LADDERING';
  }

  // Priority 4: Catharsis without action
  const catarsisCount = last5.filter(c => c.praxis_indicator === 'CATARSIS').length;
  const accionCount = last5.filter(c => c.praxis_indicator === 'PROPUESTA_ACCION').length;
  if (catarsisCount >= 3 && accionCount === 0) {
    return 'BRIDGE_TO_AGENCY';
  }

  // Priority 5: Persistent GUARDED
  const guardedCount = last5.filter(c => c.emotional_register === 'GUARDED').length;
  if (guardedCount >= 3) {
    return 'NORMALIZE_PATTERN';
  }

  // Priority 6: Espejo Ligero every ~5 turns (if not recently used)
  const recentStrategies = currentMemory?.strategy_history || [];
  const lastEspejo = recentStrategies.lastIndexOf('ESPEJO_LIGERO');
  const turnsSinceEspejo = lastEspejo >= 0 ? recentStrategies.length - lastEspejo : 999;
  if (turnCount >= 5 && turnsSinceEspejo >= 5) {
    return 'ESPEJO_LIGERO';
  }

  return 'FREE_FLOW';
}

/**
 * Build the strategy result with resolved instruction text.
 */
export function buildStrategyInstruction(
  strategy: DialecticStrategy,
  projectThemes: string[],
): StrategyResult {
  let instruction = STRATEGY_INSTRUCTIONS[strategy];
  let espejo_theme: string | undefined;

  // Resolve {THEME} placeholder for strategies that need group context
  if (
    (strategy === 'ESPEJO_LIGERO' || strategy === 'NORMALIZE_PATTERN') &&
    projectThemes.length > 0
  ) {
    // Pick a random theme from the project-level aggregation
    espejo_theme = projectThemes[Math.floor(Math.random() * projectThemes.length)];
    instruction = instruction.replace(/\{THEME\}/g, espejo_theme);
  }

  return { strategy, instruction, espejo_theme };
}

/**
 * Compute depth trend from recent depth_scores.
 */
export function computeDepthTrend(scores: number[]): 'RISING' | 'FLAT' | 'DECLINING' {
  if (scores.length < 3) return 'FLAT';
  const recent = scores.slice(-3);
  const older = scores.slice(-6, -3);
  if (older.length === 0) return 'FLAT';

  const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
  const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;
  const diff = avgRecent - avgOlder;

  if (diff > 10) return 'RISING';
  if (diff < -10) return 'DECLINING';
  return 'FLAT';
}

/**
 * Get aggregated themes from the project (saberes + structures) for Espejo Ligero.
 * Uses simple SQL aggregation — no vector search needed.
 */
export async function getProjectThemes(
  db: D1Database,
  projectId: string,
  excludeParticipantId: string,
): Promise<string[]> {
  try {
    const { results } = await db.prepare(
      `SELECT topics FROM dialogue_turns 
       WHERE project_id = ? AND participant_id != ? AND topics IS NOT NULL
       ORDER BY timestamp DESC LIMIT 50`
    ).bind(projectId, excludeParticipantId).all<{ topics: string }>();

    const themeSet = new Set<string>();
    for (const row of results) {
      try {
        const parsed = JSON.parse(row.topics);
        for (const s of (parsed.saberes_detectados || [])) themeSet.add(s);
        for (const s of (parsed.oppressive_structures || [])) themeSet.add(s);
      } catch { /* skip malformed */ }
    }
    return Array.from(themeSet);
  } catch {
    return [];
  }
}

/**
 * Load existing narrative memory from D1.
 */
export async function loadNarrativeMemory(
  db: D1Database,
  participantId: string,
  projectId: string,
): Promise<NarrativeMemory | null> {
  try {
    const row = await db.prepare(
      `SELECT summary, themes_explored, themes_pending, depth_trend, strategy_history, turn_at_summary
       FROM narrative_memory WHERE participant_id = ? AND project_id = ?`
    ).bind(participantId, projectId).first<{
      summary: string;
      themes_explored: string;
      themes_pending: string;
      depth_trend: string;
      strategy_history: string;
      turn_at_summary: number;
    }>();

    if (!row) return null;

    return {
      summary: row.summary,
      themes_explored: JSON.parse(row.themes_explored || '[]'),
      themes_pending: JSON.parse(row.themes_pending || '[]'),
      depth_trend: row.depth_trend as NarrativeMemory['depth_trend'],
      strategy_history: JSON.parse(row.strategy_history || '[]'),
      turn_at_summary: row.turn_at_summary,
    };
  } catch {
    return null;
  }
}

/**
 * Generate a condensed narrative summary using Gemini Flash.
 * Called every 4 turns — replaces raw history with semantic compression.
 */
export async function generateNarrativeSummary(
  history: Array<{ user_text: string; val_response: string; emotional_register?: string; depth_score?: number }>,
  previousSummary: string | null,
  geminiKey: string,
): Promise<{ summary: string; themes_explored: string[]; themes_pending: string[]; tokenUsage: any }> {
  const SUMMARY_PROMPT = `Eres un asistente de investigación cualitativa. Genera un resumen CONDENSADO (máximo 4 oraciones) de lo que este participante ha revelado en la conversación.

${previousSummary ? `RESUMEN ANTERIOR:\n${previousSummary}\n\n` : ''}ÚLTIMOS TURNOS:
${history.map((h, i) => `Participante: ${h.user_text}\nVAL: ${h.val_response}`).join('\n---\n')}

Responde con JSON válido:
{
  "summary": "Resumen condensado de 3-4 oraciones máximo. Incluye: qué ha revelado, cómo se siente (tendencia emocional), y qué temas tocó superficialmente.",
  "themes_explored": ["temas ya discutidos con profundidad"],
  "themes_pending": ["temas mencionados de pasada que merecen profundización"]
}`;

  try {
    const llm = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      apiKey: geminiKey,
      temperature: 0.2,
      maxOutputTokens: 300,
    });

    const result = await llm.invoke([new HumanMessage(SUMMARY_PROMPT)]);
    let raw = (result.content as string).trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) raw = jsonMatch[0];

    const parsed = JSON.parse(raw);
    return {
      summary: parsed.summary || '',
      themes_explored: Array.isArray(parsed.themes_explored) ? parsed.themes_explored : [],
      themes_pending: Array.isArray(parsed.themes_pending) ? parsed.themes_pending : [],
      tokenUsage: result.usage_metadata || result.response_metadata?.tokenUsage || null,
    };
  } catch {
    // Fallback: simple concatenation of key phrases
    const texts = history.map(h => h.user_text).join(' ');
    return {
      summary: texts.slice(0, 200) + '...',
      themes_explored: [],
      themes_pending: [],
      tokenUsage: null,
    };
  }
}

/**
 * Persist narrative memory to D1.
 */
export async function persistNarrativeMemory(
  db: D1Database,
  participantId: string,
  projectId: string,
  memory: NarrativeMemory,
): Promise<void> {
  await db.prepare(
    `INSERT INTO narrative_memory (participant_id, project_id, summary, themes_explored, themes_pending, depth_trend, strategy_history, turn_at_summary, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(participant_id, project_id) DO UPDATE SET
       summary = excluded.summary,
       themes_explored = excluded.themes_explored,
       themes_pending = excluded.themes_pending,
       depth_trend = excluded.depth_trend,
       strategy_history = excluded.strategy_history,
       turn_at_summary = excluded.turn_at_summary,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(
    participantId, projectId,
    memory.summary,
    JSON.stringify(memory.themes_explored),
    JSON.stringify(memory.themes_pending),
    memory.depth_trend,
    JSON.stringify(memory.strategy_history.slice(-10)), // Keep last 10
    memory.turn_at_summary,
  ).run();
}

/**
 * Load recent classifications from dialogue_turns for strategy selection.
 */
export async function loadRecentClassifications(
  db: D1Database,
  participantId: string,
  projectId: string,
  limit: number = 6,
): Promise<TurnClassification[]> {
  try {
    const { results } = await db.prepare(
      `SELECT emotional_register, speech_act, depth_score 
       FROM dialogue_turns 
       WHERE participant_id = ? AND project_id = ?
       ORDER BY timestamp DESC LIMIT ?`
    ).bind(participantId, projectId, limit).all<{
      emotional_register: string;
      speech_act: string;
      depth_score: number;
    }>();

    return (results || []).reverse().map(r => ({
      emotional_register: r.emotional_register || 'NEUTRAL',
      praxis_indicator: r.speech_act || 'REFLEXION_PASIVA',
      depth_score: r.depth_score || 0,
    }));
  } catch {
    return [];
  }
}
