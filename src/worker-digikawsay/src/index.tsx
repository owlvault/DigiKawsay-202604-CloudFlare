import { Hono } from 'hono';
import { getSignedCookie, setSignedCookie, deleteCookie } from 'hono/cookie';
import { runAgentCycle, generateSynthesisReportStream, designPilot, runProactiveAgentCycle } from './agent';
import { hashPassword, verifyPassword } from './auth';
import { LoginView, SetupAdminView, LobbyView, DashboardView, WozView, AnalyticsView, TuningView, BillingView, SecurityView } from './ui';
import { sanitizeUserInput, validateWebhookSecret, checkRateLimit, checkLoginRateLimit, logSecurityEvent, hashInput, SAFE_FALLBACK_RESPONSE, RATE_LIMIT_RESPONSE } from './security';
import { shouldActivateCopilot, generateDeepeningDirective, insertAutoDirective } from './deepening';
import { loadNarrativeMemory } from './narrative';

type Bindings = {
  DB: D1Database;
  GCP_PROJECT_ID: string;
  GCP_PUBSUB_TOPIC_INBOUND: string;
  TELEGRAM_BOT_TOKEN: string;
  GEMINI_API_KEY: string;
  AG05_SERVICE_URL?: string;
  WEBHOOK_SECRET?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// ── Admin Identity Middleware ──────────────────────────────────────────────

app.use('/admin/*', async (c, next) => {
  const path = c.req.path;
  if (path === '/admin/login' || path === '/admin/login_web' || path === '/admin/setup' || path === '/admin/setup_web') {
    return next();
  }

  const { c: cCount } = await c.env.DB.prepare(`SELECT count(*) as c FROM administrators`).first<{c: number}>() || {c: 0};
  if (cCount === 0) {
    return c.redirect('/admin/setup');
  }

  const secret = c.env.GEMINI_API_KEY || 'digi_secret';
  const identity = await getSignedCookie(c, secret, 'dk_session');
  if (!identity) {
    return c.redirect('/admin/login');
  }

  const adminObj = await c.env.DB.prepare(`SELECT admin_id, username, role, tenant_id FROM administrators WHERE username = ?`).bind(identity).first<{admin_id: string, username: string, role: string, tenant_id: string}>();
  if (!adminObj) {
    return c.redirect('/admin/logout');
  }

  c.set('adminUser', adminObj);
  await next();
});

// ── Auth Endpoints ─────────────────────────────────────────────────────────

app.get('/admin/setup', async (c) => {
  const { c: cCount } = await c.env.DB.prepare(`SELECT count(*) as c FROM administrators`).first<{c: number}>() || {c: 0};
  if (cCount > 0) return c.redirect('/admin/login');
  return c.html(<SetupAdminView />);
});

app.post('/admin/setup_web', async (c) => {
  const body = await c.req.parseBody();
  const username = String(body.username);
  const password = String(body.password);
  
  if (password.length < 8) return c.text('La contraseña debe tener al menos 8 caracteres', 400);

  const hash = await hashPassword(password);

  // Asegurar que exista un tenant por defecto para el superadmin
  const defaultTenantId = 'digikawsay_global';
  await c.env.DB.prepare(`INSERT OR IGNORE INTO tenants (tenant_id, name) VALUES (?, ?)`).bind(defaultTenantId, 'DigiKawsay Global').run();

  await c.env.DB.prepare(
    `INSERT INTO administrators (admin_id, tenant_id, username, password_hash, role) VALUES (hex(randomblob(16)), ?, ?, ?, 'SUPERADMIN')`
  ).bind(defaultTenantId, username, hash).run();

  return c.redirect('/admin/login');
});

app.get('/admin/login', async (c) => {
  const error = c.req.query('error');
  return c.html(<LoginView error={error === '1' ? 'Credenciales incorrectas o usuario no encontrado.' : undefined} />);
});

app.post('/admin/login_web', async (c) => {
  const body = await c.req.parseBody();
  const username = String(body.username);
  const pass = String(body.password);

  // ── Security: Brute force protection ──────────────────────────────────
  const loginCheck = await checkLoginRateLimit(username, c.env.DB);
  if (!loginCheck.allowed) {
    await logSecurityEvent(c.env.DB, {
      event_type: 'AUTH_LOCKOUT',
      severity: 'HIGH',
      details: JSON.stringify({ username, reason: 'brute_force_lockout' }),
      action_taken: 'BLOCKED',
    });
    return c.redirect('/admin/login?error=1');
  }

  const admin = await c.env.DB.prepare(`SELECT password_hash FROM administrators WHERE username = ?`).bind(username).first<{password_hash: string}>();
  if (!admin) {
    await logSecurityEvent(c.env.DB, {
      event_type: 'AUTH_FAILURE',
      severity: 'MEDIUM',
      details: JSON.stringify({ username, reason: 'user_not_found' }),
      action_taken: 'BLOCKED',
    });
    return c.redirect('/admin/login?error=1');
  }

  const isValid = await verifyPassword(pass, admin.password_hash);
  if (!isValid) {
    await logSecurityEvent(c.env.DB, {
      event_type: 'AUTH_FAILURE',
      severity: 'MEDIUM',
      details: JSON.stringify({ username, reason: 'wrong_password' }),
      action_taken: 'BLOCKED',
    });
    return c.redirect('/admin/login?error=1');
  }

  const secret = c.env.GEMINI_API_KEY || 'digi_secret';
  await setSignedCookie(c, 'dk_session', username, secret, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    maxAge: 60 * 60 * 24 * 7 // 7 days
  });

  return c.redirect('/admin/lobby');
});

app.get('/admin/logout', async (c) => {
  deleteCookie(c, 'dk_session', { path: '/' });
  return c.redirect('/admin/login');
});

// ── Billing & Quotas ───────────────────────────────────────────────────────

async function checkQuota(db: D1Database, tenantId: string, projectId: string): Promise<boolean> {
  // Check tenant
  const tq = await db.prepare(`SELECT max_tokens_monthly, used_tokens_monthly, cutoff_active FROM tenant_quotas WHERE tenant_id = ?`).bind(tenantId).first<{max_tokens_monthly: number, used_tokens_monthly: number, cutoff_active: number}>();
  if (tq && (tq.cutoff_active === 1 || tq.used_tokens_monthly >= tq.max_tokens_monthly)) return false;
  
  // Check project
  const pq = await db.prepare(`SELECT max_tokens, used_tokens, cutoff_active FROM project_quotas WHERE project_id = ?`).bind(projectId).first<{max_tokens: number, used_tokens: number, cutoff_active: number}>();
  if (pq && (pq.cutoff_active === 1 || pq.used_tokens >= pq.max_tokens)) return false;
  
  return true;
}

