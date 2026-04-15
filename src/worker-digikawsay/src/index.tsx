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

// ==========================================
// Middleware for Error Handling
// ==========================================
app.onError((err, c) => {
  console.error(`Error: ${err}`);
  return c.json({ status: "error", detail: err.message }, 500);
});

// ==========================================
// Root endpoint
// ==========================================
app.get('/', (c) => {
  return c.redirect('/admin/lobby');
});

// ==========================================
// Telegram Webhook Handler (Replacement for channel-layer)
// ==========================================
app.post('/webhook', async (c) => {
  const payload = await c.req.json();
  
  // Quick validation
  if (!payload || (!payload.message && !payload.callback_query)) {
    return c.json({ status: "ignored" });
  }

  // Procesamiento Sensorial: Extraemos mensaje y chat_id
  const text = payload?.message?.text;
  const chatId = payload?.message?.chat?.id;

  if (text && chatId) {
    console.log(`[Webhook] Mensaje entrante de ${chatId}: ${text}`);
    
    // Non-Blocking execution en Cloudflare Edge (Worker vive hasta que termine pero Hono devuelve HTTP 200 rápido a Telegram)
    c.executionCtx.waitUntil((async () => {
      try {
        const aiResponse = await runAgentCycle(text, String(chatId), c.env.GEMINI_API_KEY);
        
        // Cierre de Ciclo interactivo: Enviamos el contenido al usuario en su celular
        await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: aiResponse })
        });
        console.log(`[Webhook] Respuesta exitosa enviada al usuario ${chatId}`);
      } catch (err) {
        console.error("[Webhook Error] Falla en el ciclo de LangGraph:", err);
      }
    })());
  }
  
  return c.json({ status: "ok" });
});

// ==========================================
// Admin API (Replacement for agente00-service)
// ==========================================

// Setup Wizard (Lobby)
app.get('/admin/lobby', (c) => {
  const currentUrl = new URL(c.req.url);
  const webhookUrl = `${currentUrl.protocol}//${currentUrl.host}/webhook`;
  const tokenExists = c.env.TELEGRAM_BOT_TOKEN && c.env.TELEGRAM_BOT_TOKEN.length > 10;
  return c.html(<LobbyView webhookUrl={webhookUrl} tokenOk={tokenExists} />);
});

