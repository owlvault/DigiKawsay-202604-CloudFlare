import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
  GCP_PROJECT_ID: string;
  GCP_PUBSUB_TOPIC_INBOUND: string;
  TELEGRAM_BOT_TOKEN: string;
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
// Telegram Webhook Handler (Replacement for channel-layer)
// ==========================================
app.post('/webhook', async (c) => {
  const payload = await c.req.json();
  
  // Quick validation
  if (!payload || (!payload.message && !payload.callback_query)) {
    return c.json({ status: "ignored" });
  }

  // To publish to GCP Pub/Sub from CF Workers via REST API, you would normally generate 
  // an OAuth JWT from a Google Service Account Private Key and call the PubSub REST API.
  // For MVP purposes, this skeleton acknowledges receipt and queues it.
  
  // TODO: Add GCP JWT Signature Logic here. 
  // Example REST call: POST https://pubsub.googleapis.com/v1/projects/{c.env.GCP_PROJECT_ID}/topics/{c.env.GCP_PUBSUB_TOPIC_INBOUND}:publish

  console.log(`Received Telegram message:`, JSON.stringify(payload));
  // Offload long-running task to ctx.waitUntil() if necessary.
  
  return c.json({ status: "ok" });
});

// ==========================================
// Admin API (Replacement for agente00-service)
// ==========================================
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
