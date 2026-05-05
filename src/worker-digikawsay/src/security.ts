// ── DigiKawsay Security Module ─────────────────────────────────────────────
// Centralized defense layer against prompt injection, abuse, and unauthorized access.
// 2026-05-03: Initial implementation — prompt injection detection, rate limiting, audit logging

// ── Types ──────────────────────────────────────────────────────────────────

export type ThreatType =
  | 'NONE'
  | 'PROMPT_INJECTION'
  | 'JAILBREAK_ATTEMPT'
  | 'ROLE_SWITCHING'
  | 'SYSTEM_PROBE'
  | 'EXCESSIVE_LENGTH'
  | 'SUSPICIOUS_STRUCTURE';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ActionTaken = 'ALLOWED' | 'FLAGGED' | 'BLOCKED' | 'RATE_LIMITED';

export interface ThreatAssessment {
  score: number;        // 0-100
  threat_type: ThreatType;
  severity: Severity;
  details: string;
}

export interface SanitizedInput {
  clean: string;
  flagged: boolean;
  threat: ThreatAssessment;
  original_length: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_after_seconds: number;
  message?: string;
}

export interface SecurityEvent {
  event_type: string;
  participant_id?: string;
  severity: Severity;
  details: string;
  user_input_hash?: string;
  action_taken: ActionTaken;
}

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_INPUT_LENGTH = 1500;
const RATE_LIMIT_MINUTE = 20;
const RATE_LIMIT_HOUR = 100;