app.post('/admin/create_project_web', async (c) => {
  const body = await c.req.parseBody();
  const name = String(body.name);
  const seed_prompt = String(body.seed_prompt);
  
  const projectId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO projects (project_id, name, seed_prompt, description, max_participants, pilot_duration_days, created_by) 
     VALUES (?, ?, ?, 'Pilot', 10, 7, 'admin')`
  ).bind(projectId, name, seed_prompt).run();
  
  await c.env.DB.prepare(
    `INSERT INTO cycles (project_id, cycle_id, phase) VALUES (?, 1, 'INVESTIGACION')`
  ).bind(projectId).run();

  return c.redirect('/admin/dashboard');
});

app.post('/admin/setup_telegram', async (c) => {
  const currentUrl = new URL(c.req.url);
  const webhookUrl = `${currentUrl.protocol}//${currentUrl.host}/webhook`;
  const token = c.env.TELEGRAM_BOT_TOKEN;

  if (!token) return c.json({ error: "Token not found" }, 400);

  const telegramApi = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
  
  try {
    const res = await fetch(telegramApi);
    const data = await res.json();
    return c.json({ success: true, telegram_response: data });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.get('/health', (c) => {
  return c.json({ status: "healthy", service: "digikawsay-cf-worker", version: "3.0.0" });
});

// Project Management
app.post('/admin/create_project', async (c) => {
  const body = await c.req.json();
  const { name, seed_prompt, description = "", max_participants = 10, pilot_duration_days = 7 } = body;
  
  const projectId = crypto.randomUUID();
  
  await c.env.DB.prepare(
    `INSERT INTO projects (project_id, name, seed_prompt, description, max_participants, pilot_duration_days, created_by) 
     VALUES (?, ?, ?, ?, ?, ?, 'admin')`
  ).bind(projectId, name, seed_prompt, description, max_participants, pilot_duration_days).run();
  
  await c.env.DB.prepare(
    `INSERT INTO cycles (project_id, cycle_id, phase) VALUES (?, 1, 'INVESTIGACION')`
  ).bind(projectId).run();

  return c.json({
    status: "success",
    project_id: projectId,
    name: name,
    invite_url_template: `https://t.me/<BOT_USERNAME>?start=${projectId}`
  });
});

app.get('/admin/projects', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT project_id, name, seed_prompt, status, created_at, max_participants, pilot_duration_days 
     FROM projects ORDER BY created_at DESC`
  ).all();
  return c.json({ projects: results });
});

// Participant Reg
app.post('/admin/register_participant', async (c) => {
  const { project_id, display_name } = await c.req.json();
  const invite_token = crypto.randomUUID().substring(0, 8);
  const placeholder_id = `pending_${invite_token}`;
  
  await c.env.DB.prepare(
    `INSERT INTO participants (participant_id, project_id, display_name, invite_token, status)
     VALUES (?, ?, ?, ?, 'invited')`
  ).bind(placeholder_id, project_id, display_name, invite_token).run();

  return c.json({
    status: "success",
    invite_token: invite_token,
    display_name: display_name
  });
});

app.get('/admin/participants/:project_id', async (c) => {
  const projectId = c.req.param('project_id');
  const { results } = await c.env.DB.prepare(
    `SELECT participant_id, display_name, status, consent_given, first_message_at, last_message_at
     FROM participants WHERE project_id = ? ORDER BY last_message_at DESC`
  ).bind(projectId).all();
  
  return c.json({ participants: results });
});

// Dashboard Web
app.get('/admin/dashboard', async (c) => {
  const { results: projects } = await c.env.DB.prepare(`SELECT * FROM projects ORDER BY created_at DESC`).all();
  const projectId = projects.length > 0 ? (projects[0] as any).project_id : null;
  
  let participants: any[] = [];
  if (projectId) {
     const { results } = await c.env.DB.prepare(`SELECT * FROM participants WHERE project_id = ? ORDER BY registered_at DESC`).bind(projectId).all();
     participants = results;
  }
  
  return c.html(<DashboardView projects={projects} participants={participants} />);
});

app.post('/admin/register_participant_web', async (c) => {
  const body = await c.req.parseBody();
  const projectId = String(body.project_id);
  const names = String(body.names).split('\\n').map(n => n.trim()).filter(n => n.length > 0);
  
  for (const name of names) {
     const invite_token = crypto.randomUUID().substring(0, 8);
     const placeholder_id = `pending_${invite_token}`;
     await c.env.DB.prepare(
       `INSERT INTO participants (participant_id, project_id, display_name, invite_token, status)
        VALUES (?, ?, ?, ?, 'invited')`
     ).bind(placeholder_id, projectId, name, invite_token).run();
  }
  return c.redirect('/admin/dashboard');
});

// Wizard of Oz Directives
app.post('/admin/inject_directive', async (c) => {
  const { participant_id, project_id = "demo", cycle_id = 1, content, urgency = "MEDIUM" } = await c.req.json();
  const directiveId = crypto.randomUUID();
  
  await c.env.DB.prepare(
    `INSERT INTO wizard_directives (id, participant_id, project_id, content, urgency, status, issued_by)
     VALUES (?, ?, ?, ?, ?, 'PENDING', 'human_investigator')`
  ).bind(directiveId, participant_id, project_id, content, urgency).run();
  
  return c.json({ status: "success", directive_id: directiveId });
});

// Woz Web
app.get('/admin/woz', async (c) => {
  const { results: projects } = await c.env.DB.prepare(`SELECT * FROM projects ORDER BY created_at DESC`).all();
  const projectId = projects.length > 0 ? (projects[0] as any).project_id : null;
  
  let participants: any[] = [];
  if (projectId) {
     const { results } = await c.env.DB.prepare(`SELECT * FROM participants WHERE project_id = ? ORDER BY registered_at DESC`).bind(projectId).all();
     participants = results;
  }
  
  return c.html(<WozView projects={projects} participants={participants} />);
});

app.post('/admin/inject_directive_web', async (c) => {
  const body = await c.req.parseBody();
  const { participant_id, project_id, content, urgency } = body;
  
  const directiveId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO wizard_directives (id, participant_id, project_id, content, urgency, status, issued_by)
     VALUES (?, ?, ?, ?, ?, 'PENDING', 'human_investigator')`
  ).bind(directiveId, String(participant_id), String(project_id), String(content), String(urgency)).run();
  
  return c.redirect('/admin/woz');
});

export default app;
