// Telemetry service — writes structured log entries to localStorage.
// Designed as a drop-in adapter: swap persistToLocal for an API call in Phase 2.

const STORAGE_KEY = 'pp_behavior_log'
const SESSION_KEY = 'pp_session_id'

function getSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

function loadLog() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveLog(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Storage quota exceeded — trim oldest 20% and retry
    const trimmed = entries.slice(Math.floor(entries.length * 0.2))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  }
}

export const UserBehaviorLog = {
  record(entry) {
    const enriched = {
      sessionId: getSessionId(),
      clientTimestamp: new Date().toISOString(),
      ...entry,
    }
    const log = loadLog()
    log.push(enriched)
    saveLog(log)
    return enriched
  },

  getAll() {
    return loadLog()
  },

  // ── Aggregate helpers for Phase 2 AI tutor ───────────────────────────────

  getPathPreferences() {
    const log = loadLog()
    const counts = { A: 0, B: 0 }
    log.forEach((e) => {
      if (e.chosenPath === 'A') counts.A++
      else if (e.chosenPath === 'B') counts.B++
    })
    return counts
  },

  getAverageLatencyByBiome() {
    const log = loadLog()
    const byBiome = {}
    log.forEach((e) => {
      if (!byBiome[e.biomeId]) byBiome[e.biomeId] = { total: 0, count: 0 }
      byBiome[e.biomeId].total += e.latencyMs || 0
      byBiome[e.biomeId].count++
    })
    return Object.fromEntries(
      Object.entries(byBiome).map(([k, v]) => [k, Math.round(v.total / v.count)])
    )
  },

  getAbandonmentRate() {
    const log = loadLog()
    if (log.length === 0) return 0
    const abandoned = log.filter((e) => e.abandoned === true).length
    return Math.round((abandoned / log.length) * 100)
  },

  exportJSON() {
    return JSON.stringify(loadLog(), null, 2)
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY)
  },
}
