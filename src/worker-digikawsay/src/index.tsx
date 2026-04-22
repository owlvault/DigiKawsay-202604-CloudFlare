import { Hono } from 'hono';
import { getSignedCookie, setSignedCookie, deleteCookie } from 'hono/cookie';
import { runAgentCycle } from './agent';
import { hashPassword, verifyPassword } from './auth';
import { LoginView, SetupAdminView, LobbyView, DashboardView, WozView, AnalyticsView, TuningView } from './ui';

type Bindings = {
  DB: D1Database;
  GCP_PROJECT_ID: string;
  GCP_PUBSUB_TOPIC_INBOUND: string;
  TELEGRAM_BOT_TOKEN: string;
  GEMINI_API_KEY: string;
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

  c.set('adminUser', identity);
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
  await c.env.DB.prepare(
    `INSERT INTO administrators (admin_id, username, password_hash) VALUES (hex(randomblob(16)), ?, ?)`
  ).bind(username, hash).run();

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

  const admin = await c.env.DB.prepare(`SELECT password_hash FROM administrators WHERE username = ?`).bind(username).first<{password_hash: string}>();
  if (!admin) {
    return c.redirect('/admin/login?error=1');
  }

  const isValid = await verifyPassword(pass, admin.password_hash);
  if (!isValid) {
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

// ── Webhooks & API Publicas ────────────────────────────────────────────────────────────────

async function sendTelegram(token: string, chatId: number | string, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

const CONSENT_MESSAGE =
  "Hola, soy VAL — un facilitador de investigación organizacional.\n\n" +
  "Esta conversación es voluntaria y confidencial. Tu identidad será anonimizada " +
  "en todos los reportes. Al enviar tu próximo mensaje confirmas tu participación.\n\n" +
  "Cuando estés listo, cuéntame: ¿cómo está siendo para ti el trabajo en equipo últimamente?";

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
  const payload = await c.req.json();
  if (!payload?.message) return c.json({ status: "ignored" });

  const text: string = payload.message?.text;
  const chatId: number = payload.message?.chat?.id;
  if (!text || !chatId) return c.json({ status: "ignored" });

  c.executionCtx.waitUntil(handleMessage(text, chatId, c.env));
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

    // ── Resolver participante + proyecto ─────────────────────────────────
    const participant = await db.prepare(
      `SELECT p.participant_id, p.project_id, p.consent_given, p.display_name,
              pr.seed_prompt
       FROM participants p
       JOIN projects pr ON p.project_id = pr.project_id
       WHERE p.participant_id = ? AND p.status != 'withdrawn'`
    ).bind(strChatId).first<{
      participant_id: string;
      project_id: string;
      consent_given: number;
      display_name: string;
      seed_prompt: string;
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

    // ── Ciclo VAL con memoria, prompt IAP y directivas ───────────────────
    const result = await runAgentCycle({
      input: text,
      participantId: participant.participant_id,
      projectId: participant.project_id,
      seedPrompt: participant.seed_prompt,
      db,
      geminiKey: env.GEMINI_API_KEY,
    });

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
          user_text, val_response, emotional_register, speech_act, directive_applied, topics, timestamp)
       VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      turnId, participant.participant_id, participant.project_id,
      (countRow?.n ?? 0) + 1, text, result.response,
      result.emotional_register, result.praxis_indicator, result.directive_applied,
      analyticsJson,
    ).run();

    // ── Actualizar estado del participante ───────────────────────────────
    await db.prepare(
      `INSERT INTO dialogue_states (participant_id, project_id, cycle_id, turn_count, emotional_register, last_turn_at)
       VALUES (?, ?, 1, 1, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(participant_id, project_id, cycle_id) DO UPDATE SET
         turn_count = turn_count + 1,
         emotional_register = excluded.emotional_register,
         last_turn_at = CURRENT_TIMESTAMP`
    ).bind(participant.participant_id, participant.project_id, result.emotional_register).run();

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
      (result.saberes_detectados.length ? ` | saberes:[${result.saberes_detectados.join(",")}]` : "") +
      (result.oppressive_structures.length ? ` | opresion:[${result.oppressive_structures.join(",")}]` : "")
    );

  } catch (err) {
    console.error("[handleMessage]", err);
    await sendTelegram(
      env.TELEGRAM_BOT_TOKEN, chatId,
      "Encontre un inconveniente tecnico. Por favor escribeme en unos minutos."
    );
  }
}

// ── Admin: Setup / Lobby ───────────────────────────────────────────────────

app.get('/admin/lobby', (c) => {
  const currentUrl = new URL(c.req.url);
  const webhookUrl = `${currentUrl.protocol}//${currentUrl.host}/webhook`;
  const tokenExists = !!(c.env.TELEGRAM_BOT_TOKEN?.length > 10);
  return c.html(<LobbyView webhookUrl={webhookUrl} tokenOk={tokenExists} />);
});

