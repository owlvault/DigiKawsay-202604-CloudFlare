import { jsx } from 'hono/jsx';
import type { FC } from 'hono/jsx';

// ==========================================
// Base Corporate Layout (H+ / DigiKawsay)
// ==========================================
export const Layout: FC<{ children: any, showSidebar?: boolean }> = ({ children, showSidebar }) => (
  <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>DigiKawsay Admin | H+</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&family=Roboto+Mono&display=swap');
        body { font-family: 'Montserrat', sans-serif; background-color: #F8F8F5; }
        .font-mono { font-family: 'Roboto Mono', monospace; }
        .text-hplus-blue { color: #002D5A; }
        .bg-hplus-blue { background-color: #002D5A; }
        .text-val-orange { color: #FF9D00; }
        .bg-val-orange { background-color: #FF9D00; }
        .bg-val-gradient { background: linear-gradient(135deg, #FFAA00 0%, #FF8800 100%); }
        .glass-card { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(10px); border: 1px solid rgba(0, 45, 90, 0.1); }
      `}} />
    </head>
    <body class="text-slate-800 antialiased min-h-screen flex">
      {showSidebar !== false && (
      <aside class="w-64 bg-hplus-blue text-white flex-col p-6 shadow-xl z-10 hidden md:flex">
         <div class="text-2xl font-bold bg-val-gradient bg-clip-text text-transparent mb-12">
            H+ DigiKawsay
         </div>
         <nav class="flex-1 space-y-2">
            <a href="/admin/lobby" class="block py-2 px-4 rounded hover:bg-white/10 transition">🚀 Lanzar Piloto</a>
            <a href="/admin/dashboard" class="block py-2 px-4 rounded hover:bg-white/10 transition">👥 Participantes</a>
            <a href="/admin/woz" class="block py-2 px-4 rounded hover:bg-white/10 transition text-val-orange font-bold flex items-center justify-between">
              <span>👁️ Consola VAL</span>
              <span id="live-indicator" class="hidden w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_#4ade80] animate-pulse"></span>
            </a>
            <a href="/admin/analytics" class="block py-2 px-4 rounded hover:bg-white/10 transition">📈 Analítica del Equipo</a>
            <a href="/admin/tuning" class="block py-2 px-4 rounded hover:bg-white/10 transition border-t border-white/20 mt-4 pt-4">⚙️ Tuning LLM</a>
         </nav>
         <div class="mt-auto pt-4 border-t border-white/20">
            <div class="text-xs text-slate-300 mb-2 truncate">🤖 Sesión activa</div>
            <a href="/admin/logout" class="block w-full py-2 px-4 rounded bg-red-900/50 hover:bg-red-800 transition text-sm text-center">🚪 Cerrar Sesión</a>
         </div>
      </aside>
      )}
      <main class="flex-1 p-8 relative overflow-y-auto">
        <div class="absolute inset-0 opacity-5 pointer-events-none" style="background-image: radial-gradient(#002D5A 2px, transparent 2px); background-size: 30px 30px;"></div>
        <div class="relative z-10 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </body>
  </html>
);

// ==========================================
// View 0: Auth (Login & Setup)
// ==========================================

export const LoginView: FC<{ error?: string }> = ({ error }) => (
  <Layout showSidebar={false}>
    <div class="min-h-[80vh] flex items-center justify-center">
      <div class="glass-card p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-300">
        <div class="text-center mb-8">
           <div class="text-3xl font-bold bg-val-gradient bg-clip-text text-transparent mb-2">H+ DigiKawsay</div>
           <p class="text-sm text-slate-500 font-mono">Terminal de Comando Central</p>
        </div>
        
        {error && <div class="bg-red-100 border border-red-200 text-red-800 p-3 rounded mb-6 text-sm">{error}</div>}

        <form method="POST" action="/admin/login_web">
          <label class="block text-sm font-bold text-hplus-blue mb-1">Nombre de Usuario</label>
          <input type="text" name="username" class="w-full p-3 mb-4 rounded bg-slate-50 border border-slate-200 focus:ring-val-orange" required autocomplete="username" />
          
          <label class="block text-sm font-bold text-hplus-blue mb-1">Contraseña Encriptada</label>
          <input type="password" name="password" class="w-full p-3 mb-6 rounded bg-slate-50 border border-slate-200 focus:ring-val-orange" required autocomplete="current-password" />
          
          <button type="submit" class="w-full bg-hplus-blue text-white font-bold py-3 rounded-lg hover:bg-blue-900 shadow-md transition-all">
            Descifrar e Ingresar
          </button>
        </form>
      </div>
    </div>
  </Layout>
);

export const SetupAdminView: FC<{}> = () => (
  <Layout showSidebar={false}>
    <div class="min-h-[80vh] flex items-center justify-center">
      <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border-t-4 border-val-orange">
        <div class="text-center mb-6">
           <div class="text-2xl font-bold text-hplus-blue mb-2">Bootstrap de Seguridad</div>
           <p class="text-sm text-slate-500">No se han detectado administradores. Estás nombrando al usuario raíz del enjambre.</p>
        </div>

        <form method="POST" action="/admin/setup_web">
          <label class="block text-sm font-bold text-hplus-blue mb-1">Usuario Raíz</label>
          <input type="text" name="username" class="w-full p-3 mb-4 rounded bg-slate-50 border border-slate-200" required />
          
          <label class="block text-sm font-bold text-hplus-blue mb-1">Contraseña (Mínimo 8 chars)</label>
          <input type="password" name="password" class="w-full p-3 mb-6 rounded bg-slate-50 border border-slate-200" required minlength="8" />
          
          <button type="submit" class="w-full bg-val-gradient text-white font-bold py-3 rounded-lg shadow-md transition-all">
            Crear Identidad Genesis
          </button>
        </form>
      </div>
    </div>
  </Layout>
);

// ==========================================
// View 1: Lobby (Setup)
// ==========================================
export const LobbyView: FC<{ webhookUrl: string, tokenOk: boolean }> = ({ webhookUrl, tokenOk }) => (
  <Layout>
    <h1 class="text-4xl text-hplus-blue font-bold mb-8">Asistente de Arranque (Piloto)</h1>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Pasos */}
      <div class="glass-card p-6 rounded-xl shadow-lg">
        <h2 class="text-xl font-bold text-hplus-blue mb-4">1. Infraestructura Edge</h2>
        <div class={`p-4 rounded-lg font-bold mb-4 ${tokenOk ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          Token de Telegram: {tokenOk ? 'Detectado y Seguro' : 'Faltante (Inyectar vía Wrangler)'}
        </div>
        <form method="POST" action="/admin/setup_telegram" class="mb-6">
          <input type="hidden" name="webhookUrl" value={webhookUrl} />
          <button type="submit" disabled={!tokenOk} class="w-full bg-hplus-blue text-white py-2 rounded-lg hover:bg-blue-900 transition disabled:opacity-50">
            Vincular Webhook Inmediatamente
          </button>
        </form>

        <hr class="border-t border-slate-300 my-6" />

        <h2 class="text-xl font-bold text-hplus-blue mb-4">2. Crear Entorno Operativo</h2>
        <form method="POST" action="/admin/create_project_web">
          <label class="block text-sm font-semibold mb-1">Nombre del Piloto</label>
          <input type="text" name="name" class="w-full p-2 mb-4 border rounded focus:ring-val-orange" placeholder="Ej: Diagnóstico UX/UI Q3" required />
          
          <label class="block text-sm font-semibold mb-1">Pregunta Semilla (Comienzo del Foro)</label>
          <textarea name="seed_prompt" rows="3" class="w-full p-2 mb-4 border rounded focus:ring-val-orange" placeholder="¿Cómo te sientes frente al cambio tecnológico?" required></textarea>
          
          <button type="submit" class="w-full bg-val-gradient text-white font-bold py-3 rounded-lg shadow-md hover:opacity-90 transition">
            Crear Estructura en D1 (Lanzar)
          </button>
        </form>
      </div>

      <div class="p-6 rounded-xl border border-slate-300 bg-white/50">
        <h3 class="text-lg font-bold text-hplus-blue mb-2">Instrucciones:</h3>
        <p class="text-sm mb-4">Este asistente configurará automáticamente el proyecto dentro de la base de datos distribuida D1 y ajustará el API oficial de Telegram en Cloudflare.</p>
        <p class="text-sm">Una vez lanzado el piloto, diríjase al Tablero de Control para generar los Enlaces Mágicos de acceso.</p>
      </div>
    </div>
  </Layout>
);

// ==========================================
// View 2: Dashboard (Status & Invites)
// ==========================================
export const DashboardView: FC<{ projects: any[], participants: any[] }> = ({ projects, participants }) => {
  const activeProject = projects.length > 0 ? projects[0] : null;

  return (
    <Layout>
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-4xl text-hplus-blue font-bold">Tablero de Control</h1>
        {activeProject && (
          <span class="px-4 py-2 bg-blue-100 text-hplus-blue rounded-full font-bold shadow-sm">
            Piloto Activo: {activeProject.name}
          </span>
        )}
      </div>
      
      {!activeProject ? (
        <div class="glass-card p-6 text-center text-slate-500 rounded-xl">No hay proyectos activos. Usa el Lanzador.</div>
      ) : (
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div class="lg:col-span-1 glass-card p-6 rounded-xl shadow-lg border-t-4 border-hplus-blue">
            <h2 class="text-xl font-bold text-hplus-blue mb-4">Añadir Múltiples Participantes</h2>
            <form method="POST" action="/admin/register_participant_web">
                <input type="hidden" name="project_id" value={activeProject.project_id} />
                <textarea name="names" rows="5" class="w-full p-2 mb-4 border rounded font-mono text-sm" placeholder="Juan Perez\nMaria Lopez\nAnonimo 3" required></textarea>
                <button type="submit" class="w-full bg-hplus-blue text-white py-2 rounded-lg hover:bg-blue-900 transition shadow">
                  Generar Enlaces (Magic Links)
                </button>
            </form>
          </div>

          <div class="lg:col-span-2 glass-card p-6 rounded-xl shadow-lg">
            <h2 class="text-xl font-bold text-hplus-blue mb-4">Participantes en Tiempo Real</h2>
            <div class="overflow-x-auto">
              <table class="w-full text-sm text-left">
                <thead class="text-xs text-hplus-blue uppercase bg-blue-50/50">
                  <tr>
                    <th class="px-4 py-3">Nombre</th>
                    <th class="px-4 py-3">Estado</th>
                    <th class="px-4 py-3">Enlace Único</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p) => (
                    <tr class="border-b border-slate-100">
                      <td class="px-4 py-3 font-semibold">{p.display_name}</td>
                      <td class="px-4 py-3">
                         <span class={`px-2 py-1 rounded-full text-xs font-bold ${p.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                           {p.status}
                         </span>
                      </td>
                      <td class="px-4 py-3 font-mono text-xs text-blue-600">
                        {p.status === 'invited' ? `https://t.me/VAL_Digi_bot?start=${p.invite_token}` : 'Aceptado'}
                      </td>
                    </tr>
                  ))}
                  {participants.length === 0 && <tr><td colSpan="3" class="text-center py-4 text-slate-400">Sin participantes registrados.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

// ==========================================
// Helpers for Analytics View
// ==========================================

const EMOTION_COLORS: Record<string, string> = {
  OPEN:       'bg-green-500',
  GUARDED:    'bg-yellow-400',
  RESISTANT:  'bg-orange-500',
  DISTRESSED: 'bg-red-600',
  NEUTRAL:    'bg-slate-400',
};

const PRAXIS_COLORS: Record<string, string> = {
  PROPUESTA_ACCION:  'bg-blue-500',
  REFLEXION_PASIVA:  'bg-slate-400',
  CATARSIS:          'bg-red-400',
};

const EmotionLabel: Record<string, string> = {
  OPEN: 'Abierto', GUARDED: 'Cauteloso', RESISTANT: 'Resistente',
  DISTRESSED: 'Angustia', NEUTRAL: 'Neutral',
};

const PraxisLabel: Record<string, string> = {
  PROPUESTA_ACCION: 'Propuesta de Acción',
  REFLEXION_PASIVA: 'Reflexión Pasiva',
  CATARSIS: 'Catarsis',
};

function DistBar({ label, count, total, colorClass }: { label: string; count: number; total: number; colorClass: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div class="mb-3">
      <div class="flex justify-between text-sm mb-1">
        <span class="font-medium text-slate-700">{label}</span>
        <span class="text-slate-500 font-mono">{count} ({pct}%)</span>
      </div>
      <div class="w-full bg-slate-100 rounded-full h-3">
        <div class={`${colorClass} h-3 rounded-full transition-all`} style={`width:${pct}%`}></div>
      </div>
    </div>
  );
}

const ALERT_STYLES: Record<string, string> = {
  red:    'bg-red-50 border-red-300 text-red-800',
  orange: 'bg-orange-50 border-orange-300 text-orange-800',
  blue:   'bg-blue-50 border-blue-300 text-blue-800',
};
const ALERT_ICONS: Record<string, string> = { red: '🔴', orange: '🟠', blue: '🔵' };

const EMOTION_INTERP: Record<string, string> = {
  OPEN:       'Participantes receptivos y con disposición a explorar. Buen momento para profundizar con directivas.',
  GUARDED:    'Cautela presente — el equipo evalúa antes de abrirse. Mantén ritmo de escucha sin presionar.',
  RESISTANT:  'Resistencia activa. Investiga la causa antes de proponer cambios.',
  DISTRESSED: 'Señales de angustia o burnout. Prioriza Safe Harbor y apoyo emocional sobre exploración.',
  NEUTRAL:    'Tono descriptivo sin carga emocional. Puede indicar respuestas formulaicas o bajo engagement.',
};

const PRAXIS_INTERP: Record<string, string> = {
  PROPUESTA_ACCION: 'El equipo genera ideas de mejora. Momento oportuno para co-diseño y priorización.',
  CATARSIS:         'Predominan quejas sin propuestas. Escucha activa antes de avanzar — el desahogo es necesario.',
  REFLEXION_PASIVA: 'El equipo observa y describe. Profundiza con preguntas situacionales para activar agencia.',
};

// ==========================================
// View 4: Analytics
// ==========================================

export const AnalyticsView: FC<{ projects: any[]; projectId: string; analytics: any }> = ({ projects, projectId, analytics }) => {
  const totalEmotions = analytics ? Object.values(analytics.emotion_distribution as Record<string, number>).reduce((a: number, b: number) => a + b, 0) : 0;
  const totalPraxis = analytics ? Object.values(analytics.praxis_distribution as Record<string, number>).reduce((a: number, b: number) => a + b, 0) : 0;
  const dominantEmotion = analytics
    ? Object.entries(analytics.emotion_distribution as Record<string, number>).sort(([,a],[,b]) => b-a)[0]?.[0]
    : null;
  const dominantPraxis = analytics
    ? Object.entries(analytics.praxis_distribution as Record<string, number>).sort(([,a],[,b]) => b-a)[0]?.[0]
    : null;

  return (
    <Layout>
      {/* Header */}
      <div class="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
          <h1 class="text-4xl text-hplus-blue font-bold">Analítica del Equipo</h1>
          {analytics && <p class="text-slate-500 mt-1">{analytics.project_name}</p>}
        </div>
        <div class="flex gap-2 items-center flex-wrap">
          <form method="GET" action="/admin/analytics" class="flex gap-2">
            <select name="project_id" class="p-2 border rounded text-sm bg-white shadow-sm">
              {projects.map((p: any) => (
                <option value={p.project_id} selected={p.project_id === projectId}>{p.name}</option>
              ))}
            </select>
            <button type="submit" class="px-4 py-2 bg-hplus-blue text-white rounded text-sm shadow-sm hover:bg-blue-900 transition">
              Ver
            </button>
          </form>
          {analytics && (
            <a href={`/admin/export/${analytics.project_id}`}
               class="px-4 py-2 bg-green-700 text-white rounded text-sm shadow-sm hover:bg-green-800 transition font-semibold flex items-center gap-1">
              ⬇ Exportar CSV
            </a>
          )}
        </div>
      </div>

      {!analytics ? (
        <div class="glass-card p-8 text-center text-slate-500 rounded-xl">
          No hay datos aún. Cuando los participantes inicien conversaciones, la analítica aparecerá aquí.
        </div>
      ) : (
        <>
          {/* Alertas */}
          {(analytics.alerts as Array<{ level: string; message: string }>).length > 0 && (
            <div class="mb-6 space-y-3">
              {(analytics.alerts as Array<{ level: string; message: string }>).map(alert => (
                <div class={`border rounded-xl px-5 py-4 flex gap-3 items-start text-sm font-medium ${ALERT_STYLES[alert.level] || 'bg-slate-50 border-slate-300 text-slate-700'}`}>
                  <span class="text-base">{ALERT_ICONS[alert.level] || '⚠️'}</span>
                  <span>{alert.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Resumen ejecutivo */}
          <div class="glass-card p-5 rounded-xl border border-blue-100 bg-blue-50/40 mb-8">
            <div class="text-xs font-bold text-hplus-blue uppercase mb-2 tracking-wide">Resumen ejecutivo</div>
            <p class="text-slate-700 text-sm leading-relaxed">{analytics.executive_summary}</p>
          </div>

          {/* KPIs */}
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Turnos totales', value: analytics.total_turns, sub: 'mensajes analizados' },
              { label: 'Participantes activos', value: `${analytics.active_participants} / ${analytics.total_participants}`, sub: 'con conversación' },
              { label: 'Saberes detectados', value: analytics.saberes_detectados.length, sub: 'tipos únicos' },
              { label: 'Directivas pendientes', value: analytics.pending_directives, sub: 'sin aplicar' },
            ].map(kpi => (
              <div class="glass-card p-5 rounded-xl shadow-sm text-center">
                <div class="text-3xl font-bold text-hplus-blue mb-1">{kpi.value}</div>
                <div class="text-sm font-semibold text-slate-700">{kpi.label}</div>
                <div class="text-xs text-slate-400 mt-0.5">{kpi.sub}</div>
              </div>
            ))}
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Distribución emocional */}
            <div class="glass-card p-6 rounded-xl shadow-sm">
              <h2 class="text-lg font-bold text-hplus-blue mb-1">Registro Emocional</h2>
              <p class="text-xs text-slate-400 mb-4">Estado afectivo dominante en los mensajes de los participantes</p>
              {Object.entries(analytics.emotion_distribution as Record<string, number>)
                .sort(([, a], [, b]) => b - a)
                .map(([emotion, count]) => (
                  <DistBar
                    label={EmotionLabel[emotion] || emotion}
                    count={count as number}
                    total={totalEmotions}
                    colorClass={EMOTION_COLORS[emotion] || 'bg-slate-400'}
                  />
                ))}
              {totalEmotions === 0 && <p class="text-slate-400 text-sm">Sin datos de emoción aún.</p>}
              {dominantEmotion && EMOTION_INTERP[dominantEmotion] && (
                <div class="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
                  <strong>Interpretación:</strong> {EMOTION_INTERP[dominantEmotion]}
                </div>
              )}
            </div>

            {/* Distribución de praxis */}
            <div class="glass-card p-6 rounded-xl shadow-sm">
              <h2 class="text-lg font-bold text-hplus-blue mb-1">Indicador de Praxis (Fals Borda)</h2>
              <p class="text-xs text-slate-400 mb-4">¿El equipo describe, se queja o propone? (clasificación IAP)</p>
              {Object.entries(analytics.praxis_distribution as Record<string, number>)
                .sort(([, a], [, b]) => b - a)
                .map(([praxis, count]) => (
                  <DistBar
                    label={PraxisLabel[praxis] || praxis}
                    count={count as number}
                    total={totalPraxis}
                    colorClass={PRAXIS_COLORS[praxis] || 'bg-slate-400'}
                  />
                ))}
              {totalPraxis === 0 && <p class="text-slate-400 text-sm">Sin datos de praxis aún.</p>}
              {dominantPraxis && PRAXIS_INTERP[dominantPraxis] && (
                <div class="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
                  <strong>Interpretación:</strong> {PRAXIS_INTERP[dominantPraxis]}
                </div>
              )}
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Shadow IT / Saberes */}
            <div class="glass-card p-6 rounded-xl shadow-sm">
              <h2 class="text-lg font-bold text-hplus-blue mb-1">Shadow IT y Saberes Tácitos</h2>
              <p class="text-xs text-slate-400 mb-4">Herramientas no oficiales y conocimiento no documentado detectado en el discurso</p>
              {analytics.saberes_detectados.length === 0 ? (
                <p class="text-slate-400 text-sm">Sin saberes detectados aún.</p>
              ) : (
                <>
                  <div class="flex flex-wrap gap-2 mb-3">
                    {(analytics.saberes_detectados as Array<{ saber: string; count: number }>).map(({ saber, count }) => (
                      <span class="px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-800 rounded-full text-sm font-medium">
                        {saber} <span class="ml-1 text-orange-400 font-mono text-xs">×{count}</span>
                      </span>
                    ))}
                  </div>
                  <div class="bg-orange-50 border border-orange-100 rounded-lg p-3 text-xs text-orange-700">
                    <strong>Qué hacer:</strong> Cada saber detectado es un gap entre el sistema formal y la práctica real. Son candidatos directos para rediseño de procesos o herramientas.
                  </div>
                </>
              )}
            </div>

            {/* Estructuras opresivas */}
            <div class="glass-card p-6 rounded-xl shadow-sm">
              <h2 class="text-lg font-bold text-hplus-blue mb-1">Estructuras Opresivas</h2>
              <p class="text-xs text-slate-400 mb-4">Barreras sistémicas y obstáculos detectados en el discurso del equipo</p>
              {analytics.oppressive_structures.length === 0 ? (
                <p class="text-slate-400 text-sm">Sin estructuras detectadas aún.</p>
              ) : (
                <>
                  <div class="flex flex-wrap gap-2 mb-3">
                    {(analytics.oppressive_structures as Array<{ structure: string; count: number }>).map(({ structure, count }) => (
                      <span class="px-3 py-1.5 bg-red-50 border border-red-200 text-red-800 rounded-full text-sm font-medium">
                        {structure} <span class="ml-1 text-red-400 font-mono text-xs">×{count}</span>
                      </span>
                    ))}
                  </div>
                  <div class="bg-red-50 border border-red-100 rounded-lg p-3 text-xs text-red-700">
                    <strong>Qué hacer:</strong> Las estructuras con mayor frecuencia son las que más pesan en la experiencia del equipo. Inclúyelas en el informe de ciclo IAP como prioridades de atención.
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Tabla de participantes */}
          <div class="glass-card p-6 rounded-xl shadow-sm">
            <h2 class="text-lg font-bold text-hplus-blue mb-4">Profundidad por Participante</h2>
            <div class="overflow-x-auto">
              <table class="w-full text-sm text-left">
                <thead class="text-xs text-hplus-blue uppercase bg-blue-50/50">
                  <tr>
                    <th class="px-4 py-3">Participante</th>
                    <th class="px-4 py-3 text-center">Turnos</th>
                    <th class="px-4 py-3 text-center">Emoción actual</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics.top_participants as Array<{ display_name: string; turn_count: number; emotional_register: string }>)
                    .map(p => (
                      <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td class="px-4 py-3 font-semibold">{p.display_name}</td>
                        <td class="px-4 py-3 text-center font-mono font-bold text-hplus-blue">{p.turn_count || 0}</td>
                        <td class="px-4 py-3 text-center">
                          <span class={`px-2 py-1 rounded-full text-xs font-bold text-white ${EMOTION_COLORS[p.emotional_register] || 'bg-slate-400'}`}>
                            {EmotionLabel[p.emotional_register] || p.emotional_register || 'N/A'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  {analytics.top_participants.length === 0 && (
                    <tr><td colSpan={3} class="text-center py-6 text-slate-400">Sin actividad registrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
};

// ==========================================
// View 3: Wizard of Oz (VAL Console - Realtime)
// ==========================================
export const WozView: FC<{ projects: any[], participants: any[] }> = ({ projects, participants }) => {
  const activeProject = projects.length > 0 ? projects[0] : null;
  const activeParticipants = participants.filter(p => p.status === 'active' || p.status === 'invited');
  
  return (
    <Layout>
      <div class="flex items-center space-x-3 mb-8">
        <h1 class="text-4xl text-hplus-blue font-bold">Consola VAL Real-Time</h1>
        <span id="status-badge" class="bg-slate-400 text-white px-3 py-1 rounded-full text-sm font-bold shadow-md">
           Conectando...
        </span>
      </div>

      <div class="glass-card rounded-xl shadow-2xl flex flex-col md:flex-row h-[75vh] overflow-hidden border border-slate-300">
         {/* Lista Lateral (1/4) */}
         <div class="w-full md:w-1/4 bg-slate-50 border-r border-slate-200 flex flex-col">
            <div class="p-4 bg-hplus-blue text-white font-bold text-sm tracking-wider">
               ACTORES ACTIVOS
            </div>
            <div id="participant-list" class="overflow-y-auto p-2 flex-1">
               {activeParticipants.map(p => (
                 <div class="p-3 mb-2 rounded bg-white shadow-sm border-l-4 border-val-orange cursor-pointer hover:bg-slate-100 transition" id={`part-${p.participant_id}`}>
                    <div class="font-bold text-hplus-blue">{p.display_name}</div>
                    <div class="text-xs text-slate-500 font-mono mt-1">ID: {p.participant_id.substring(0,8)}...</div>
                 </div>
               ))}
            </div>
            
            {/* Directives form en la barra lateral debajo */}
            <div class="p-4 border-t border-slate-200 bg-white shadow-inner">
               <div class="text-xs font-bold text-val-orange mb-2 uppercase">Inyectar Directiva (WoZ)</div>
               <form method="POST" action="/admin/inject_directive_web">
                 <input type="hidden" name="project_id" value={activeProject?.project_id || ''} />
                 <select name="participant_id" class="w-full p-2 mb-2 text-xs bg-slate-50 border border-slate-200 rounded">
                    {activeParticipants.map(p => <option value={p.participant_id}>{p.display_name}</option>)}
                 </select>
                 <textarea name="content" rows="2" class="w-full p-2 mb-2 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-val-orange" placeholder="Fuerza un cambio de tema..." required></textarea>
                 <button type="submit" class="w-full bg-val-orange text-white text-xs font-bold py-2 rounded hover:bg-orange-600 transition shadow">
                   EJECUTAR INYECCIÓN
                 </button>
               </form>
            </div>
         </div>

         {/* Human Feed (Chat) (2/4) */}
         <div class="w-full md:w-2/4 flex flex-col bg-white border-r border-slate-200 relative">
            <div class="p-4 bg-slate-100 text-slate-700 font-bold text-sm tracking-wider flex justify-between border-b border-slate-200">
               <span>FEED CONVERSACIONAL</span>
               <span class="text-xs text-slate-400 font-normal">Mundo Humano</span>
            </div>
            <div id="chat-feed" class="flex-1 overflow-y-auto p-4 space-y-4">
               {/* Llenado por JS */}
               <div class="text-center text-slate-400 text-sm mt-10">Esperando interceptación de paquetes base...</div>
            </div>
         </div>

         {/* Matrix Log (1/4) */}
         <div class="w-full md:w-1/4 flex flex-col bg-slate-900 text-green-400 font-mono relative">
            <div class="p-4 bg-black/50 text-green-500 font-bold text-xs tracking-wider border-b border-green-900/50 flex justify-between">
               <span>MATRIX (METADATA)</span>
               <span class="animate-pulse">_</span>
            </div>
            <div id="matrix-feed" class="flex-1 overflow-y-auto p-4 space-y-3 text-[10px] break-words">
               {/* Llenado por JS */}
               <div>[SYS] Socket de observación instanciado...</div>
            </div>
         </div>
      </div>

      {activeProject && (
      <script dangerouslySetInnerHTML={{__html: `
        const projectId = '${activeProject.project_id}';
        const chatFeed = document.getElementById('chat-feed');
        const matrixFeed = document.getElementById('matrix-feed');
        const badge = document.getElementById('status-badge');
        const liveDot = document.getElementById('live-indicator');
        
        let lastTime = '1970-01-01 00:00:00';
        let firstLoad = true;

        function scrollBottom(el) {
          el.scrollTop = el.scrollHeight;
        }

        async function poll() {
          try {
            const res = await fetch('/admin/api/live_feed/' + projectId + '?after=' + encodeURIComponent(lastTime));
            if(!res.ok) throw new Error('API down');
            const data = await res.json();
            
            badge.className = 'bg-val-orange text-slate-900 px-3 py-1 rounded-full text-sm font-bold shadow-md';
            badge.innerText = 'Intercepción Activa';
            liveDot.classList.remove('hidden');

            if(data.turns && data.turns.length > 0) {
              if(firstLoad) { chatFeed.innerHTML = ''; firstLoad = false; }
              
              data.turns.forEach(t => {
                // Agregar al Chat Feed
                const html = \`<div class="mb-4">
                   <div class="flex flex-col items-end mb-2">
                     <span class="text-xs text-slate-400 font-bold mb-1">\${t.display_name}</span>
                     <div class="bg-blue-100 text-hplus-blue rounded-xl rounded-tr-none py-2 px-4 max-w-[85%] shadow-sm text-sm">
                       \${t.user_text}
                     </div>
                   </div>
                   <div class="flex flex-col items-start">
                     <span class="text-xs text-val-orange font-bold mb-1">VAL</span>
                     <div class="bg-white border inset-0 border-slate-200 text-slate-800 rounded-xl rounded-tl-none py-2 px-4 max-w-[85%] shadow-sm text-sm">
                       \${t.val_response}
                     </div>
                   </div>
                </div>\`;
                chatFeed.insertAdjacentHTML('beforeend', html);

                // Agregar al Matrix Lógico
                let meta = {};
                try { meta = JSON.parse(t.topics || '{}').metadata || {}; } catch(e){}
                
                const metaHtml = \`<div>
                  <div class="text-green-300">[\${t.timestamp.split(' ')[1]}] ID:\${t.turn_id.substring(0,6)}</div>
                  <div class="text-yellow-400">Class: \${t.emotional_register} | \${t.speech_act}</div>
                  <div class="text-blue-300">Lat: \${meta.latency_ms || '?'}ms | Tks: \${meta.token_usage?.totalTokenCount || '?'}</div>
                  <div class="text-slate-500">---------</div>
                </div>\`;
                matrixFeed.insertAdjacentHTML('beforeend', metaHtml);
              });
              
              lastTime = data.server_time || lastTime;
              scrollBottom(chatFeed);
              scrollBottom(matrixFeed);
            }
          } catch(e) {
            badge.className = 'bg-slate-400 text-white px-3 py-1 rounded-full text-sm font-bold shadow-md';
            badge.innerText = 'Buscando señal...';
            liveDot.classList.add('hidden');
          }
        }

        setInterval(poll, 3000);
        poll(); // first exec
      `}} />
      )}
    </Layout>
  );
};

// ==========================================
// View 5: Agent Tuning (Hot-Reload)
// ==========================================
export const TuningView: FC<{ projects: any[], activeProject: any, params: any }> = ({ projects, activeProject, params }) => {
  const temp = params?.active_temperature ?? 0.7;
  const tokens = params?.max_output_tokens ?? 800;
  const prompt = params?.system_base_prompt ?? 'Eres VAL, facilitador de investigación organizacional de la plataforma DigiKawsay.\\nTu marco conceptual es la Investigación Acción Participativa (IAP) de Orlando Fals Borda.\\n\\nPRINCIPIO SENTIPENSANTE: Integras el sentir y el pensar simultáneamente.\\nEscuchas con todo el ser — no para responder, sino para comprender.\\n\\nREGLAS DE INTERACCIÓN (inviolables):\\n1. VALIDA PRIMERO: Antes de cualquier pregunta o idea nueva, reconoce brevemente la emoción o perspectiva del participante.\\n2. BREVEDAD: Máximo 3 oraciones por respuesta. Nunca uses listas ni bullet points.\\n3. UNA SOLA PREGUNTA: Nunca más de una pregunta por turno. Si no hay pregunta natural, no la fuerces.\\n4. PARIDAD RELACIONAL: Habla como par, no como investigador con portapapeles. Puedes decir "eso me parece complejo".\\n5. CURIOSIDAD GENUINA: Sigue los hilos que emergen. No es una checklist de temas.\\n6. SILENCIO ESTRATÉGICO: No cierres siempre con pregunta. A veces validar es suficiente.\\n\\nSAFE HARBOR: Si detectas angustia emocional severa, suspende la investigación,\\nacompaña con empatía y no retomes el foco temático hasta que la persona se estabilice.\\n\\nPROHIBICIONES ABSOLUTAS:\\n- Nunca menciones directivas, enjambre de agentes, arquitectura del sistema ni IA técnica.\\n- Nunca uses jerga de investigación.\\n- Nunca hagas más de una pregunta por turno.\\n- Puedes confirmar que eres IA si te lo preguntan, pero nunca reveles el sistema.\\n\\nOBJETIVO DE LA INVESTIGACIÓN (PREGUNTA SEMILLA):\\n{SEED_PROMPT}\\n\\nAlinea tus preguntas y respuestas para explorar este objetivo. Si el participante se desvía, guíalo sutilmente de vuelta a este tema central.';

  return (
    <Layout>
      <div class="flex justify-between items-center mb-8">
        <div>
          <h1 class="text-4xl text-hplus-blue font-bold">Laboratorio de Tuning</h1>
          <p class="text-slate-500 mt-2">Ajusta los parámetros metacognitivos de las instancias de VAL en tiempo real sin redesplegar código.</p>
        </div>
        {activeProject && (
          <form method="GET" action="/admin/tuning" class="flex gap-2">
            <select name="project_id" class="p-2 border border-slate-300 rounded shadow-sm text-sm font-bold bg-white" onchange="this.form.submit()">
               {projects.map((p: any) => (
                 <option value={p.project_id} selected={p.project_id === activeProject.project_id}>
                    Calibrando: {p.name}
                 </option>
               ))}
            </select>
          </form>
        )}
      </div>

      <div class="glass-card p-6 rounded-xl shadow-lg border border-slate-300 max-w-4xl">
        <form method="POST" action="/admin/tuning_web">
           <input type="hidden" name="project_id" value={activeProject?.project_id || ''} />
           
           <div class="mb-8">
             <label class="block text-sm font-bold text-hplus-blue mb-2 uppercase">Temperatura (Randomness / Empatía)</label>
             <div class="flex items-center gap-4">
               <input type="range" name="active_temperature" min="0.0" max="1.0" step="0.1" value={temp} class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-val-orange" oninput="document.getElementById('t_val').innerText = this.value" />
               <span id="t_val" class="font-mono bg-hplus-blue text-white px-3 py-1 rounded font-bold shadow">{temp}</span>
             </div>
             <div class="flex justify-between text-xs text-slate-500 mt-2">
                <span>Robótico/Científico (0.0)</span>
                <span>Equilibrado (0.7)</span>
                <span>Altamente Creativo (1.0)</span>
             </div>
           </div>

           <div class="mb-8">
             <label class="block text-sm font-bold text-hplus-blue mb-2 uppercase">Límite Extensión de Respuesta (maxOutputTokens)</label>
             <input type="number" name="max_output_tokens" value={tokens} class="w-32 p-2 border border-slate-300 rounded font-mono text-sm focus:ring-val-orange focus:border-val-orange" />
             <span class="text-xs text-slate-500 ml-4">Rango recomendado: 200 - 800 tokens. (VAL tiene instrucción base de brevedad).</span>
           </div>

           <div class="mb-8">
             <label class="block text-sm font-bold text-hplus-blue mb-2 uppercase">System Prompt Base (Alma del Agente)</label>
             <textarea name="system_base_prompt" rows="18" class="w-full p-4 bg-slate-50 border border-slate-200 shadow-inner rounded font-mono text-xs focus:ring-1 focus:ring-val-orange" spellcheck="false" required>{prompt}</textarea>
             <div class="bg-blue-50 text-blue-800 p-3 mt-2 rounded text-xs border border-blue-100 flex gap-2 items-start">
                <span>💡</span>
                <p><strong>Variables de Entorno:</strong> Asegúrate de incluir <code>{`{SEED_PROMPT}`}</code> en alguna parte del texto. El sistema inyectará la pregunta semilla configurada en el lobby allí.</p>
             </div>
           </div>

           <button type="submit" class="w-full bg-val-gradient text-white text-lg font-bold py-4 rounded-lg hover:opacity-90 transition shadow-lg flex items-center justify-center gap-2">
             <span>⚡ Guardar y Aplicar al Enjambre Inmediatamente</span>
           </button>
        </form>
      </div>
    </Layout>
  );
};