async function recordUsage(db: D1Database, tenantId: string, projectId: string, operation: string, usage: any) {
  if (!usage) return;
  const promptTokens = usage.promptTokens || 0;
  const compTokens = usage.completionTokens || 0;
  const totalTokens = usage.totalTokens || (promptTokens + compTokens);
  
  if (totalTokens === 0) return;

  await db.prepare(`INSERT INTO usage_logs (tenant_id, project_id, operation_type, tokens_prompt, tokens_completion, tokens_total) VALUES (?, ?, ?, ?, ?, ?)`).bind(tenantId, projectId, operation, promptTokens, compTokens, totalTokens).run();
  
  // Create quotas if they don't exist
  await db.prepare(`INSERT OR IGNORE INTO tenant_quotas (tenant_id, max_tokens_monthly) VALUES (?, 1000000)`).bind(tenantId).run();
  await db.prepare(`INSERT OR IGNORE INTO project_quotas (project_id, max_tokens) VALUES (?, 500000)`).bind(projectId).run();

  await db.prepare(`UPDATE tenant_quotas SET used_tokens_monthly = used_tokens_monthly + ? WHERE tenant_id = ?`).bind(totalTokens, tenantId).run();
  await db.prepare(`UPDATE project_quotas SET used_tokens = used_tokens + ? WHERE project_id = ?`).bind(totalTokens, projectId).run();
}

// ── Webhooks & API Publicas ────────────────────────────────────────────────────────────────