app.post('/admin/setup_telegram', async (c) => {
  const currentUrl = new URL(c.req.url);
  const webhookUrl = `${currentUrl.protocol}//${currentUrl.host}/webhook`;
  const token = c.env.TELEGRAM_BOT_TOKEN;
  if (!token) return c.json({ error: "Token not found" }, 400);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
    const data = await res.json();
    return c.json({ success: true, telegram_response: data });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ── Admin: Projects ────────────────────────────────────────────────────────

app.post('/admin/create_project_web', async (c) => {
  const body = await c.req.parseBody();
  const projectId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO projects (project_id, name, seed_prompt, description, max_participants, pilot_duration_days, created_by)
     VALUES (?, ?, ?, 'Pilot', 10, 7, 'admin')`
  ).bind(projectId, String(body.name), String(body.seed_prompt)).run();
  await c.env.DB.prepare(
    `INSERT INTO cycles (project_id, cycle_id, phase) VALUES (?, 1, 'INVESTIGACION')`
  ).bind(projectId).run();
  return c.redirect('/admin/dashboard');
});

app.post('/admin/create_project', async (c) => {
  const { name, seed_prompt, description = "", max_participants = 10, pilot_duration_days = 7 } = await c.req.json();
  const projectId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO projects (project_id, name, seed_prompt, description, max_participants, pilot_duration_days, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'admin')`
  ).bind(projectId, name, seed_prompt, description, max_participants, pilot_duration_days).run();
  await c.env.DB.prepare(
    `INSERT INTO cycles (project_id, cycle_id, phase) VALUES (?, 1, 'INVESTIGACION')`
  ).bind(projectId).run();
  return c.json({ status: "success", project_id: projectId, name });
});

app.get('/admin/projects', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT project_id, name, status, created_at, max_participants FROM projects ORDER BY created_at DESC`
  ).all();
  return c.json({ projects: results });
});

// ── Admin: Dashboard ──────────────────────────────────────────────────────

app.get('/admin/dashboard', async (c) => {
  const { results: projects } = await c.env.DB.prepare(
    `SELECT * FROM projects ORDER BY created_at DESC`
  ).all();
  const projectId = projects.length > 0 ? (projects[0] as any).project_id : null;
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
  return c.html(<DashboardView projects={projects} participants={participants} />);
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
  const { results: projects } = await c.env.DB.prepare(
    `SELECT * FROM projects ORDER BY created_at DESC`
  ).all();
  const projectId = projects.length > 0 ? (projects[0] as any).project_id : null;
  let participants: any[] = [];
  if (projectId) {
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM participants WHERE project_id = ? ORDER BY registered_at DESC`
    ).bind(projectId).all();
    participants = results;
  }
  return c.html(<WozView projects={projects} participants={participants} />);
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
  await c.env.DB.prepare(
    `INSERT INTO wizard_directives (id, participant_id, project_id, content, urgency, status, issued_by)
     VALUES (?, ?, ?, ?, ?, 'PENDING', 'human_investigator')`
  ).bind(directiveId, String(body.participant_id), String(body.project_id),
    String(body.content), String(body.urgency)).run();
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
     JOIN participants p ON t.participant_id = p.participant_id
     WHERE t.project_id = ? AND t.timestamp > ?
     ORDER BY t.timestamp ASC LIMIT 50`
  ).bind(projectId, afterTime).all();

  const { results: participants } = await c.env.DB.prepare(
    `SELECT participant_id, display_name, status, last_message_at
     FROM participants WHERE project_id = ?`
  ).bind(projectId).all();

  const dbTime = await c.env.DB.prepare(`SELECT CURRENT_TIMESTAMP as now`).first<{now: string}>();

  return c.json({ turns, participants, server_time: dbTime?.now });
});

// ── Admin: Agent Tuning ────────────────────────────────────────────────────

app.get('/admin/tuning', async (c) => {
  const { results: projects } = await c.env.DB.prepare(
    `SELECT project_id, name FROM projects ORDER BY created_at DESC`
  ).all();

  const projectId = c.req.query('project_id') || (projects.length > 0 ? (projects[0] as any).project_id : null);
  let metaparams = null;
  if(projectId) {
     metaparams = await c.env.DB.prepare(`SELECT * FROM agent_metaparams WHERE project_id = ?`).bind(projectId).first();
  }
  const activeProj = projects.find((p: any) => p.project_id === projectId) || projects[0];
  
  return c.html(<TuningView projects={projects} activeProject={activeProj} params={metaparams} />);
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

  return {
    project_id: project.project_id,
    project_name: project.name,
    total_turns: totalRow?.total ?? 0,
    active_participants: (participantStats || []).filter(p => (p.turn_count ?? 0) > 0).length,
    total_participants: (participantStats || []).length,
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
  };
}

// JSON API
app.get('/admin/analytics/:project_id', async (c) => {
  const projectId = c.req.param('project_id');
  const analytics = await computeAnalytics(projectId, c.env.DB);
  if (!analytics) return c.json({ error: "Project not found" }, 404);
  return c.json(analytics);
});

// SSR page
app.get('/admin/analytics', async (c) => {
  const { results: projects } = await c.env.DB.prepare(
    `SELECT project_id, name FROM projects ORDER BY created_at DESC`
  ).all<{ project_id: string; name: string }>();

  const projectId = c.req.query('project_id') || (projects[0]?.project_id ?? '');
  const analytics = projectId ? await computeAnalytics(projectId, c.env.DB) : null;

  return c.html(<AnalyticsView projects={projects} projectId={projectId} analytics={analytics} />);
});

export default app;
