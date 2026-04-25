---
name: phase0-task3-woz-realtime
description: Mejoras al panel WoZ — polling en tiempo real, alerta SAFE_HARBOR, y colores de abandono
tags: [phase0, frontend, woz, panel, realtime]
---

# Tarea: WoZ en Tiempo Real con Alertas Críticas

## Contexto
El panel WoZ actual (`sec-wizard`) carga la conversación una vez y no se actualiza.
El facilitador pierde mensajes nuevos a menos que recargue manualmente.
Además, el sistema ya detecta SAFE_HARBOR y abandono emocional pero el panel no los
muestra visualmente de forma destacada, lo que puede costar la calidad del piloto.

## Archivos a modificar
- `src/agente00-service/static/panel.html` — MODIFICAR (polling + alertas visuales)
- `src/agente00-service/main.py` — VERIFICAR endpoint /conversation/{participant_id} retorna emotional_register y turn_count

## Implementación

### Paso 1: Auto-refresh de la conversación activa

Localizar la función `loadConversation()` en `panel.html` y añadir al final:

```javascript
// Auto-refresh de la conversación del participante seleccionado
function startConversationPolling(participantId) {
    clearInterval(window._convPollInterval);
    if (!participantId) return;
    window._convPollInterval = setInterval(async () => {
        const sel = document.getElementById('woz-participant-select');
        if (!sel || sel.value !== participantId) {
            clearInterval(window._convPollInterval);
            return;
        }
        await loadConversation(); // recarga burbujas sin limpiar el input de directiva
    }, 10000); // cada 10 segundos
}
```

Al final de `loadConversation()`, después de poblar las burbujas, añadir:
```javascript
// Al cargar, iniciar polling para el participante actual
const sel = document.getElementById('woz-participant-select');
if (sel && sel.value) startConversationPolling(sel.value);
```

En `showSection()`, donde se limpia la sección wizard al salir, añadir:
```javascript
clearInterval(window._convPollInterval);
```

### Paso 2: Indicador visual de SAFE_HARBOR

En la función `loadConversation()`, después de poblar las burbujas, añadir:

```javascript
// Detectar SAFE_HARBOR en los turnos recibidos
async function checkSafeHarbor(participantId) {
    try {
        const data = await api(`/conversation/${participantId}`);
        const turns = data.turns || [];
        const lastTurn = turns[turns.length - 1] || {};
        const emotion = (lastTurn.emotional_register || '').toUpperCase();
        const isSafeHarbor = emotion === 'DISTRESSED' || data.safe_harbor_active;

        const alertBanner = document.getElementById('safe-harbor-alert');
        if (alertBanner) {
            alertBanner.style.display = isSafeHarbor ? 'block' : 'none';
        }
    } catch (e) { /* silencioso */ }
}
```

En el HTML de `sec-wizard`, justo antes de los controles de directiva, añadir:

```html
<!-- Banner de alerta SAFE_HARBOR — oculto por defecto -->
<div id="safe-harbor-alert" style="
    display:none;
    background: rgba(239,71,111,0.15);
    border: 1px solid #ef476f;
    border-radius: var(--radius);
    padding: 12px 16px;
    margin-bottom: 16px;
    color: #ef476f;
    font-weight: 600;
">
    ⚠ SAFE HARBOR ACTIVO — Este participante muestra señales de distress.
    Suspende la investigación. Acompaña con empatía antes de continuar.
</div>
```

Llamar `checkSafeHarbor(participantId)` dentro del polling y al cargar.

### Paso 3: Color de abandono por tiempo de inactividad

En la función `loadWozParticipants()`, modificar el map de filas para añadir color según inactividad:

```javascript
// Calcular inactividad a partir del último turno
function inactivityBadge(lastActivity) {
    if (!lastActivity) return '';
    const diffMin = (Date.now() - new Date(lastActivity).getTime()) / 60000;
    if (diffMin > 60) return '<span class="badge" style="background:rgba(239,68,68,0.15);color:#ef4444">⚠ +60 min sin respuesta</span>';
    if (diffMin > 30) return '<span class="badge" style="background:rgba(255,209,102,0.15);color:#ffd166">⏳ +30 min</span>';
    return '<span class="badge badge-active">Activo</span>';
}

// En el map de filas de la tabla:
`<td>${p.display_name} ${inactivityBadge(p.last_activity)}</td>`
```

