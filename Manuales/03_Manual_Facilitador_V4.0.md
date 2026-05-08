# DigiKawsay: Manual del Facilitador (v4.2 — Panel Admin y WoZ)

El facilitador es el investigador cualitativo que diseña el piloto, monitorea las conversaciones y ejerce la intervención humana a través del sistema **Wizard of Oz (WoZ)**. Este manual cubre el acceso al panel y el uso de cada sección.

---

## 1. Acceso al panel de administración

### 1.1 Primer acceso (setup inicial)

Si es la primera vez que se accede al sistema, ve a:
```
https://TU_WORKER.workers.dev/admin/setup
```
Esta pantalla crea el primer administrador con rol **SUPERADMIN**. Solo está disponible cuando no existe ningún usuario en la tabla `administrators`. Una vez creado el primer admin, la ruta queda bloqueada.

### 1.2 Login

```
https://TU_WORKER.workers.dev/admin/login
```
Ingresa tu nombre de usuario y contraseña. El sistema crea una sesión mediante cookie firmada válida por 7 días. El sistema aplica **protección anti-fuerza-bruta**: después de 5 intentos fallidos en 15 minutos, el usuario queda bloqueado temporalmente.

### 1.3 Roles de administrador

| Rol | Qué puede ver/hacer |
|---|---|
| **SUPERADMIN** | Todos los proyectos, todos los tenants, billing, seguridad, configuración global |
| **TENANT_ADMIN** | Todos los proyectos del tenant al que pertenece |
| **PILOT_ADMIN** | Solo los proyectos asignados explícitamente en la tabla `admin_projects` |

### 1.4 Logout

```
https://TU_WORKER.workers.dev/admin/logout
```
Borra la cookie de sesión y redirige al login.

---

## 2. Panel Lobby (`/admin/lobby`)

La pantalla de inicio tiene tres funciones:

**Verificación del bot de Telegram:** Indicador verde/rojo confirmando si el `TELEGRAM_BOT_TOKEN` está configurado.

**Registro del Webhook:** Al hacer clic en "Registrar Webhook", el sistema envía la URL del worker a Telegram. Es el primer paso operativo después del despliegue. Si `WEBHOOK_SECRET` está configurado, el secret queda registrado también para validación de todos los mensajes entrantes.

**Creación del primer proyecto:** Formulario para definir nombre y seed prompt.

**Diseño de piloto asistido por IA:** En el Lobby encontrarás el campo de contexto del equipo. Al llenarlo y hacer clic en "Diseñar Piloto", el sistema llama a Gemini para generar:
- Un **mensaje de contextualización** listo para enviar al equipo por WhatsApp/email antes de iniciar
- Un **seed prompt** optimizado, anclado en la realidad específica del equipo

> **Ejemplo de contexto efectivo para el asistente IA:**
> *"Equipo de 15 ingenieros de software. Están pasando por una fusión corporativa. La cultura del equipo original es muy horizontal, la empresa adquirente es muy jerárquica. Queremos entender cómo están viviendo la transición y qué conocimiento tácito puede perderse."*

---

## 3. Panel Dashboard (`/admin/dashboard`)

Vista general del piloto en curso:

- **Selector de proyectos** (barra superior) — filtra por los proyectos que tu rol puede ver
- **Tabla de participantes** del proyecto seleccionado con:
  - Estado: `invited` / `active` / `completed`
  - Turnos acumulados
  - Registro emocional actual
  - Fecha y hora del último mensaje
- **Magic links:** El `invite_token` de cada participante. El link de invitación es `https://t.me/TU_BOT?start=TOKEN`.
- **Registro de nuevos participantes:** Formulario masivo (un nombre por línea).

---

## 4. Consola WoZ (`/admin/woz`)

La Consola Wizard of Oz es el corazón del rol del facilitador. Permite observar las conversaciones activas y ejercer intervención humana en tiempo real.

### 4.1 Estructura de la consola