async function sendTelegram(token: string, chatId: number | string, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

const CONSENT_MESSAGE =
  "Hola, soy VAL.\n\n" +
  "Vamos a tener unas conversaciones cortas sobre cómo es el trabajo real en tu equipo — " +
  "no lo que debería ser según el manual, sino cómo funciona en el día a día.\n\n" +
  "No hay respuestas correctas. No tomo nota de quién eres — todo queda anonimizado. " +
  "Esto toma entre 10 y 20 minutos repartidos en varios días, a tu ritmo.\n\n" +
  "Lo que cuentes contribuye a identificar qué mejorar en el equipo, " +
  "y los hallazgos se comparten colectivamente.\n\n" +
  "¿Por dónde empezamos? Cuéntame de algo que haya pasado esta semana en el trabajo — " +
  "algo que fluyó bien o algo que se trabó.";

const UNKNOWN_USER_MESSAGE =
  "Para participar necesitas un enlace de invitación de tu facilitador. " +
  "Si ya tienes uno, úsalo para iniciar la conversación.";

// ── Middleware ─────────────────────────────────────────────────────────────

app.onError((err, c) => {
  console.error(`Error: ${err}`);
  return c.json({ status: "error", detail: err.message }, 500);
});

// ── Public ─────────────────────────────────────────────────────────────────

app.get('/', (c) => c.redirect('/admin/lobby'));

app.get('/health', (c) =>
  c.json({ status: "healthy", service: "digikawsay-cf-worker", version: "3.1.0" })
);

// ── Telegram Webhook ───────────────────────────────────────────────────────

app.post('/webhook', async (c) => {
  // ── Security: Validate Telegram webhook secret ──────────────────────────
  const secretHeader = c.req.header('X-Telegram-Bot-Api-Secret-Token');
  if (!validateWebhookSecret(secretHeader, c.env.WEBHOOK_SECRET)) {
    console.warn('[SECURITY] Webhook request with invalid secret token');
    await logSecurityEvent(c.env.DB, {
      event_type: 'WEBHOOK_INVALID',
      severity: 'HIGH',
      details: JSON.stringify({ ip: c.req.header('cf-connecting-ip') || 'unknown' }),
      action_taken: 'BLOCKED',
    });
    return c.json({ status: 'unauthorized' }, 403);
  }

  const payload = await c.req.json();
  if (!payload?.message) return c.json({ status: "ignored" });

  const text: string = payload.message?.text;
  const chatId: number = payload.message?.chat?.id;
  if (!text || !chatId) return c.json({ status: "ignored" });

  // ── Security: Rate limiting ────────────────────────────────────────────
  const rateResult = await checkRateLimit(String(chatId), c.env.DB);
  if (!rateResult.allowed) {
    await sendTelegram(c.env.TELEGRAM_BOT_TOKEN, chatId, rateResult.message || RATE_LIMIT_RESPONSE);
    return c.json({ status: "rate_limited" });
  }

  // ── Security: Prompt injection detection ────────────────────────────────
  const sanitized = sanitizeUserInput(text);
  if (sanitized.threat.score >= 70) {
    // HIGH/CRITICAL threat — block and log
    const inputHash = await hashInput(text);
    await logSecurityEvent(c.env.DB, {
      event_type: sanitized.threat.threat_type,
      participant_id: String(chatId),
      severity: sanitized.threat.severity,
      details: JSON.stringify({ score: sanitized.threat.score, matched: sanitized.threat.details, original_length: sanitized.original_length }),
      user_input_hash: inputHash,
      action_taken: 'BLOCKED',
    });
    await sendTelegram(c.env.TELEGRAM_BOT_TOKEN, chatId, SAFE_FALLBACK_RESPONSE);
    console.warn(`[SECURITY] Blocked ${sanitized.threat.threat_type} from chat ${chatId} (score: ${sanitized.threat.score})`);
    return c.json({ status: "blocked" });
  }

  if (sanitized.flagged) {
    // MEDIUM threat — allow but flag for audit
    const inputHash = await hashInput(text);
    c.executionCtx.waitUntil(
      logSecurityEvent(c.env.DB, {
        event_type: sanitized.threat.threat_type,
        participant_id: String(chatId),
        severity: sanitized.threat.severity,
        details: JSON.stringify({ score: sanitized.threat.score, matched: sanitized.threat.details }),
        user_input_hash: inputHash,
        action_taken: 'FLAGGED',
      })
    );
  }

  c.executionCtx.waitUntil(handleMessage(sanitized.clean, chatId, c.env));
  return c.json({ status: "ok" });
});

async function handleMessage(text: string, chatId: number, env: Bindings): Promise<void> {
  const db = env.DB;
  const strChatId = String(chatId);

  try {
    // ── /start <invite_token> ────────────────────────────────────────────
    if (text.startsWith("/start")) {
      const token = text.split(" ")[1]?.trim();
      if (!token) {
        await sendTelegram(env.TELEGRAM_BOT_TOKEN, chatId, UNKNOWN_USER_MESSAGE);
        return;
      }

      const updated = await db.prepare(
        `UPDATE participants
         SET participant_id = ?, first_message_at = CURRENT_TIMESTAMP, status = 'active'
         WHERE invite_token = ? AND participant_id LIKE 'pending_%'`
      ).bind(strChatId, token).run();

      if (!updated.meta.changes) {
        const existing = await db.prepare(
          `SELECT participant_id FROM participants WHERE participant_id = ? OR invite_token = ?`
        ).bind(strChatId, token).first<{ participant_id: string }>();
        if (!existing) {
          await sendTelegram(env.TELEGRAM_BOT_TOKEN, chatId, UNKNOWN_USER_MESSAGE);
          return;
        }
      }

      await sendTelegram(env.TELEGRAM_BOT_TOKEN, chatId, CONSENT_MESSAGE);
      return;
    }

    // ── Resolver participante + proyecto (REGLA: Solo UNO activo a la vez por usuario en Telegram) ──
    const participant = await db.prepare(
      `SELECT p.participant_id, p.project_id, p.consent_given, p.display_name,
              pr.seed_prompt, pr.tenant_id
       FROM participants p
       JOIN projects pr ON p.project_id = pr.project_id
       WHERE p.participant_id = ? AND p.status = 'active'`
    ).bind(strChatId).first<{
      participant_id: string;
      project_id: string;
      consent_given: number;
      display_name: string;
      seed_prompt: string;
      tenant_id: string;
    }>();

    if (!participant) {
      await sendTelegram(env.TELEGRAM_BOT_TOKEN, chatId, UNKNOWN_USER_MESSAGE);
      return;
    }

    // Primer mensaje despues de /start = consentimiento implicito
    if (!participant.consent_given) {
      await db.prepare(
        `UPDATE participants SET consent_given = 1, consent_timestamp = CURRENT_TIMESTAMP WHERE participant_id = ?`
      ).bind(strChatId).run();
    }

    // ── Check Quota ────────────────────────────────────────────────────────
    const hasQuota = await checkQuota(db, participant.tenant_id, participant.project_id);
    if (!hasQuota) {
      await sendTelegram(env.TELEGRAM_BOT_TOKEN, chatId, "Mantenimiento temporal. Estaré disponible pronto.");
      return;
    }

    // ── Ciclo VAL con memoria, prompt IAP y directivas ───────────────────
    const result = await runAgentCycle({
      input: text,
      participantId: participant.participant_id,
      projectId: participant.project_id,
      seedPrompt: participant.seed_prompt,
      db,
      geminiKey: env.GEMINI_API_KEY,
    });
    
    recordUsage(db, participant.tenant_id, participant.project_id, 'VAL_CYCLE', result.metadata?.token_usage).catch(e => console.error('[recordUsage]', e));

    // ── Persistir turno en D1 ────────────────────────────────────────────
    const turnId = crypto.randomUUID();
    const countRow = await db.prepare(
      `SELECT COUNT(*) as n FROM dialogue_turns WHERE participant_id = ? AND project_id = ?`
    ).bind(participant.participant_id, participant.project_id).first<{ n: number }>();

    const analyticsJson = JSON.stringify({
      saberes_detectados: result.saberes_detectados,
      oppressive_structures: result.oppressive_structures,
      metadata: result.metadata,
    });

    await db.prepare(
      `INSERT INTO dialogue_turns
         (turn_id, participant_id, project_id, cycle_id, turn_number,
          user_text, val_response, emotional_register, speech_act, directive_applied, topics,
          depth_score, dialectic_strategy, timestamp)
       VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      turnId, participant.participant_id, participant.project_id,
      (countRow?.n ?? 0) + 1, text, result.response,
      result.emotional_register, result.praxis_indicator, result.directive_applied,
      analyticsJson,
      result.depth_score, result.dialectic_strategy,
    ).run();

    // ── Enviar asíncronamente a AG-05 para el análisis de Swarm Insights ──
    runAG05Background(env, text, result.emotional_register, result.topics || [], turnId, participant.participant_id, participant.project_id)
      .catch(e => console.error('[AG-05 dispatch]', e));

    // ── Actualizar estado del participante ───────────────────────────────
    await db.prepare(
      `INSERT INTO dialogue_states (participant_id, project_id, cycle_id, turn_count, emotional_register, last_turn_at, current_phase, phase_progress)
       VALUES (?, ?, 1, 1, ?, CURRENT_TIMESTAMP, ?, ?)
       ON CONFLICT(participant_id, project_id, cycle_id) DO UPDATE SET
         turn_count = turn_count + 1,
         emotional_register = excluded.emotional_register,
         last_turn_at = CURRENT_TIMESTAMP,
         current_phase = excluded.current_phase,
         phase_progress = excluded.phase_progress`
    ).bind(participant.participant_id, participant.project_id, result.emotional_register, result.current_phase, result.phase_progress).run();

    await db.prepare(
      `UPDATE participants SET last_message_at = CURRENT_TIMESTAMP WHERE participant_id = ?`
    ).bind(participant.participant_id).run();

    // ── Marcar directiva como APPLIED ────────────────────────────────────
    if (result.directive_applied) {
      await db.prepare(
        `UPDATE wizard_directives SET status = 'APPLIED', applied_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(result.directive_applied).run();
    }

    await sendTelegram(env.TELEGRAM_BOT_TOKEN, chatId, result.response);
    console.log(
      `[VAL] ${participant.display_name} | emo:${result.emotional_register} | praxis:${result.praxis_indicator}` +
      ` | depth:${result.depth_score} | strategy:${result.dialectic_strategy}` +
      (result.saberes_detectados.length ? ` | saberes:[${result.saberes_detectados.join(",")}]` : "") +
      (result.oppressive_structures.length ? ` | opresion:[${result.oppressive_structures.join(",")}]` : "")
    );

    // ── AG-05 Co-Piloto (Opción B) — async, never blocks response ────────
    const turnCountNow = (countRow?.n ?? 0) + 1;
    const previousDepthScore = result.metadata?.previous_depth_score ?? null;
    const hasPendingHumanDirective = !!(
      await db.prepare(
        `SELECT id FROM wizard_directives WHERE participant_id = ? AND status = 'PENDING' AND issued_by = 'human_investigator' LIMIT 1`
      ).bind(participant.participant_id).first()
    );

    let copilotPromise: Promise<void> | null = null;
    if (shouldActivateCopilot(
      turnCountNow,
      result.depth_score,
      previousDepthScore,
      result.current_phase,
      hasPendingHumanDirective
    )) {
      copilotPromise = (async () => {
        try {
          const narrative = await loadNarrativeMemory(db, participant.participant_id, participant.project_id);
          const directive = await generateDeepeningDirective(
            narrative?.summary || '',
            text,
            result.emotional_register,
            result.praxis_indicator,
            result.depth_score,
            result.current_phase,
            narrative?.themes_pending || [],
            env.GEMINI_API_KEY,
          );

          await insertAutoDirective(db, participant.participant_id, participant.project_id, directive);

          // Record usage
          if (directive.tokenUsage) {
            await recordUsage(db, participant.tenant_id, participant.project_id, 'AG05_COPILOT', directive.tokenUsage);
          }
        } catch (e) {
          console.error('[AG-05 Copilot dispatch]', e);
        }
      })();
    }

    // ── Await background tasks so Worker doesn't terminate early ──────────
    const backgroundTasks = [
      result.narrativeUpdatePromise,
      copilotPromise,
    ].filter(Boolean) as Promise<void>[];

    if (backgroundTasks.length > 0) {
      await Promise.allSettled(backgroundTasks);
    }

  } catch (err: any) {
    console.error("[handleMessage]", err);
    await sendTelegram(
      env.TELEGRAM_BOT_TOKEN, chatId,
      `Encontré un inconveniente técnico. Por favor escríbeme en unos minutos.`
    );
  }
}

// ── Admin: Setup / Lobby ───────────────────────────────────────────────────

app.get('/admin/lobby', (c) => {
  const adminUser = c.get('adminUser');
  const currentUrl = new URL(c.req.url);
  const webhookUrl = `${currentUrl.protocol}//${currentUrl.host}/webhook`;
  const tokenExists = !!(c.env.TELEGRAM_BOT_TOKEN?.length > 10);
  return c.html(<LobbyView webhookUrl={webhookUrl} tokenOk={tokenExists} adminUser={adminUser} />);
});

app.post('/admin/setup_telegram', async (c) => {
  const currentUrl = new URL(c.req.url);
  const webhookUrl = `${currentUrl.protocol}//${currentUrl.host}/webhook`;
  const token = c.env.TELEGRAM_BOT_TOKEN;
  if (!token) return c.json({ error: "Token not found" }, 400);
  try {
    // Include secret_token for webhook validation if configured
    let url = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
    if (c.env.WEBHOOK_SECRET) {
      url += `&secret_token=${encodeURIComponent(c.env.WEBHOOK_SECRET)}`;
    }
    const res = await fetch(url);
    const data = await res.json();
    return c.json({ success: true, telegram_response: data, webhook_secret_configured: !!c.env.WEBHOOK_SECRET });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ── Admin: Projects ────────────────────────────────────────────────────────

app.post('/admin/api/design_pilot', async (c) => {
  const { context } = await c.req.json();
  const geminiKey = c.env.GEMINI_API_KEY;
  if (!geminiKey) return c.json({ error: "No Gemini Key" }, 500);
  
  const result = await designPilot(context, geminiKey);
  return c.json(result);
});

app.post('/admin/create_project_web', async (c) => {
  const adminUser = c.get('adminUser') as any;
  const body = await c.req.parseBody();
  const projectId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO projects (project_id, tenant_id, name, seed_prompt, description, max_participants, pilot_duration_days, created_by)
     VALUES (?, ?, ?, ?, 'Pilot', 10, 7, ?)`
  ).bind(projectId, adminUser.tenant_id, String(body.name), String(body.seed_prompt), adminUser.username).run();
  await c.env.DB.prepare(
    `INSERT INTO cycles (project_id, cycle_id, phase) VALUES (?, 1, 'INVESTIGACION')`
  ).bind(projectId).run();
  return c.redirect('/admin/dashboard');
});

app.post('/admin/create_project', async (c) => {
  const adminUser = c.get('adminUser') as any;
  const { name, seed_prompt, description = "", max_participants = 10, pilot_duration_days = 7 } = await c.req.json();
  const projectId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO projects (project_id, tenant_id, name, seed_prompt, description, max_participants, pilot_duration_days, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(projectId, adminUser.tenant_id, name, seed_prompt, description, max_participants, pilot_duration_days, adminUser.username).run();
  await c.env.DB.prepare(
    `INSERT INTO cycles (project_id, cycle_id, phase) VALUES (?, 1, 'INVESTIGACION')`
  ).bind(projectId).run();
  return c.json({ status: "success", project_id: projectId, name });
});

function getAdminProjectFilter(adminUser: any) {
  if (adminUser.role === 'SUPERADMIN') return { condition: '1=1', params: [] };
  if (adminUser.role === 'TENANT_ADMIN') return { condition: 'tenant_id = ?', params: [adminUser.tenant_id] };
  if (adminUser.role === 'PILOT_ADMIN') return { condition: 'project_id IN (SELECT project_id FROM admin_projects WHERE admin_id = ?)', params: [adminUser.admin_id] };
  return { condition: '1=0', params: [] };
}

app.get('/admin/projects', async (c) => {
  const adminUser = c.get('adminUser') as any;
  const filter = getAdminProjectFilter(adminUser);
  const { results } = await c.env.DB.prepare(
    `SELECT project_id, name, status, created_at, max_participants FROM projects WHERE ${filter.condition} ORDER BY created_at DESC`
  ).bind(...filter.params).all();
  return c.json({ projects: results });
});

// ── Admin: Dashboard ──────────────────────────────────────────────────────

app.get('/admin/dashboard', async (c) => {
  const adminUser = c.get('adminUser') as any;
  const filter = getAdminProjectFilter(adminUser);
  const { results: projects } = await c.env.DB.prepare(
    `SELECT * FROM projects WHERE ${filter.condition} ORDER BY created_at DESC`
  ).bind(...filter.params).all();
  
  const projectId = c.req.query('project_id') || (projects.length > 0 ? (projects[0] as any).project_id : null);
  let participants: any[] = [];
  
  if (projectId) {
    const { results } = await c.env.DB.prepare(
      `SELECT p.*, ds.turn_count, ds.emotional_register
       FROM participants p
       LEFT JOIN dialogue_states ds ON p.participant_id = ds.participant_id AND ds.project_id = p.project_id
       WHERE p.project_id = ? ORDER BY p.registered_at DESC`
    ).bind(projectId).all();
    participants = results;
  }
  return c.html(<DashboardView projects={projects} participants={participants} adminUser={adminUser} activeProjectId={projectId} />);
});

// ── Admin: Participants ────────────────────────────────────────────────────

app.post('/admin/register_participant', async (c) => {
  const { project_id, display_name } = await c.req.json();
  const invite_token = crypto.randomUUID().substring(0, 8);
  await c.env.DB.prepare(
    `INSERT INTO participants (participant_id, project_id, display_name, invite_token, status)
     VALUES (?, ?, ?, ?, 'invited')`
  ).bind(`pending_${invite_token}`, project_id, display_name, invite_token).run();
  return c.json({ status: "success", invite_token, display_name });
});

app.post('/admin/register_participant_web', async (c) => {
  const body = await c.req.parseBody();
  const projectId = String(body.project_id);
  const names = String(body.names).split('\n').map(n => n.trim()).filter(n => n.length > 0);
  for (const name of names) {
    const invite_token = crypto.randomUUID().substring(0, 8);
    await c.env.DB.prepare(
      `INSERT INTO participants (participant_id, project_id, display_name, invite_token, status)
       VALUES (?, ?, ?, ?, 'invited')`
    ).bind(`pending_${invite_token}`, projectId, name, invite_token).run();
  }
  return c.redirect('/admin/dashboard');
});

app.get('/admin/participants/:project_id', async (c) => {
  const projectId = c.req.param('project_id');
  const { results } = await c.env.DB.prepare(
    `SELECT p.participant_id, p.display_name, p.status, p.consent_given,
            p.first_message_at, p.last_message_at, p.invite_token,
            ds.turn_count, ds.emotional_register
     FROM participants p
     LEFT JOIN dialogue_states ds ON p.participant_id = ds.participant_id AND ds.project_id = p.project_id
     WHERE p.project_id = ? ORDER BY p.last_message_at DESC`
  ).bind(projectId).all();
  return c.json({ participants: results });
});

app.get('/admin/conversation/:participant_id', async (c) => {
  const participantId = c.req.param('participant_id');
  const { results } = await c.env.DB.prepare(
    `SELECT turn_number, user_text, val_response, emotional_register,
            speech_act, directive_applied, timestamp
     FROM dialogue_turns WHERE participant_id = ? ORDER BY turn_number ASC`
  ).bind(participantId).all();
  return c.json({ turns: results, total: results.length });
});

// ── Admin: Wizard of Oz ────────────────────────────────────────────────────

app.get('/admin/woz', async (c) => {
  const adminUser = c.get('adminUser') as any;
  const filter = getAdminProjectFilter(adminUser);
  const { results: projects } = await c.env.DB.prepare(
    `SELECT * FROM projects WHERE ${filter.condition} ORDER BY created_at DESC`
  ).bind(...filter.params).all();
  
  const projectId = c.req.query('project_id') || (projects.length > 0 ? (projects[0] as any).project_id : null);
  let participants: any[] = [];
  
  if (projectId) {
    const { results } = await c.env.DB.prepare(
      `SELECT p.*, ds.current_phase, ds.phase_progress 
       FROM participants p
       LEFT JOIN dialogue_states ds ON p.participant_id = ds.participant_id AND ds.project_id = p.project_id
       WHERE p.project_id = ? 
       ORDER BY p.registered_at DESC`
    ).bind(projectId).all();
    participants = results;
  }
  return c.html(<WozView projects={projects} participants={participants} adminUser={adminUser} activeProjectId={projectId} />);
});

app.post('/admin/inject_directive', async (c) => {
  const { participant_id, project_id, content, urgency = "MEDIUM" } = await c.req.json();
  const directiveId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO wizard_directives (id, participant_id, project_id, content, urgency, status, issued_by)
     VALUES (?, ?, ?, ?, ?, 'PENDING', 'human_investigator')`
  ).bind(directiveId, participant_id, project_id ?? "", content, urgency).run();
  return c.json({ status: "success", directive_id: directiveId });
});

app.post('/admin/inject_directive_web', async (c) => {
  const body = await c.req.parseBody();
  const directiveId = crypto.randomUUID();
  const participantId = String(body.participant_id);
  const projectId = String(body.project_id);
  const content = String(body.content);
  const urgency = String(body.urgency);
  const action = String(body.action);

  await c.env.DB.prepare(
    `INSERT INTO wizard_directives (id, participant_id, project_id, content, urgency, status, issued_by)
     VALUES (?, ?, ?, ?, ?, 'PENDING', 'human_investigator')`
  ).bind(directiveId, participantId, projectId, content, urgency).run();

  if (action === "push") {
    // Push runs in background via waitUntil — respond immediately to avoid Worker timeout
    const db = c.env.DB;
    const geminiKey = c.env.GEMINI_API_KEY;
    const botToken = c.env.TELEGRAM_BOT_TOKEN;

    c.executionCtx.waitUntil((async () => {
      try {
        console.log(`[Push] Starting proactive push for ${participantId.substring(0, 8)}...`);
        const chatId = participantId;

        // Check Quota
        const tenant = await db.prepare(`SELECT tenant_id FROM projects WHERE project_id = ?`).bind(projectId).first<{tenant_id: string}>();
        if (tenant) {
          const hasQuota = await checkQuota(db, tenant.tenant_id, projectId);
          if (!hasQuota) {
            console.warn(`[Push] Quota exceeded for tenant ${tenant.tenant_id}`);
            return;
          }
        }

        const result = await runProactiveAgentCycle(db, participantId, projectId, directiveId, content, null, geminiKey);
        console.log(`[Push] Gemini responded: ${result.response.substring(0, 80)}...`);

        if (tenant && result.metadata?.token_usage) {
          await recordUsage(db, tenant.tenant_id, projectId, 'PROACTIVE_PUSH', result.metadata.token_usage);
        }

        const turnId = crypto.randomUUID();
        const text = "[Mensaje Proactivo del Investigador]";
        const analyticsJson = JSON.stringify(result.metadata || {});

        const countRow = await db.prepare(
          `SELECT MAX(turn_number) as n FROM dialogue_turns WHERE participant_id = ? AND project_id = ?`
        ).bind(participantId, projectId).first<{ n: number }>();

        await db.prepare(
          `INSERT INTO dialogue_turns (
            turn_id, participant_id, project_id, cycle_id, turn_number,
            user_text, val_response, emotional_register, speech_act, directive_applied, topics, timestamp
          ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        ).bind(
          turnId, participantId, projectId,
          (countRow?.n ?? 0) + 1, text, result.response,
          result.emotional_register, result.praxis_indicator, result.directive_applied,
          analyticsJson,
        ).run();

        await db.prepare(
          `INSERT INTO dialogue_states (participant_id, project_id, cycle_id, turn_count, emotional_register, last_turn_at, current_phase, phase_progress)
           VALUES (?, ?, 1, 1, ?, CURRENT_TIMESTAMP, ?, ?)
           ON CONFLICT(participant_id, project_id, cycle_id) DO UPDATE SET
             turn_count = turn_count + 1,
             emotional_register = excluded.emotional_register,
             last_turn_at = CURRENT_TIMESTAMP,
             current_phase = excluded.current_phase,
             phase_progress = excluded.phase_progress`
        ).bind(participantId, projectId, result.emotional_register, result.current_phase, result.phase_progress).run();

        await db.prepare(
          `UPDATE participants SET last_message_at = CURRENT_TIMESTAMP WHERE participant_id = ?`
        ).bind(participantId).run();

        await db.prepare(
          `UPDATE wizard_directives SET status = 'APPLIED', applied_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).bind(directiveId).run();

        await sendTelegram(botToken, chatId, result.response);
        console.log(`[Push] ✅ Message sent to ${participantId.substring(0, 8)} via Telegram`);
      } catch (err: any) {
        console.error("[Push] ❌ Proactive Push Error:", err?.message || err);
        // Mark directive as failed so UI can show feedback
        try {
          await db.prepare(
            `UPDATE wizard_directives SET status = 'FAILED' WHERE id = ?`
          ).bind(directiveId).run();
        } catch (_) { /* best effort */ }
      }
    })());
  }

  return c.redirect('/admin/woz');
});

app.get('/admin/directives/:project_id', async (c) => {
  const projectId = c.req.param('project_id');
  const { results } = await c.env.DB.prepare(
    `SELECT id, participant_id, content, urgency, status, created_at, applied_at
     FROM wizard_directives WHERE project_id = ? ORDER BY created_at DESC`
  ).bind(projectId).all();
  return c.json({ directives: results });
});

// ── Admin: Real-Time Polling ───────────────────────────────────────────────

app.get('/admin/api/live_feed/:project_id', async (c) => {
  const projectId = c.req.param('project_id');
  const afterTime = c.req.query('after') || '1970-01-01 00:00:00';
  
  const { results: turns } = await c.env.DB.prepare(
    `SELECT t.turn_id, t.participant_id, p.display_name, t.user_text, t.val_response, 
            t.emotional_register, t.speech_act, t.topics, t.timestamp
     FROM dialogue_turns t
     JOIN participants p ON t.participant_id = p.participant_id AND t.project_id = p.project_id
     WHERE t.project_id = ? AND t.timestamp > ?
     ORDER BY t.timestamp ASC LIMIT 50`
  ).bind(projectId, afterTime).all();

  const { results: participants } = await c.env.DB.prepare(
    `SELECT participant_id, display_name, status, last_message_at
     FROM participants WHERE project_id = ?`
  ).bind(projectId).all();

  // Include pending auto-directives for the Matrix feed
  const { results: autoDirectives } = await c.env.DB.prepare(
    `SELECT id, participant_id, content, urgency, issued_by, created_at
     FROM wizard_directives 
     WHERE project_id = ? AND status = 'PENDING' AND issued_by = 'ag05_copilot'
     ORDER BY created_at DESC LIMIT 10`
  ).bind(projectId).all();

  const dbTime = await c.env.DB.prepare(`SELECT CURRENT_TIMESTAMP as now`).first<{now: string}>();

  return c.json({ turns, participants, auto_directives: autoDirectives, server_time: dbTime?.now });
});

// ── Admin: Agent Tuning ────────────────────────────────────────────────────

app.get('/admin/tuning', async (c) => {
  const adminUser = c.get('adminUser') as any;
  const filter = getAdminProjectFilter(adminUser);
  const { results: projects } = await c.env.DB.prepare(
    `SELECT project_id, name FROM projects WHERE ${filter.condition} ORDER BY created_at DESC`
  ).bind(...filter.params).all();

  const projectId = c.req.query('project_id') || (projects.length > 0 ? (projects[0] as any).project_id : null);
  let metaparams = null;
  if(projectId) {
     metaparams = await c.env.DB.prepare(`SELECT * FROM agent_metaparams WHERE project_id = ?`).bind(projectId).first();
  }
  const activeProj = projects.find((p: any) => p.project_id === projectId) || projects[0];
  
  return c.html(<TuningView projects={projects} activeProject={activeProj} params={metaparams} adminUser={adminUser} />);
});

app.post('/admin/tuning_web', async (c) => {
  const body = await c.req.parseBody();
  const projectId = String(body.project_id);
  const temp = parseFloat(String(body.active_temperature));
  const maxTokens = parseInt(String(body.max_output_tokens), 10);
  const prompt = String(body.system_base_prompt);
  
  await c.env.DB.prepare(
    `INSERT INTO agent_metaparams (project_id, active_temperature, max_output_tokens, system_base_prompt, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(project_id) DO UPDATE SET
       active_temperature = excluded.active_temperature,
       max_output_tokens = excluded.max_output_tokens,
       system_base_prompt = excluded.system_base_prompt,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(projectId, temp, maxTokens, prompt).run();
  
  return c.redirect(`/admin/tuning?project_id=${projectId}&saved=1`);
});

// ── Admin: Billing & Quotas ────────────────────────────────────────────────

app.get('/admin/billing', async (c) => {
  const adminUser = c.get('adminUser') as any;
  if (adminUser.role !== 'SUPERADMIN') {
    return c.text('Acceso denegado. Exclusivo para SUPERADMIN.', 403);
  }

  // Obtener tenants y sus cuotas
  const { results: tenants } = await c.env.DB.prepare(
    `SELECT t.tenant_id, t.name, COALESCE(tq.max_tokens_monthly, 1000000) as max_tokens, 
            COALESCE(tq.used_tokens_monthly, 0) as used_tokens, COALESCE(tq.cutoff_active, 0) as cutoff_active
     FROM tenants t
     LEFT JOIN tenant_quotas tq ON t.tenant_id = tq.tenant_id`
  ).all();

  // Obtener proyectos y sus cuotas
  const { results: projects } = await c.env.DB.prepare(
    `SELECT p.project_id, p.name, p.tenant_id, COALESCE(pq.max_tokens, 500000) as max_tokens, 
            COALESCE(pq.used_tokens, 0) as used_tokens, COALESCE(pq.cutoff_active, 0) as cutoff_active
     FROM projects p
     LEFT JOIN project_quotas pq ON p.project_id = pq.project_id`
  ).all();

  // Obtener logs recientes (opcional para graficar)
  const { results: logs } = await c.env.DB.prepare(
    `SELECT operation_type, SUM(tokens_total) as total_tokens, COUNT(*) as calls
     FROM usage_logs
     GROUP BY operation_type`
  ).all();

  return c.html(<BillingView adminUser={adminUser} tenants={tenants} projects={projects} logs={logs} />);
});

app.post('/admin/billing/update_tenant_quota', async (c) => {
  const adminUser = c.get('adminUser') as any;
  if (adminUser.role !== 'SUPERADMIN') return c.text('Acceso denegado', 403);

  const body = await c.req.parseBody();
  const tenantId = String(body.tenant_id);
  const maxTokens = parseInt(String(body.max_tokens), 10);
  const cutoffActive = body.cutoff_active === 'on' ? 1 : 0;

  await c.env.DB.prepare(
    `INSERT INTO tenant_quotas (tenant_id, max_tokens_monthly, cutoff_active) 
     VALUES (?, ?, ?)
     ON CONFLICT(tenant_id) DO UPDATE SET max_tokens_monthly = excluded.max_tokens_monthly, cutoff_active = excluded.cutoff_active`
  ).bind(tenantId, maxTokens, cutoffActive).run();

  return c.redirect('/admin/billing');
});

app.post('/admin/billing/update_project_quota', async (c) => {
  const adminUser = c.get('adminUser') as any;
  if (adminUser.role !== 'SUPERADMIN') return c.text('Acceso denegado', 403);

  const body = await c.req.parseBody();
  const projectId = String(body.project_id);
  const maxTokens = parseInt(String(body.max_tokens), 10);
  const cutoffActive = body.cutoff_active === 'on' ? 1 : 0;

  await c.env.DB.prepare(
    `INSERT INTO project_quotas (project_id, max_tokens, cutoff_active) 
     VALUES (?, ?, ?)
     ON CONFLICT(project_id) DO UPDATE SET max_tokens = excluded.max_tokens, cutoff_active = excluded.cutoff_active`
  ).bind(projectId, maxTokens, cutoffActive).run();

  return c.redirect('/admin/billing');
});

// ── Analytics ──────────────────────────────────────────────────────────────

async function computeAnalytics(projectId: string, db: D1Database) {
  const project = await db.prepare(
    `SELECT project_id, name FROM projects WHERE project_id = ?`
  ).bind(projectId).first<{ project_id: string; name: string }>();
  if (!project) return null;

  // Totales
  const totalRow = await db.prepare(
    `SELECT COUNT(*) as total FROM dialogue_turns WHERE project_id = ?`
  ).bind(projectId).first<{ total: number }>();

  // Participantes con métricas
  const { results: participantStats } = await db.prepare(
    `SELECT p.participant_id, p.display_name, ds.turn_count, ds.emotional_register
     FROM participants p
     LEFT JOIN dialogue_states ds ON p.participant_id = ds.participant_id AND ds.project_id = p.project_id
     WHERE p.project_id = ? AND p.consent_given = 1
     ORDER BY ds.turn_count DESC`
  ).bind(projectId).all<{ participant_id: string; display_name: string; turn_count: number; emotional_register: string }>();

  // Distribución emocional
  const { results: emotionRows } = await db.prepare(
    `SELECT emotional_register, COUNT(*) as count FROM dialogue_turns
     WHERE project_id = ? AND emotional_register IS NOT NULL
     GROUP BY emotional_register`
  ).bind(projectId).all<{ emotional_register: string; count: number }>();

  // Distribución de praxis (guardada en speech_act)
  const { results: praxisRows } = await db.prepare(
    `SELECT speech_act, COUNT(*) as count FROM dialogue_turns
     WHERE project_id = ? AND speech_act IS NOT NULL
     GROUP BY speech_act`
  ).bind(projectId).all<{ speech_act: string; count: number }>();

  // Topics JSON para saberes y estructuras
  const { results: topicsRows } = await db.prepare(
    `SELECT topics FROM dialogue_turns WHERE project_id = ? AND topics IS NOT NULL`
  ).bind(projectId).all<{ topics: string }>();

  const saberesCount: Record<string, number> = {};
  const structuresCount: Record<string, number> = {};
  for (const row of topicsRows) {
    try {
      const parsed = JSON.parse(row.topics);
      for (const s of (parsed.saberes_detectados || [])) {
        saberesCount[s] = (saberesCount[s] || 0) + 1;
      }
      for (const s of (parsed.oppressive_structures || [])) {
        structuresCount[s] = (structuresCount[s] || 0) + 1;
      }
    } catch { /* skip */ }
  }

  // Directivas pendientes
  const pendingRow = await db.prepare(
    `SELECT COUNT(*) as pending FROM wizard_directives WHERE project_id = ? AND status = 'PENDING'`
  ).bind(projectId).first<{ pending: number }>();

  const emotionDist: Record<string, number> = {};
  for (const r of emotionRows) emotionDist[r.emotional_register] = Number(r.count);

  const praxisDist: Record<string, number> = {};
  for (const r of praxisRows) praxisDist[r.speech_act] = Number(r.count);

  const totalEmotions = Object.values(emotionDist).reduce((a, b) => a + b, 0);
  const totalPraxis = Object.values(praxisDist).reduce((a, b) => a + b, 0);

  const pct = (key: string, dist: Record<string, number>, total: number) =>
    total > 0 ? Math.round(((dist[key] ?? 0) / total) * 100) : 0;

  // Alerts based on thresholds
  const alerts: Array<{ level: 'red' | 'orange' | 'blue'; message: string }> = [];

  const distressedPct = pct('DISTRESSED', emotionDist, totalEmotions);
  const resistantPct = pct('RESISTANT', emotionDist, totalEmotions);
  if (distressedPct + resistantPct > 30) {
    alerts.push({
      level: 'red',
      message: `${distressedPct + resistantPct}% del equipo muestra señales de resistencia o angustia. Considera priorizar escucha activa y revisar las condiciones de trabajo antes de avanzar con propuestas de cambio.`,
    });
  }

  const catarsisPct = pct('CATARSIS', praxisDist, totalPraxis);
  const propuestaPct = pct('PROPUESTA_ACCION', praxisDist, totalPraxis);
  if (catarsisPct > 50 && propuestaPct < 20) {
    alerts.push({
      level: 'orange',
      message: `El ${catarsisPct}% de los turnos son catárticos con solo ${propuestaPct}% de propuestas de acción. El equipo necesita desahogarse antes de co-diseñar soluciones. No apresures la fase de acción.`,
    });
  }

  const saberesCount2 = Object.keys(saberesCount).length;
  if (saberesCount2 >= 3) {
    alerts.push({
      level: 'blue',
      message: `Se detectaron ${saberesCount2} tipos de Shadow IT. El equipo trabaja con herramientas no oficiales para compensar gaps en los sistemas formales — esto es un insumo directo para el rediseño de procesos.`,
    });
  }

  // Auto-generated executive summary
  const totalTurns = totalRow?.total ?? 0;
  const activePart = (participantStats || []).filter(p => (p.turn_count ?? 0) > 0).length;
  const totalPart = (participantStats || []).length;
  const dominantEmotion = Object.entries(emotionDist).sort(([,a],[,b]) => b-a)[0]?.[0] ?? 'NEUTRAL';
  const dominantPraxis = Object.entries(praxisDist).sort(([,a],[,b]) => b-a)[0]?.[0] ?? 'REFLEXION_PASIVA';

  const emotionLabel: Record<string,string> = { OPEN:'abierto', GUARDED:'cauteloso', RESISTANT:'resistente', DISTRESSED:'en angustia', NEUTRAL:'neutral' };
  const praxisLabel: Record<string,string> = { PROPUESTA_ACCION:'con propuestas de cambio concretas', CATARSIS:'catártico (quejas sin propuestas)', REFLEXION_PASIVA:'descriptivo y reflexivo' };

  const executive_summary = totalTurns === 0
    ? 'Sin datos suficientes para generar un resumen. Espera a que los participantes inicien conversaciones.'
    : `En este piloto, ${activePart} de ${totalPart} participantes tienen conversaciones activas, con un total de ${totalTurns} turnos analizados. ` +
      `El registro emocional dominante del equipo es ${emotionLabel[dominantEmotion] ?? dominantEmotion} (${pct(dominantEmotion, emotionDist, totalEmotions)}%), ` +
      `y el patrón de praxis predominante es ${praxisLabel[dominantPraxis] ?? dominantPraxis} (${pct(dominantPraxis, praxisDist, totalPraxis)}%). ` +
      (saberesCount2 > 0 ? `Se identificaron ${saberesCount2} tipo(s) de Shadow IT, indicando que el equipo ha desarrollado workarounds para compensar limitaciones del sistema formal. ` : '') +
      (alerts.length > 0 ? `Hay ${alerts.length} alerta(s) activa(s) que requieren atención del facilitador.` : 'No hay alertas críticas activas en este momento.');

  return {
    project_id: project.project_id,
    project_name: project.name,
    total_turns: totalTurns,
    active_participants: activePart,
    total_participants: totalPart,
    emotion_distribution: emotionDist,
    praxis_distribution: praxisDist,
    top_participants: (participantStats || []).slice(0, 15),
    saberes_detectados: Object.entries(saberesCount)
      .map(([saber, count]) => ({ saber, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    oppressive_structures: Object.entries(structuresCount)
      .map(([structure, count]) => ({ structure, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    pending_directives: pendingRow?.pending ?? 0,
    alerts,
    executive_summary,
  };
}

// JSON API
app.get('/admin/analytics/:project_id', async (c) => {
  const projectId = c.req.param('project_id');
  const analytics = await computeAnalytics(projectId, c.env.DB);
  if (!analytics) return c.json({ error: "Project not found" }, 404);
  return c.json(analytics);
});

// CSV Export
app.get('/admin/export/:project_id', async (c) => {
  const projectId = c.req.param('project_id');
  const project = await c.env.DB.prepare(
    `SELECT name FROM projects WHERE project_id = ?`
  ).bind(projectId).first<{ name: string }>();
  if (!project) return c.json({ error: "Project not found" }, 404);

  const { results } = await c.env.DB.prepare(
    `SELECT t.turn_number, p.display_name, t.user_text, t.val_response,
            t.emotional_register, t.speech_act, t.timestamp, t.topics, t.directive_applied
     FROM dialogue_turns t
     JOIN participants p ON t.participant_id = p.participant_id
     WHERE t.project_id = ?
     ORDER BY t.timestamp ASC`
  ).bind(projectId).all<{ turn_number: number; display_name: string; user_text: string; val_response: string; emotional_register: string; speech_act: string; timestamp: string; topics: string; directive_applied: string }>();

  const escape = (s: string | null | undefined) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const header = 'turno,participante,mensaje_usuario,respuesta_val,registro_emocional,praxis,topics,directive_applied,timestamp\n';
  const rows = results.map(r =>
    [r.turn_number, escape(r.display_name), escape(r.user_text), escape(r.val_response),
     r.emotional_register ?? '', r.speech_act ?? '', escape(r.topics), escape(r.directive_applied), r.timestamp].join(',')
  ).join('\n');

  const filename = `digikawsay_${project.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`;
  return new Response(header + rows, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});

// SSR page
app.get('/admin/analytics', async (c) => {
  const adminUser = c.get('adminUser') as any;
  const filter = getAdminProjectFilter(adminUser);
  const { results: projects } = await c.env.DB.prepare(
    `SELECT project_id, name FROM projects WHERE ${filter.condition} ORDER BY created_at DESC`
  ).bind(...filter.params).all<{ project_id: string; name: string }>();

  const projectId = c.req.query('project_id') || (projects[0]?.project_id ?? '');
  const analytics = projectId ? await computeAnalytics(projectId, c.env.DB) : null;

  return c.html(<AnalyticsView projects={projects} projectId={projectId} analytics={analytics} adminUser={adminUser} />);
});
import { streamText } from 'hono/streaming';

// MD Report Download API
app.get('/admin/report/:project_id', async (c) => {
  const projectId = c.req.param('project_id');
  
  // 1. Get project details
  const project = await c.env.DB.prepare(
    `SELECT project_id, name FROM projects WHERE project_id = ?`
  ).bind(projectId).first<{ project_id: string; name: string }>();
  
  if (!project) return c.text("Proyecto no encontrado", 404);

  // 2. Get dialogue turns
  const { results: turns } = await c.env.DB.prepare(
    `SELECT t.turn_number, p.display_name, t.user_text, t.val_response, t.emotional_register, t.speech_act 
     FROM dialogue_turns t 
     JOIN participants p ON t.participant_id = p.participant_id AND t.project_id = p.project_id
     WHERE t.project_id = ? 
     ORDER BY t.timestamp ASC`
  ).bind(projectId).all<{ turn_number: number; display_name: string; user_text: string; val_response: string; emotional_register: string; speech_act: string }>();

  if (turns.length === 0) return c.text("Aún no hay transcripciones para este proyecto", 400);

  // 3. Format transcripts
  let transcriptString = "";
  for (const t of turns) {
    transcriptString += `[${t.display_name} - Turno ${t.turn_number} - ${t.emotional_register} / ${t.speech_act}]: ${t.user_text}\n`;
    transcriptString += `[VAL]: ${t.val_response}\n\n`;
  }

  // 4. Download headers
  const dateStr = new Date().toISOString().split('T')[0];
  const safeName = project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  c.header('Content-Type', 'text/markdown; charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="sintesis_digikawsay_${safeName}_${dateStr}.md"`);

  // 5. Stream the response
  return streamText(c, async (stream) => {
    try {
      const llmStream = await generateSynthesisReportStream(project.name, transcriptString, c.env.GEMINI_API_KEY);
      for await (const chunk of llmStream) {
        if (chunk.content) {
          // Remove potential leading markdown block markers from the first chunk
          let chunkStr = typeof chunk.content === 'string' ? chunk.content : chunk.content.toString();
          if (chunkStr.startsWith('```markdown\\n')) chunkStr = chunkStr.replace('```markdown\\n', '');
          await stream.write(chunkStr);
        }
      }
    } catch (err: any) {
      console.error("[generateSynthesisReportStream]", err);
      await stream.write(`\n\n# Error al generar el informe\n\nEl sistema AI devolvió un error: ${err.message}`);
    }
  });
});

// ── AG-05 Async Integration ────────────────────────────────────────────────
async function runAG05Background(env: Bindings, text: string, emotion: string, topics: string[], turnId: string, participantId: string, projectId: string) {
  try {
    const ag05Url = env.AG05_SERVICE_URL || 'http://host.docker.internal:8005'; // Ajusta la URL en producción/local
    console.log(`[AG-05] Enviando turno ${turnId} a Methodologist en ${ag05Url}/analyze_turn`);
    
    const response = await fetch(`${ag05Url}/analyze_turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: participantId,
        text,
        emotion,
        topics
      })
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const analysis = await response.json() as any;
    
    // Guardar en D1 (swarm_insights)
    const insightId = crypto.randomUUID();
    const fb = analysis.fals_borda_metrics || {};
    const cs = analysis.cultural_shadows || {};
    
    await env.DB.prepare(
      `INSERT INTO swarm_insights 
         (insight_id, project_id, participant_id, turn_id, agent_id, sentipensar_score, praxis_indicator, relational_parity, saberes_detectados, oppressive_structures, methodological_insight, recommended_woz_directive, raw_payload)
       VALUES (?, ?, ?, ?, 'AG-05', ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      insightId, projectId, participantId, turnId,
      fb.sentipensar_score || null,
      fb.praxis_indicator || null,
      fb.relational_parity || null,
      JSON.stringify(cs.saberes_detectados || []),
      JSON.stringify(cs.oppressive_structures || []),
      analysis.methodological_insight || null,
      analysis.recommended_woz_directive || null,
      JSON.stringify(analysis)
    ).run();
    
    console.log(`[AG-05] Análisis completado y guardado en D1 para turno ${turnId}`);
  } catch (error) {
    console.error(`[AG-05 Background] Error:`, error);
  }
}

// ── Admin: Security Dashboard ───────────────────────────────────────────────────

app.get('/admin/security', async (c) => {
  const adminUser = c.get('adminUser') as any;
  if (adminUser.role !== 'SUPERADMIN') return c.redirect('/admin/lobby');

  // Fetch recent security events (last 24h)
  const { results: events } = await c.env.DB.prepare(
    `SELECT event_id, event_type, participant_id, severity, details, action_taken, created_at
     FROM security_events
     WHERE created_at > datetime('now', '-24 hours')
     ORDER BY created_at DESC LIMIT 100`
  ).all();

  // Aggregate stats
  const statsRow = await c.env.DB.prepare(
    `SELECT
       COUNT(*) as total_events,
       SUM(CASE WHEN action_taken = 'BLOCKED' THEN 1 ELSE 0 END) as blocked,
       SUM(CASE WHEN action_taken = 'FLAGGED' THEN 1 ELSE 0 END) as flagged,
       SUM(CASE WHEN action_taken = 'RATE_LIMITED' THEN 1 ELSE 0 END) as rate_limited,
       SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical,
       SUM(CASE WHEN severity = 'HIGH' THEN 1 ELSE 0 END) as high
     FROM security_events
     WHERE created_at > datetime('now', '-24 hours')
       AND event_type != 'MESSAGE'`
  ).first<{ total_events: number; blocked: number; flagged: number; rate_limited: number; critical: number; high: number }>();

  // Top threat types
  const { results: threatTypes } = await c.env.DB.prepare(
    `SELECT event_type, COUNT(*) as count
     FROM security_events
     WHERE created_at > datetime('now', '-24 hours')
       AND event_type != 'MESSAGE'
     GROUP BY event_type
     ORDER BY count DESC`
  ).all<{ event_type: string; count: number }>();

  // Flagged participants
  const { results: flaggedParticipants } = await c.env.DB.prepare(
    `SELECT participant_id, COUNT(*) as incident_count,
            MAX(severity) as max_severity,
            MAX(created_at) as last_incident
     FROM security_events
     WHERE participant_id IS NOT NULL
       AND event_type != 'MESSAGE'
       AND created_at > datetime('now', '-24 hours')
     GROUP BY participant_id
     ORDER BY incident_count DESC
     LIMIT 20`
  ).all<{ participant_id: string; incident_count: number; max_severity: string; last_incident: string }>();

  return c.html(<SecurityView
    adminUser={adminUser}
    events={events}
    stats={statsRow || { total_events: 0, blocked: 0, flagged: 0, rate_limited: 0, critical: 0, high: 0 }}
    threatTypes={threatTypes}
    flaggedParticipants={flaggedParticipants}
  />);
});

app.get('/admin/api/security_events', async (c) => {
  const adminUser = c.get('adminUser') as any;
  if (adminUser.role !== 'SUPERADMIN') return c.json({ error: 'Unauthorized' }, 403);

  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);
  const eventType = c.req.query('type');

  let query = `SELECT * FROM security_events WHERE event_type != 'MESSAGE'`;
  const params: string[] = [];
  if (eventType) {
    query += ` AND event_type = ?`;
    params.push(eventType);
  }
  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(String(limit));

  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ events: results });
});

export default app;
