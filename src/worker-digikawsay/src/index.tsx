import { Hono } from 'hono';
import { runAgentCycle } from './agent';
import { LobbyView, DashboardView, WozView } from './ui';

type Bindings = {
  DB: D1Database;
  GCP_PROJECT_ID: string;
  GCP_PUBSUB_TOPIC_INBOUND: string;
  TELEGRAM_BOT_TOKEN: string;
  GEMINI_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// ── Helpers ────────────────────────────────────────────────────────────────

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

export default app;