**Columna izquierda — Lista de participantes:**
- Selector de proyecto
- Lista de participantes con estado emocional actual, fase IAP y progreso de fase
- Al hacer clic en un participante, la consola carga su conversación

**Columna central — Chat en tiempo real:**
- Burbujas de conversación: azul (participante) / naranja (VAL)
- Metadatos del turno:
  - Registro emocional (OPEN / GUARDED / RESISTANT / DISTRESSED / NEUTRAL)
  - Indicador de praxis (PROPUESTA_ACCION / CATARSIS / REFLEXION_PASIVA)
  - **Depth score (0-100):** profundidad cualitativa del mensaje
  - Latencia de respuesta
- Insignia 🧙 en turnos donde VAL aplicó una directiva del facilitador
- Insignia 🤖 en turnos donde VAL aplicó una directiva automática del AG-05 Co-piloto
- **Actualización automática:** polling cada 3 segundos — no es necesario recargar la página

**Columna derecha — Panel de acciones:**
- Campo de texto para escribir la directiva
- Selector de urgencia: MEDIUM / HIGH
- **Acción "Inject":** inyecta la directiva en cola — VAL la aplicará en el siguiente turno cuando el participante escriba
- **Acción "Push":** VAL envía proactivamente un mensaje al participante ahora, sin esperar a que escriba. Útil para reenganche de participantes inactivos
- Lista de directivas activas con su estado (PENDING / APPLIED / FAILED)
- Directivas automáticas del AG-05 (badge 🤖) visibles y distinguibles de las humanas

### 4.2 Indicadores de fase en la consola

Cada participante en la lista izquierda muestra:
- **Fase actual:** INVESTIGACION / ACCION / PARTICIPACION / CLOSED
- **Progreso (%):** avance estimado dentro de la fase actual, basado en el `phase_progress` calculado por el clasificador

Cuando un participante alcanza el 100% de progreso en una fase, el sistema avanza automáticamente a la siguiente y VAL anuncia el hito en su próximo turno.

### 4.3 Cómo inyectar una directiva efectiva

Una directiva es una instrucción secreta que VAL incorpora orgánicamente en su siguiente respuesta. El participante nunca sabe que existe.

**Directivas efectivas:**
- Formuladas como curiosidad o hipótesis: *"Profundiza en cómo se coordinan cuando el sistema oficial falla"*
- Específicas al hilo que emergió en la conversación
- Una sola idea por directiva

**Directivas inefectivas:**
- Guiones textuales (*"Dile exactamente: ¿usas Excel?"*) — VAL los parafrasea, no los lee literalmente
- Correcciones del pasado (*"Debiste preguntar antes sobre..."*) — siempre hacia el próximo turno
- Instrucciones múltiples en una sola directiva

**Ejemplo de ciclo WoZ:**

*Participante dice:* "Para las aprobaciones urgentes usamos un grupo de WhatsApp, el sistema formal tarda mucho."

*Facilitador detecta:* Shadow IT relevante (workaround de proceso). Depth score: 62.

*Facilitador inyecta:* `"Explora con empatía qué tan frecuente es este workaround y qué lo hace preferible al canal oficial. Si menciona otros canales informales, sigue ese hilo."`

*VAL responde:* "Entiendo que la urgencia empuja a buscar lo que funciona en el momento. Me pregunto si ese grupo de WhatsApp es algo ocasional o ya se volvió parte del flujo habitual del equipo."

*Resultado:* Insignia 🧙 confirma que la directiva fue APPLIED.

### 4.4 Push proactivo: cuándo y cómo usarlo

El **Push proactivo** envía un mensaje de VAL al participante ahora, sin que el participante haya escrito. Es diferente de una directiva normal en que no espera un mensaje del participante para activarse.

**Cuándo usarlo:**
- Un participante lleva 3+ días sin responder y el piloto está en etapa crítica
- Quieres iniciar la conversación con un participante que aún no ha hecho su primer turno después de días
- El piloto está por cerrar y necesitas que participantes específicos completen al menos un turno más

