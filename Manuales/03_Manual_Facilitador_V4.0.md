# DigiKawsay: Manual del Facilitador (v4.1 — Panel Admin y WoZ)

El facilitador es el investigador cualitativo que diseña el piloto, monitorea las conversaciones y ejerce la intervención humana a través del sistema **Wizard of Oz (WoZ)**. Este manual cubre el acceso al panel y el uso de cada sección.

---

## 1. Acceso al panel de administración

### 1.1 Primer acceso (setup inicial)

Si es la primera vez que se accede al sistema, ve a:
```
https://TU_WORKER.workers.dev/admin/setup
```
Esta pantalla crea el primer administrador. Solo está disponible cuando no existe ningún usuario en la tabla `administrators`. Una vez creado el primer admin, la ruta queda bloqueada.

### 1.2 Login

```
https://TU_WORKER.workers.dev/admin/login
```
Ingresa tu nombre de usuario y contraseña. El sistema crea una sesión mediante cookie firmada, válida por 7 días. Si la sesión expira o no existe, cualquier ruta `/admin/*` redirige automáticamente al login.

### 1.3 Logout

```
https://TU_WORKER.workers.dev/admin/logout
```
Borra la cookie de sesión y redirige al login.

---

## 2. Panel Lobby (`/admin/lobby`)

La pantalla de inicio tiene dos funciones:

**Verificación del bot de Telegram:** Muestra si el `TELEGRAM_BOT_TOKEN` está configurado. El indicador verde confirma que el secreto existe.

**Registro del Webhook:** Al hacer clic en "Registrar Webhook", el sistema envía la URL del worker a Telegram para que redirija todos los mensajes del bot a `/webhook`. Es el primer paso operativo después del despliegue.

**Creación del primer proyecto:** Formulario para definir nombre y seed prompt. El seed prompt es la semilla conceptual que enmarca qué explora VAL con los participantes.

> **Nota sobre el seed prompt:** Es el único parámetro que moldea el *territorio* de la conversación. VAL no hace una entrevista estructurada, sino que sigue los hilos que el participante abre. El seed prompt garantiza que esos hilos estén dentro del territorio diagnóstico relevante. Ejemplo efectivo: *"Explora cómo el equipo coordina su trabajo real: qué herramientas usa en la práctica, cómo toma decisiones y dónde siente que los procesos fluyen o se atascan."*

---

## 3. Panel Dashboard (`/admin/dashboard`)

Vista general del piloto en curso:

- **Lista de proyectos activos** (barra superior)
- **Tabla de participantes** del proyecto seleccionado con:
  - Estado: `invited` / `active` / `completed`
  - Turnos acumulados
  - Registro emocional actual (del último turno clasificado)
  - Fecha y hora del último mensaje
- **Generación de magic links:** Para cada participante registrado, el dashboard muestra su `invite_token`. El link de invitación es `https://t.me/TU_BOT?start=TOKEN`.
- **Registro de nuevos participantes:** Formulario masivo (un nombre por línea) para añadir participantes al proyecto.

---

## 4. Consola WoZ (`/admin/woz`)

La Consola Wizard of Oz es el corazón del rol del facilitador. Permite observar las conversaciones activas y ejercer intervención humana en tiempo real.

### 4.1 Estructura de la consola

**Columna izquierda — Lista de participantes:**
- Selector de proyecto
- Lista de participantes activos con su estado emocional actual
- Al hacer clic en un participante, la consola carga su conversación

**Columna central — Chat en tiempo real:**
- Burbujas de conversación: azul (participante) / naranja (VAL)
- Metadatos del turno: registro emocional, indicador de praxis, latencia de respuesta
- Insignia 🧙 en los turnos donde VAL aplicó una directiva del facilitador
- **Actualización automática:** El sistema hace polling cada 3 segundos a `/admin/api/live_feed/:project_id`. No es necesario recargar la página.

**Columna derecha — Inyección de directivas:**
- Campo de texto para escribir la directiva
- Selector de urgencia: MEDIUM / HIGH
- Botón para inyectar al participante seleccionado
- Lista de directivas activas con su estado (PENDING / APPLIED)

### 4.2 Cómo inyectar una directiva efectiva

Una directiva es una instrucción secreta que VAL incorpora orgánicamente en su siguiente respuesta. El participante nunca sabe que existe.

