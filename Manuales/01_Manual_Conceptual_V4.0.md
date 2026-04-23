# DigiKawsay: Manual Conceptual y Entregables (v4.1)

## 1. ¿Qué es DigiKawsay?

DigiKawsay es una plataforma de **inteligencia artificial sentipensante** para diagnósticos de cultura organizacional. A diferencia de las encuestas tradicionales, utiliza conversaciones asíncronas uno-a-uno vía Telegram con **VAL** —un agente de IA— para extraer el conocimiento tácito real que los empleados rara vez expresan en formularios: los workarounds cotidianos, las jerarquías informales, el conocimiento no documentado y los bloqueos sistémicos invisibles.

El objetivo no es medir satisfacción con escala de 1 a 5. Es producir un mapa vivo de cómo funciona realmente la organización desde adentro.

---

## 2. Paradigma Sentipensante (IAP de Orlando Fals Borda)

El núcleo conceptual y comunicacional de DigiKawsay se funda en la metodología de **Orlando Fals Borda** y la **Investigación Acción Participativa (IAP)**. El principio central: el conocimiento legítimo emerge cuando se integran el *sentir* y el *pensar* de forma simultánea, no secuencial.

VAL está diseñado para encarnar este principio en cada turno de conversación:

- **Validación emocional primaria:** Antes de cualquier pregunta, VAL reconoce la carga afectiva del participante. No para manipular, sino porque el conocimiento solo fluye cuando hay confianza.
- **Paridad relacional horizontal:** VAL habla como par, no como auditor. Puede decir "eso me parece complejo". Nunca usa jerga de investigación ("categoría", "constructo", "metodología").
- **Brevedad y presencia:** Máximo 3 oraciones por respuesta. Una sola pregunta por turno. El silencio es válido.
- **Safe Harbor:** Si VAL detecta angustia emocional severa, suspende la investigación y acompaña con empatía. No retoma temas analíticos hasta que la persona se estabilice.
- **Curiosidad genuina:** Sigue los hilos que emergen en la conversación, no una checklist de temas predefinidos.

VAL nunca revela que existe un sistema detrás suyo. Puede confirmar que es IA si se le pregunta directamente, pero no describe la arquitectura.

---

## 3. Cómo funciona VAL: el ciclo de un turno

Cada vez que un participante envía un mensaje, el sistema ejecuta en paralelo:

1. **Respuesta conversacional VAL:** Gemini 2.5-flash recibe el historial de los últimos 12 turnos + el seed prompt del proyecto + una directiva WoZ (si el facilitador inyectó una). Responde en carácter sentipensante.

2. **Clasificación semántica:** Un segundo llamado paralelo a Gemini (temperatura 0.1) clasifica el fragmento del participante en cuatro dimensiones:
   - **Registro emocional:** OPEN · GUARDED · RESISTANT · DISTRESSED · NEUTRAL
   - **Indicador de praxis:** PROPUESTA_ACCION · CATARSIS · REFLEXION_PASIVA
   - **Saberes tácitos detectados:** herramientas no oficiales (Excel propio, WhatsApp grupos, papel y lápiz), workarounds, conocimiento no documentado
   - **Estructuras opresivas:** jerarquía bloqueante, burocracia excesiva, silos, falta de recursos, procesos rotos

3. **Persistencia:** El turno completo (respuesta + clasificación) se guarda en D1 para análisis posterior.

Este proceso ocurre sin que el participante lo perciba. La clasificación es interna.

---

## 4. Sistema de Directivas (Wizard of Oz)

El facilitador humano puede inyectar **directivas** desde el panel admin. Son instrucciones secretas que VAL integra orgánicamente en su siguiente respuesta, sin mencionarlas ni revelar que existen.

Ejemplo: si el facilitador nota que un participante mencionó usar WhatsApp para coordinarse y quiere profundizar, inyecta: *"Indaga respetuosamente qué tan frecuente es el uso de canales informales y qué los lleva a preferirlos sobre los sistemas oficiales."*

VAL lo convierte en una pregunta natural dentro de la conversación, como si surgiera de su propia curiosidad.

Las directivas tienen nivel de urgencia (MEDIO / ALTO) y ciclo de vida: PENDING → APPLIED. Una vez aplicada, se cierra.

---

## 5. Analítica del equipo: lo que el sistema entrega

Al finalizar un piloto (o en cualquier momento durante él), el facilitador accede a una analítica agregada del proyecto:

### Distribución emocional del equipo
Porcentaje de turnos clasificados como OPEN, GUARDED, RESISTANT o DISTRESSED. Permite identificar si el equipo está en postura receptiva o defensiva frente al proceso.

### Distribución de praxis Falsbordiana
- **PROPUESTA_ACCION:** el equipo formula soluciones concretas → señal de agencia colectiva
- **CATARSIS:** predominan quejas sin propuesta → posible agotamiento o bloqueo percibido
- **REFLEXION_PASIVA:** narración descriptiva sin dirección → fase de exploración

### Shadow IT y saberes tácitos
Lista de herramientas no oficiales detectadas (Excel propio, WhatsApp, papel y lápiz, Google Sheets personal, etc.) con frecuencia de mención. Esto visibiliza el conocimiento tácito que el organigrama no captura.

### Estructuras opresivas
Patrones de bloqueo detectados: jerarquías que frenan, burocracia excesiva, silos entre áreas, falta de recursos. Base empírica para recomendaciones sistémicas.

### Profundidad por participante
Número de turnos por persona y su registro emocional actual. Permite identificar participantes con alta densidad informacional vs. quienes necesitan más acompañamiento.

---

## 6. Entregables de un piloto

Un piloto exitoso de DigiKawsay produce:

1. **Panel de analítica en tiempo real** — disponible durante y después del piloto en `/admin/analytics`
2. **Historial de conversaciones anonimizado** — exportable desde `/admin/conversation/:id` por participante
3. **Registro de directivas WoZ aplicadas** — efectividad de cada intervención del facilitador
4. **Corpus clasificado** — cada turno etiquetado con emoción, praxis, saberes y estructuras

---

## 7. Funcionalidades en hoja de ruta (no en MVP actual)

| Funcionalidad | Descripción |
|---|---|
| **El Espejo** | Resonancia semántica anónima entre participantes (embeddings vectoriales) |
| **PII-Stripper** | Filtro automático de datos personales antes del LLM |
| **AG-05 (Metodólogo)** | Análisis topológico (TDA) y de redes organizacionales (SNA/ONA) |
| **Plan de Movilización** | Síntesis final: OKRs + redes de compromiso en JSON accionable |
| **Arquitectura distribuida** | Pub/Sub + Weaviate + PostgreSQL para escala corporativa |
| **Dashboard Obsidian** | Métricas de latencia cognitiva y abandono en tiempo real |
| **DIALOGUE_SATURATION** | Señal automática cuando 3 turnos consecutivos sin información nueva |

Estas capacidades están especificadas en los documentos de la carpeta `Requerimientos/` y constituyen la arquitectura objetivo de versiones futuras.