**Cómo usarlo:**
1. Selecciona el participante en la consola WoZ
2. Escribe la directiva (ej: *"Saluda al participante con calidez, agradece su participación hasta ahora y pregunta por algo concreto de la semana pasada relacionado con el seed prompt"*)
3. Selecciona acción **"Push"** (no "Inject")
4. El sistema ejecuta `runProactiveAgentCycle()` en background y envía el mensaje vía Telegram

> **Nota:** El Push genera automáticamente un turno sintético en el historial marcado como `[Mensaje Proactivo del Investigador]`. Este turno no afecta el depth score ni las métricas de respuesta del participante.

### 4.5 Decálogo del facilitador WoZ

✅ Inyecta cuando notes un hilo valioso que VAL no siguió  
✅ Usa urgencia HIGH cuando el tema es crítico para el diagnóstico  
✅ Espera a que la directiva sea APPLIED antes de inyectar otra al mismo participante  
✅ Observa el registro emocional — si el participante está DISTRESSED, no inyectes temas analíticos  
✅ Confía en VAL para la forma — tú defines el qué, VAL decide el cómo  
✅ Revisa las directivas automáticas del AG-05 — a menudo anticipan los huecos que el ojo humano también ve  
✅ Usa Push proactivo para participantes con baja actividad antes de que el piloto cierre  

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

### Resumen ejecutivo automático
Texto generado automáticamente que resume el estado del piloto: cuántos participantes activos, cuántos turnos, registro emocional dominante, patrón de praxis predominante, Shadow IT detectado y número de alertas activas.

### Distribución emocional
Barras de porcentaje por categoría:
- 🟢 **OPEN** — disposición y apertura
- 🟡 **GUARDED** — cautela o ambigüedad
- 🟠 **RESISTANT** — rechazo o descrédito del proceso
- 🔴 **DISTRESSED** — angustia o agotamiento severo
- ⚪ **NEUTRAL** — descriptivo sin carga emocional

### Alertas automáticas

| Alerta | Condición | Significado |
|---|---|---|
| 🔴 Roja | RESISTANT + DISTRESSED > 30% | El equipo muestra señales de resistencia o angustia. Revisar el diseño del piloto antes de continuar |
| 🟠 Naranja | CATARSIS > 50% y PROPUESTA_ACCION < 20% | El equipo necesita desahogarse antes de co-diseñar. No apresures la fase de acción |
| 🔵 Azul | ≥ 3 tipos de Shadow IT detectados | Hay workarounds significativos. Insumo directo para rediseño de procesos |

### Distribución de praxis (Fals Borda)
- **PROPUESTA_ACCION:** el equipo formula soluciones → señal de agencia
- **CATARSIS:** predominan quejas sin propuesta → posible bloqueo
- **REFLEXION_PASIVA:** narrativa descriptiva → fase de exploración

### Shadow IT y saberes tácitos
Tags de herramientas no oficiales detectadas con frecuencia.

### Estructuras opresivas
Patrones de bloqueo sistémico detectados: jerarquías que frenan, burocracia excesiva, silos, falta de recursos.

### Tabla de participantes
Profundidad de conversación (turnos) y emoción actual por persona.

---

## 6. Generación del Informe de Síntesis

Al hacer clic en el botón **"Descargar Informe"** desde el panel de analítica (o accediendo a `/admin/report/:project_id`), el sistema genera un **Informe de Síntesis Fenomenológica** en Markdown. El informe es generado por el AG-05 en modo metodólogo y cubre:

### Sección 1 — Calidad del "Sentipensar"
Análisis de la profundidad de las conversaciones. ¿Hubo rapport genuino? ¿Los participantes pasaron de respuestas transaccionales a reflexiones profundas? Identificación de participantes clave y evolución de su registro emocional.