**Directivas efectivas:**
- Formuladas como curiosidad o hipótesis, no como órdenes: *"Profundiza en cómo se coordinan cuando el sistema oficial falla"* en lugar de *"Pregúntale sobre las herramientas que usa"*
- Específicas al hilo que emergió en la conversación
- Una sola idea por directiva

**Directivas inefectivas:**
- Guiones textuales (*"Dile exactamente: ¿usas Excel?"*) — VAL los parafrasea, no los lee literalmente
- Correcciones del pasado (*"Debiste preguntar antes sobre..."*) — Las directivas son siempre hacia el próximo turno, nunca retroactivas
- Instrucciones múltiples en una sola directiva — VAL solo puede integrar un hilo nuevo por turno

**Ejemplo de ciclo WoZ:**

*Participante dice:* "Para las aprobaciones urgentes usamos un grupo de WhatsApp, el sistema formal tarda mucho."

*Facilitador detecta:* Shadow IT relevante (workaround de proceso).

*Facilitador inyecta:* `"Explora con empatía qué tan frecuente es este workaround y qué lo hace preferible al canal oficial. Si menciona otros canales informales, sigue ese hilo."`

*VAL responde:* "Entiendo que la urgencia empuja a buscar lo que funciona en el momento. Me pregunto si ese grupo de WhatsApp es algo ocasional o ya se volvió parte del flujo habitual del equipo."

*Resultado:* El facilitador confirma con la insignia 🧙 que la directiva fue APPLIED.

### 4.3 Decálogo del facilitador WoZ

✅ Inyecta cuando notes un hilo valioso que VAL no siguió  
✅ Usa urgencia HIGH cuando el tema es crítico para el diagnóstico  
✅ Espera a que la directiva sea APPLIED antes de inyectar otra al mismo participante  
✅ Observa el registro emocional — si el participante está DISTRESSED, no inyectes temas analíticos  
✅ Confía en VAL para la forma — tú defines el qué, VAL decide el cómo  

❌ No escribas guiones textuales  
❌ No inyectes más de una directiva activa por participante  
❌ No corrijas el historial pasado de la conversación  
❌ No inyectes directivas cuando el estado es DISTRESSED (VAL está en modo Safe Harbor)  

---

## 5. Panel de Analítica (`/admin/analytics`)

Acceso en tiempo real a los patrones emergentes del piloto.

### KPIs principales
- **Total de turnos:** densidad del corpus recopilado
- **Participantes activos:** quiénes han tenido al menos un turno
- **Saberes detectados:** número de categorías de Shadow IT identificadas
- **Directivas pendientes:** cuántas intervenciones WoZ aún no fueron aplicadas

### Distribución emocional
Barras de porcentaje por categoría:
- 🟢 **OPEN** — disposición y apertura
- 🟡 **GUARDED** — cautela o ambigüedad
- 🟠 **RESISTANT** — rechazo o descrédito del proceso
- 🔴 **DISTRESSED** — angustia o agotamiento severo
- ⚪ **NEUTRAL** — descriptivo sin carga emocional

Si RESISTANT o DISTRESSED superan el 30%, revisar el diseño del seed prompt o el estado del equipo.

### Distribución de praxis (Fals Borda)
- **PROPUESTA_ACCION:** el equipo formula soluciones → señal de agencia
- **CATARSIS:** predominan quejas sin propuesta → posible bloqueo o agotamiento
- **REFLEXION_PASIVA:** narrativa descriptiva → fase de exploración

### Shadow IT y saberes tácitos
Tags de herramientas no oficiales detectadas con frecuencia. Alta frecuencia de "excel" o "whatsapp" indica conocimiento tácito no capturado en sistemas oficiales — área prioritaria para el informe.

### Estructuras opresivas
Patrones de bloqueo sistémico detectados: jerarquías que frenan, burocracia excesiva, silos, falta de recursos. Base empírica para recomendaciones de cambio organizacional.

### Tabla de participantes
Profundidad de conversación (turnos) y emoción actual por persona. Participantes con alto turn_count y estado OPEN son la fuente más rica de información.

---

## 6. Panel de Tuning (`/admin/tuning`)

Permite ajustar el comportamiento de VAL por proyecto sin necesidad de redesplegar. Ver Manual 07 para detalle completo.

Parámetros configurables:
- **Temperatura:** creatividad vs. consistencia de las respuestas (0.0 – 1.0)
- **Max output tokens:** extensión máxima de las respuestas (recomendado: 200–400)
- **System prompt base:** texto completo del prompt que define la personalidad de VAL (variable `{SEED_PROMPT}` disponible)
