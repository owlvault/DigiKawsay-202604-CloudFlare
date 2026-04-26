import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  ASSETS: Fetcher
  APP_VERSION: string
  APP_ENV: string
  // Phase 2 — uncomment when D1 is provisioned:
  // DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (c) => {
  return c.json({
    status: 'nominal',
    service: 'planeta-prisma',
    version: c.env.APP_VERSION,
    env: c.env.APP_ENV,
    timestamp: new Date().toISOString(),
  })
})

// ── Telemetry  ────────────────────────────────────────────────────────────────
// Phase 1: accepts and acknowledges behaviour logs from the SPA.
// Phase 2: persists to D1, feeds the AI Tutor inference pipeline.
app.post('/api/telemetry', async (c) => {
  let payload: unknown
  try {
    payload = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  // TODO (Phase 2): await c.env.DB.prepare('INSERT INTO telemetry …').run(…)
  console.log('[telemetry]', JSON.stringify(payload))

  return c.json({ received: true, timestamp: new Date().toISOString() })
})

// ── Challenge seed (Phase 2 stub) ─────────────────────────────────────────────
// Returns the canonical challenge set. Keeps SPA data-driven from the edge.
app.get('/api/challenges', (c) => {
  return c.json({
    version: c.env.APP_VERSION,
    note: 'Phase 1 — challenges are bundled in the SPA. Phase 2 will serve them dynamically.',
  })
})

// ── SPA fallback ──────────────────────────────────────────────────────────────
// All non-API requests are handled by the ASSETS binding.
// not_found_handling = "single-page-application" in wrangler.jsonc ensures
// any unknown path returns index.html (client-side routing support).
app.get('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