// Patterns ordered by severity (most dangerous first)
const INJECTION_PATTERNS: Array<{ pattern: RegExp; type: ThreatType; score: number; label: string }> = [
  // ── CRITICAL: Direct role/instruction override ──
  { pattern: /ignor[ae]\s+(las\s+)?instrucciones?\s+(anteriores|previas)/i, type: 'PROMPT_INJECTION', score: 95, label: 'ignore_instructions_es' },
  { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i, type: 'PROMPT_INJECTION', score: 95, label: 'ignore_instructions_en' },
  { pattern: /forget\s+(everything|all)\s+(you\s+)?(know|were\s+told|learned)/i, type: 'PROMPT_INJECTION', score: 90, label: 'forget_everything' },
  { pattern: /olvida\s+(todo|tus\s+instrucciones|lo\s+anterior)/i, type: 'PROMPT_INJECTION', score: 90, label: 'forget_everything_es' },
  { pattern: /you\s+are\s+now\s+/i, type: 'ROLE_SWITCHING', score: 90, label: 'you_are_now' },
  { pattern: /ahora\s+eres\s+/i, type: 'ROLE_SWITCHING', score: 90, label: 'ahora_eres' },
  { pattern: /act(ua|úa)?\s+(como|as)\s+/i, type: 'ROLE_SWITCHING', score: 85, label: 'act_as' },
  { pattern: /pretend\s+(to\s+be|you\s+are)/i, type: 'ROLE_SWITCHING', score: 85, label: 'pretend_to_be' },
  { pattern: /finge\s+ser|hazte\s+pasar\s+por/i, type: 'ROLE_SWITCHING', score: 85, label: 'finge_ser' },
  { pattern: /new\s+instructions?:|nuevas?\s+instrucciones?:/i, type: 'PROMPT_INJECTION', score: 90, label: 'new_instructions' },
  { pattern: /override\s+(your\s+)?(instructions?|programming|rules)/i, type: 'PROMPT_INJECTION', score: 90, label: 'override' },

  // ── HIGH: System prompt extraction ──
  { pattern: /\b(system\s*prompt|system\s*message|system\s*instruction)/i, type: 'SYSTEM_PROBE', score: 80, label: 'system_prompt_ref' },
  { pattern: /cu[aá]l\s+es\s+tu\s+(prompt|instruc)/i, type: 'SYSTEM_PROBE', score: 80, label: 'whats_your_prompt_es' },
  { pattern: /what\s+(is|are)\s+your\s+(instructions?|prompt|rules|system)/i, type: 'SYSTEM_PROBE', score: 80, label: 'whats_your_prompt_en' },
  { pattern: /mu[eé]strame\s+tu\s+(prompt|instruc|configuraci)/i, type: 'SYSTEM_PROBE', score: 80, label: 'show_prompt_es' },
  { pattern: /show\s+(me\s+)?your\s+(prompt|instructions|rules|config)/i, type: 'SYSTEM_PROBE', score: 80, label: 'show_prompt_en' },
  { pattern: /reveal\s+(your\s+)?(hidden|secret|internal|system)/i, type: 'SYSTEM_PROBE', score: 75, label: 'reveal_hidden' },
  { pattern: /revela\s+(tus?\s+)?(instrucciones|directivas|sistema)/i, type: 'SYSTEM_PROBE', score: 75, label: 'revela_sistema' },
  { pattern: /repite\s+(tu\s+)?(prompt|instrucciones|todo\s+lo\s+que\s+te\s+dijeron)/i, type: 'SYSTEM_PROBE', score: 85, label: 'repeat_prompt_es' },
  { pattern: /repeat\s+(your\s+)?(prompt|instructions|everything)/i, type: 'SYSTEM_PROBE', score: 85, label: 'repeat_prompt_en' },

  // ── MEDIUM: Delimiter/structural injection ──
  { pattern: /<<<|>>>|\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/i, type: 'PROMPT_INJECTION', score: 85, label: 'llm_delimiters' },
  { pattern: /<\/?system>|<\/?user>|<\/?assistant>/i, type: 'PROMPT_INJECTION', score: 85, label: 'xml_role_tags' },
  { pattern: /```(system|instructions?|prompt|python|javascript|sql)/i, type: 'SUSPICIOUS_STRUCTURE', score: 65, label: 'code_block_injection' },
  { pattern: /\bDAN\b.*mode|do\s+anything\s+now/i, type: 'JAILBREAK_ATTEMPT', score: 90, label: 'dan_mode' },
  { pattern: /\bjailbreak/i, type: 'JAILBREAK_ATTEMPT', score: 70, label: 'jailbreak_keyword' },

  // ── MEDIUM: Technical command injection ──
  { pattern: /\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)\s+(FROM|INTO|TABLE)/i, type: 'SUSPICIOUS_STRUCTURE', score: 60, label: 'sql_keywords' },
  { pattern: /\b(eval|exec|import\s+os|subprocess|__import__)/i, type: 'SUSPICIOUS_STRUCTURE', score: 60, label: 'code_exec_keywords' },
  { pattern: /\b(fetch|XMLHttpRequest|require\(|import\s*\()/i, type: 'SUSPICIOUS_STRUCTURE', score: 50, label: 'network_keywords' },
];

// ── Core Functions ─────────────────────────────────────────────────────────

/**
 * Detect prompt injection patterns in user text.
 * Returns a ThreatAssessment with score 0-100.
 */
export function detectPromptInjection(text: string): ThreatAssessment {
  if (!text || text.trim().length === 0) {
    return { score: 0, threat_type: 'NONE', severity: 'LOW', details: '' };
  }

  let maxScore = 0;
  let maxType: ThreatType = 'NONE';
  let matchedLabels: string[] = [];

  // Layer 1: Regex pattern matching
  for (const { pattern, type, score, label } of INJECTION_PATTERNS) {
    if (pattern && pattern.test(text)) {
      matchedLabels.push(label);
      if (score > maxScore) {
        maxScore = score;
        maxType = type;
      }
    }
  }

  // Layer 2: Structural analysis
  const specialCharRatio = (text.replace(/[a-záéíóúñü\s.,;:!?¿¡0-9]/gi, '').length) / Math.max(text.length, 1);
  if (specialCharRatio > 0.3 && text.length > 50) {
    const structScore = Math.min(60, Math.round(specialCharRatio * 100));
    if (structScore > maxScore) {
      maxScore = structScore;
      maxType = 'SUSPICIOUS_STRUCTURE';
      matchedLabels.push('high_special_char_ratio');
    }
  }

  // Layer 3: Excessive length (possible payload stuffing)
  if (text.length > 2000) {
    const lenScore = Math.min(50, Math.round((text.length - 2000) / 100) + 30);
    if (lenScore > maxScore) {
      maxScore = lenScore;
      maxType = 'EXCESSIVE_LENGTH';
      matchedLabels.push('excessive_length');
    }
  }

  // Multiple weak signals compound into stronger signal
  if (matchedLabels.length >= 3 && maxScore < 80) {
    maxScore = Math.min(80, maxScore + matchedLabels.length * 10);
  }

  const severity: Severity = maxScore >= 80 ? 'CRITICAL'
    : maxScore >= 60 ? 'HIGH'
    : maxScore >= 40 ? 'MEDIUM'
    : 'LOW';

  return {
    score: maxScore,
    threat_type: maxType,
    severity,
    details: matchedLabels.length > 0 ? `Matched: ${matchedLabels.join(', ')}` : '',
  };
}

/**
 * Sanitize user input: truncate, detect injection, return clean version.
 */
export function sanitizeUserInput(text: string): SanitizedInput {
  const originalLength = text.length;

  // Truncate to prevent payload stuffing
  let clean = text.slice(0, MAX_INPUT_LENGTH);

  // Strip invisible/control characters (keep normal whitespace)
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B-\u200F\u2028-\u202F\uFEFF]/g, '');

  // Strip Unicode homoglyph abuse (Cyrillic lookalikes commonly used to bypass filters)
  clean = clean.replace(/[\u0400-\u04FF]/g, (ch) => {
    const homoglyphs: Record<string, string> = {
      'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y',
      'А': 'A', 'Е': 'E', 'О': 'O', 'Р': 'P', 'С': 'C', 'У': 'Y',
    };
    return homoglyphs[ch] || ch;
  });

  const threat = detectPromptInjection(clean);

  return {
    clean,
    flagged: threat.score >= 40,
    threat,
    original_length: originalLength,
  };
}

/**
 * Rate limiter: checks if a participant has exceeded message limits.
 * Uses D1 security_events table for persistence.
 */
export async function checkRateLimit(
  participantId: string,
  db: D1Database
): Promise<RateLimitResult> {
  try {
    // Count messages in the last minute
    const minuteCount = await db.prepare(
      `SELECT COUNT(*) as c FROM security_events
       WHERE participant_id = ? AND event_type = 'MESSAGE'
       AND created_at > datetime('now', '-1 minute')`
    ).bind(participantId).first<{ c: number }>();

    const minuteMessages = minuteCount?.c ?? 0;
    if (minuteMessages >= RATE_LIMIT_MINUTE) {
      return {
        allowed: false,
        remaining: 0,
        reset_after_seconds: 60,
        message: 'Dame un momento para procesar lo que me has dicho. Escríbeme en un minuto.',
      };
    }

    // Count messages in the last hour
    const hourCount = await db.prepare(
      `SELECT COUNT(*) as c FROM security_events
       WHERE participant_id = ? AND event_type = 'MESSAGE'
       AND created_at > datetime('now', '-1 hour')`
    ).bind(participantId).first<{ c: number }>();

    const hourMessages = hourCount?.c ?? 0;
    if (hourMessages >= RATE_LIMIT_HOUR) {
      return {
        allowed: false,
        remaining: 0,
        reset_after_seconds: 3600,
        message: 'Hemos tenido una conversación intensa. Tomemos una pausa y retomamos en un rato.',
      };
    }

    // Log this message for rate limiting
    await db.prepare(
      `INSERT INTO security_events (event_id, event_type, participant_id, severity, action_taken, created_at)
       VALUES (?, 'MESSAGE', ?, 'LOW', 'ALLOWED', datetime('now'))`
    ).bind(crypto.randomUUID(), participantId).run();

    return {
      allowed: true,
      remaining: Math.min(RATE_LIMIT_MINUTE - minuteMessages - 1, RATE_LIMIT_HOUR - hourMessages - 1),
      reset_after_seconds: 0,
    };
  } catch (err) {
    // If security_events table doesn't exist yet, allow through (graceful degradation)
    console.error('[RateLimit] Error checking rate limit:', err);
    return { allowed: true, remaining: 999, reset_after_seconds: 0 };
  }
}

/**
 * Check login brute force protection.
 * Max 5 failed attempts per username in 15 minutes.
 */
export async function checkLoginRateLimit(
  username: string,
  db: D1Database
): Promise<{ allowed: boolean; remaining_attempts: number }> {
  try {
    const count = await db.prepare(
      `SELECT COUNT(*) as c FROM security_events
       WHERE event_type = 'AUTH_FAILURE' AND details LIKE ?
       AND created_at > datetime('now', '-15 minutes')`
    ).bind(`%"username":"${username}"%`).first<{ c: number }>();

    const attempts = count?.c ?? 0;
    return {
      allowed: attempts < 5,
      remaining_attempts: Math.max(0, 5 - attempts),
    };
  } catch {
    return { allowed: true, remaining_attempts: 5 };
  }
}

/**
 * Log a security event to D1 for audit trail.
 */
export async function logSecurityEvent(
  db: D1Database,
  event: SecurityEvent
): Promise<void> {
  try {
    const eventId = crypto.randomUUID();
    const inputHash = event.user_input_hash || null;

    await db.prepare(
      `INSERT INTO security_events (event_id, event_type, participant_id, severity, details, user_input_hash, action_taken, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      eventId,
      event.event_type,
      event.participant_id || null,
      event.severity,
      event.details,
      inputHash,
      event.action_taken,
    ).run();
  } catch (err) {
    console.error('[Security] Failed to log event:', err);
  }
}