### Sección 2 — Detección Sistémica
El nudo sistémico central del diagnóstico. Saberes detectados (workarounds, conocimiento tácito), estructuras opresivas (barreras, cuellos de botella, jerarquías), vectores de fuerza o motivaciones en tensión dentro del equipo.

### Sección 3 — Oportunidades de Intervención
Recomendaciones de directivas WoZ para la próxima ronda. Qué temas debería forzar VAL a cuestionar para destrabar el nudo sistémico identificado.

> **Nota técnica:** El informe se genera mediante streaming (la descarga empieza mientras el LLM genera). Para proyectos con muchos turnos, puede tardar 10-30 segundos en completarse. El archivo se descarga como `sintesis_digikawsay_PROYECTO_FECHA.md`.

---

## 7. Exportación CSV del corpus

Desde el panel de analítica o accediendo a `/admin/export/:project_id`, el sistema descarga el corpus completo del proyecto como archivo CSV con columnas:

| Columna | Descripción |
|---|---|
| `turno` | Número de turno del participante |
| `participante` | Nombre de display |
| `mensaje_usuario` | Texto del participante |
| `respuesta_val` | Respuesta de VAL |
| `registro_emocional` | Clasificación emocional del turno |
| `praxis` | Indicador de praxis del turno |
| `topics` | JSON con saberes y estructuras detectados |
| `directive_applied` | ID de directiva aplicada en ese turno (si aplica) |
| `timestamp` | Fecha y hora |

Este CSV es el corpus base para análisis cualitativos adicionales en herramientas externas (ATLAS.ti, NVivo, R, Python).

---

## 8. Panel de Tuning (`/admin/tuning`)

Permite ajustar el comportamiento de VAL por proyecto sin necesidad de redesplegar. Ver Manual 07 para detalle completo.

Parámetros configurables:
- **Temperatura:** creatividad vs. consistencia de las respuestas (0.0 – 1.0, default 0.7)
- **Max output tokens:** extensión máxima de las respuestas (default 300; el sistema aplica un floor de 2048 internamente para Gemini 2.5 Flash)
- **System prompt base:** texto completo del prompt que define la personalidad de VAL (variable `{SEED_PROMPT}` disponible)

---

## 9. Panel de Billing (SUPERADMIN)

Accesible en `/admin/billing` exclusivamente para SUPERADMIN.

Muestra:
- **Consumo por tenant:** tokens usados vs. cuota mensual, estado del cutoff
- **Consumo por proyecto:** tokens usados vs. cuota del proyecto, estado del cutoff
- **Logs de operaciones:** desglose de consumo por tipo de operación (VAL_CYCLE, AG05_COPILOT, PROACTIVE_PUSH)

Para ajustar cuotas, usa los formularios en el panel. El cutoff automático detiene las conversaciones cuando se alcanza el límite de tokens (los participantes reciben un mensaje de mantenimiento temporal).

---

## 10. Dashboard de Seguridad (SUPERADMIN)

Accesible en `/admin/security` exclusivamente para SUPERADMIN.

Muestra eventos de seguridad de las **últimas 24 horas**:
- **Estadísticas:** total de eventos, bloqueados, marcados, limitados por rate
- **Por severidad:** eventos CRITICAL y HIGH
- **Por tipo de amenaza:** PROMPT_INJECTION, JAILBREAK_ATTEMPT, ROLE_SWITCHING, SYSTEM_PROBE, SUSPICIOUS_STRUCTURE
- **Participantes marcados:** quiénes han generado incidentes de seguridad, número de incidentes, severidad máxima

> **Qué hacer si ves eventos HIGH/CRITICAL:** Revisa el participante marcado en el Dashboard. Los mensajes bloqueados reciben un mensaje neutral de VAL sin revelar que fueron bloqueados. Si el patrón persiste, considera revisar si el participante tiene una razón técnica para los intentos (ej. un tester) o si requiere intervención humana.
