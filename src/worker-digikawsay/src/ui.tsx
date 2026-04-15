import { jsx } from 'hono/jsx';
import type { FC } from 'hono/jsx';

// ==========================================
// Base Corporate Layout (H+ / DigiKawsay)
// ==========================================
export const Layout: FC<{ children: any }> = ({ children }) => (
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
      <aside class="w-64 bg-hplus-blue text-white flex-col p-6 shadow-xl z-10 hidden md:flex">
         <div class="text-2xl font-bold bg-val-gradient bg-clip-text text-transparent mb-12">
            H+ DigiKawsay
         </div>
         <nav class="flex-1 space-y-4">
            <a href="/admin/lobby" class="block py-2 px-4 rounded hover:bg-white/10 transition">🚀 Lanzar Piloto</a>
            <a href="/admin/dashboard" class="block py-2 px-4 rounded hover:bg-white/10 transition">📊 Tablero de Control</a>
            <a href="/admin/woz" class="block py-2 px-4 rounded hover:bg-white/10 transition text-val-orange font-bold">👁️ Consola VAL</a>
         </nav>
      </aside>
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
                        {p.status === 'invited' ? `https://t.me/<BOT>?start=${p.invite_token}` : 'Aceptado'}
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
// View 3: Wizard of Oz (VAL Console)
// ==========================================
export const WozView: FC<{ projects: any[], participants: any[] }> = ({ projects, participants }) => {
  const activeProject = projects.length > 0 ? projects[0] : null;
  const activeParticipants = participants.filter(p => p.status === 'active' || p.status === 'invited'); // Todo: filter by real activity
  
  return (
    <Layout>
      <div class="flex items-center space-x-3 mb-8">
        <h1 class="text-4xl text-hplus-blue font-bold">Consola VAL</h1>
        <span class="bg-val-gradient text-white px-3 py-1 rounded-full text-sm font-bold shadow-md animate-pulse">
           Facilitadora DIAP Ejecutando
        </span>
      </div>

      <div class="glass-card rounded-xl shadow-2xl flex flex-col md:flex-row min-h-[600px] overflow-hidden border border-slate-300">
         {/* Lista Lateral */}
         <div class="w-full md:w-1/3 bg-slate-50 border-r border-slate-200">
            <div class="p-4 bg-hplus-blue text-white font-bold text-sm tracking-wider">
               ACTORES ACTIVOS
            </div>
            <div class="overflow-y-auto p-2">
               {activeParticipants.map(p => (
                 <div class="p-3 mb-2 rounded bg-white shadow-sm border-l-4 border-val-orange cursor-pointer hover:bg-slate-100 transition">
                    <div class="font-bold text-hplus-blue">{p.display_name}</div>
                    <div class="text-xs text-slate-500 font-mono mt-1">ID: {p.participant_id.substring(0,8)}...</div>
                 </div>
               ))}
               {activeParticipants.length === 0 && <div class="p-4 text-slate-400 text-sm">Nadie ha entrado al canal de Telegram aún.</div>}
            </div>
         </div>

         {/* Inyección Consola Central */}
         <div class="w-full md:w-2/3 flex flex-col bg-slate-900 text-green-400 font-mono p-6 relative">
            <div class="absolute top-0 right-0 p-4 opacity-10 pointer-events-none text-9xl">👁️</div>
            <div class="flex-1 overflow-y-auto text-sm space-y-4 shadow-inner p-4 bg-black/30 rounded mb-4">
               <div>[SYS] Conectado a Infraestructura Edge D1...</div>
               <div>[SYS] Nodo VAL inicializado y a la espera de inyecciones teóricas.</div>
               <div class="text-val-orange mt-8">[INFO] Seleccione un actor a la izquierda y redacte una directiva. Esta instrucción modificará sutilmente la próxima interacción de VAL con el individuo.</div>
            </div>

            <form method="POST" action="/admin/inject_directive_web" class="mt-auto">
               <input type="hidden" name="project_id" value={activeProject?.project_id || ''} />
               <select name="participant_id" class="w-full p-2 mb-2 bg-slate-800 text-white border border-slate-600 rounded">
                  {activeParticipants.map(p => (
                    <option value={p.participant_id}>{p.display_name}</option>
                  ))}
               </select>
               <input type="text" name="content" class="w-full p-3 mb-2 bg-slate-800 text-white border border-slate-600 focus:border-val-orange focus:ring-1 focus:ring-val-orange rounded" placeholder="Ej: Indaga por qué asume que sus superiores no lo escuchan..." required autocomplete="off" />
               <div class="flex space-x-2">
                 <select name="urgency" class="p-3 bg-slate-800 text-white border border-slate-600 rounded w-1/3">
                    <option value="LOW">Prioridad Baja</option>
                    <option value="MEDIUM" selected>Prioridad Media</option>
                    <option value="CRITICAL">Prioridad Crítica</option>
                 </select>
                 <button type="submit" class="flex-1 bg-val-orange text-slate-900 font-bold py-3 rounded hover:bg-orange-400 transition shadow-[0_0_15px_rgba(255,157,0,0.4)]">
                   [ENTER] Inyectar al Cerebro
                 </button>
               </div>
            </form>
         </div>
      </div>
    </Layout>
  );
};
