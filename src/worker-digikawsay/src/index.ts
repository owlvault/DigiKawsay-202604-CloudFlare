import { Hono } from 'hono';
import { runAgentCycle } from './agent';

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
  return c.text('DigiKawsay API - Cloudflare Edge Native (v3.0.0). Operativo.');
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

// Setup Wizard para Telegram
app.get('/admin/setup_telegram', (c) => {
  const currentUrl = new URL(c.req.url);
  const webhookUrl = `${currentUrl.protocol}//${currentUrl.host}/webhook`;
  const tokenExists = c.env.TELEGRAM_BOT_TOKEN && c.env.TELEGRAM_BOT_TOKEN.length > 10;

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Wizard: Conexión Telegram</title>
      <style>
        body { font-family: 'Inter', sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; display: flex; justify-content: center; }
        .card { background: #1e293b; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); max-width: 500px; width: 100%; }
        h1 { color: #38bdf8; font-size: 24px; margin-top: 0; }
        .status { padding: 1rem; border-radius: 8px; margin-bottom: 20px; font-weight: bold; }
        .status.ok { background: #064e3b; color: #34d399; }
        .status.bad { background: #7f1d1d; color: #fca5a5; }
        button { background: #0ea5e9; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 16px; cursor: pointer; width: 100%; transition: background 0.2s; }
        button:hover { background: #0284c7; }
        code { background: #334155; padding: 4px; border-radius: 4px; color: #cbd5e1; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>🔌 Asistente de Conexión a Telegram</h1>
        <p>Este wizard enlazará automáticamente tu Worker de Cloudflare con tu Bot de Telegram.</p>
        
        <div class="status ${tokenExists ? 'ok' : 'bad'}">
          Estado del Token: ${tokenExists ? 'Configurado Correctamente' : '⚠️ FALTA. Añádelo con wrangler secret put'}
        </div>
        
        <p><strong>Webhook a registrar:</strong><br><code>${webhookUrl}</code></p>
        
        <form action="/admin/setup_telegram" method="POST">
          <button type="submit" ${!tokenExists ? 'disabled style="background:#475569;cursor:not-allowed;"' : ''}>
            ${tokenExists ? 'Vincular Webhook Ahora' : 'Token Faltante'}
          </button>
        </form>
      </div>
    </body>
    </html>
  `;
  return c.html(html);
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

export default app;