Para que el backend retorne `last_activity`, verificar que el endpoint
`GET /admin/participants/{project_id}` incluya `last_activity` en el SELECT:

```sql
-- En el query de listado de participantes (agente00-service/main.py):
SELECT p.*, 
       MAX(dt.timestamp) as last_activity,
       COUNT(dt.turn_id) as turn_count
FROM participants p
LEFT JOIN dialogue_turns dt ON p.participant_id = dt.participant_id
WHERE p.project_id = %s
GROUP BY p.participant_id
ORDER BY last_activity DESC NULLS LAST
```

Si el endpoint ya existe con otro SELECT, modificarlo para incluir estos campos calculados.
El endpoint devuelve una lista de participantes con el campo `last_activity` adicional.

### Paso 4: Contador de turnos en tiempo real

En el HTML de `sec-wizard`, dentro del bloque de información del participante activo, añadir:

```html
<div style="display:flex; gap:16px; margin-bottom:12px;">
    <div class="kpi" style="flex:1;">
        <div class="value" id="woz-turn-count">-</div>
        <div class="label">Turnos</div>
    </div>
    <div class="kpi" style="flex:1;">
        <div class="value" id="woz-emotion">-</div>
        <div class="label">Emoción actual</div>
    </div>
    <div class="kpi" style="flex:1;">
        <div class="value" id="woz-pending-directives">-</div>
        <div class="label">Directivas pendientes</div>
    </div>
</div>
```

En `loadConversation()`, después de obtener los datos:

```javascript
// Actualizar KPIs del participante activo
const turns = data.turns || [];
document.getElementById('woz-turn-count').textContent = turns.length;
const lastTurn = turns[turns.length - 1];
if (lastTurn) {
    document.getElementById('woz-emotion').textContent =
        lastTurn.emotional_register || '-';
}

// Colorear emoción
const emotionEl = document.getElementById('woz-emotion');
const em = (emotionEl.textContent || '').toUpperCase();
if (['DISTRESSED', 'RESISTANT'].includes(em)) {
    emotionEl.style.color = '#ef476f';
} else if (['GUARDED'].includes(em)) {
    emotionEl.style.color = '#ffd166';
} else if (['OPEN', 'HOPE', 'CURIOSITY'].includes(em)) {
    emotionEl.style.color = '#06d6a0';
} else {
    emotionEl.style.color = 'var(--text)';
}

// Cargar directivas pendientes
const dirData = await api(`/admin/directives/${projectId}`);
const pending = (dirData.directives || []).filter(d => d.status === 'PENDING').length;
document.getElementById('woz-pending-directives').textContent = pending;
```

## Criterios de Éxito
1. La conversación del participante seleccionado se actualiza automáticamente sin recargar la página
2. Si el último turno tiene `emotional_register = 'DISTRESSED'`, aparece el banner rojo SAFE_HARBOR
3. Los participantes con más de 30 min de inactividad muestran badge amarillo; +60 min, badge rojo
4. El contador de turnos y emoción actual se muestran y actualizan en tiempo real
5. Al cambiar de sección, el polling se detiene (no hay llamadas en background)

## Cómo verificar
```bash
# 1. Abrir el panel
open http://localhost:8002/admin

# 2. Ir a sección Wizard
# 3. Seleccionar un participante con conversación activa
# 4. Verificar que las burbujas se actualizan cada 10 segundos sin recargar
# 5. Insertar en DB un turno con emotional_register='DISTRESSED':
psql $DATABASE_URL -c "
  UPDATE dialogue_states 
  SET emotional_register='DISTRESSED' 
  WHERE participant_id='<participant_id>'
"
# 6. Verificar que el banner rojo aparece en el siguiente poll (< 10s)
```