/**
 * Compute SHA-256 hash of input text for audit logging (never store raw payloads).
 */
export async function hashInput(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate Telegram webhook secret token.
 * Telegram sends the secret in X-Telegram-Bot-Api-Secret-Token header.
 */
export function validateWebhookSecret(
  requestHeader: string | null | undefined,
  expectedSecret: string | null | undefined
): boolean {
  // If no secret configured, skip validation (backwards compatible)
  if (!expectedSecret) return true;
  if (!requestHeader) return false;

  // Timing-safe comparison
  if (requestHeader.length !== expectedSecret.length) return false;
  let mismatch = 0;
  for (let i = 0; i < requestHeader.length; i++) {
    mismatch |= requestHeader.charCodeAt(i) ^ expectedSecret.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Check if VAL's response accidentally leaks system prompt content.
 * Returns true if a leak is detected.
 */
export function detectOutputLeak(response: string): boolean {
  const leakIndicators = [
    'VAL_BASE_PROMPT',
    'REGLAS INVIOLABLES',
    'PROHIBICIONES ABSOLUTAS',
    'TIPO A — PREGUNTA SITUACIONAL',
    'TIPO B — OBSERVACIÓN',
    'TIPO C — VALIDACIÓN SILENCIOSA',
    'FOCO PARA ESTE TURNO',
    'NOTIFICACIÓN DE SISTEMA INVISIBLE',
    'DEFENSA ANTI-MANIPULACIÓN',
    'SEED_PROMPT',
    'wizard_directives',
    'agente00-service',
    'DigiKawsayState',
    'LangGraph',
    'system prompt',
    'prompt injection',
    'gemini-2.5-flash',
  ];

  const lower = response.toLowerCase();
  for (const indicator of leakIndicators) {
    if (lower.includes(indicator.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * Fallback response when a threat is detected — sounds natural, not alarming.
 */
export const SAFE_FALLBACK_RESPONSE = 
  'Entiendo lo que me dices. Me interesa más saber sobre tu experiencia directa en el trabajo — ' +
  '¿qué fue lo último que te pasó en la semana que te hizo pensar "esto podría funcionar mejor"?';

/**
 * Response for rate-limited users — natural, not robotic.
 */
export const RATE_LIMIT_RESPONSE = 
  'Dame un momento para procesar todo lo que me has contado. Escríbeme en unos minutos, estaré aquí.';
