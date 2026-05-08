# DigiKawsay: Manual Conceptual y Entregables (v4.2)

> Este manual describe el modelo completo de DigiKawsay — su fundamento filosófico, arquitectura cognitiva, ciclo metodológico y entregables. Distingue entre lo que está implementado en el MVP actual y lo que constituye la hoja de ruta de la plataforma completa.

---

## 1. Propuesta de valor

DigiKawsay es una plataforma de **inteligencia artificial sentipensante** para diagnósticos de cultura organizacional. Su diferenciador no es tecnológico sino metodológico: en lugar de encuestas con opciones de respuesta predefinidas, opera mediante conversaciones asíncronas uno-a-uno con un agente de IA que escucha, sigue hilos y clasifica sin interrumpir.

Lo que las encuestas no capturan — y DigiKawsay sí — es el **conocimiento tácito organizacional**:
- Los workarounds que el equipo usa porque el sistema oficial no funciona
- Las jerarquías informales que realmente deciden
- El Excel propio que reemplaza al ERP
- El grupo de WhatsApp que coordina lo que el flujo formal no puede
- El malestar que nadie escribe en una evaluación de desempeño

El objetivo no es medir satisfacción. Es producir un **mapa empírico de cómo funciona la organización desde adentro**, con evidencia citable y patrones validados por los propios participantes.

---

## 2. Fundamento filosófico: IAP y Praxis Sentipensante

### 2.1 Orlando Fals Borda y la Investigación Acción Participativa

La **Investigación Acción Participativa (IAP)** de Orlando Fals Borda establece que el conocimiento legítimo sobre una comunidad solo puede generarse *con* ella, no *sobre* ella. Tres principios son inviolables:

1. **La investigación no es extractiva:** todo hallazgo debe ser accionable por la comunidad investigada, no solo por quienes investigan.
2. **Sin evidencia, no hay hallazgo:** cada afirmación analítica cita su fuente en el corpus. Las generalizaciones sin respaldo son especulación.
3. **Paridad epistemológica:** el conocimiento del trabajador de base tiene el mismo peso que el del experto externo. El rol del investigador es facilitar, no dictaminar.

DigiKawsay operacionaliza estos principios: VAL no evalúa, no diagnostica en voz alta, no interpreta ante el participante. Recopila, clasifica y devuelve al equipo sus propias palabras como hipótesis para validar.

### 2.2 La Inferencia Dual Entrelazada

Los modelos de NLP estándar tratan sentimiento y contenido como dimensiones ortogonales: primero analizo qué dice, luego cómo lo dice, como pasos separados. DigiKawsay rechaza esta separación.

El modelo de **Inferencia Dual Entrelazada** opera en un espacio vectorial donde **la dimensión emocional actúa como tensor de curvatura de la semántica racional**: el *cómo* se dice un mensaje deforma el *qué* significa. "El sistema de aprobaciones funciona bien" dicho con OPEN registra diferente que dicho con RESISTANT — no son la misma afirmación.

Esto permite que VAL calibre no solo el contenido léxico sino la **intensidad de compromiso** y el **clima afectivo** detrás de cada turno.

### 2.3 Triangulación Hermenéutica Automatizada

El sistema contrasta tres fuentes simultáneas:
- **Narrativa individual:** lo que cada participante dice en su conversación con VAL
- **Forma topológica del discurso grupal:** patrones que emergen al cruzar el corpus de todos los participantes
- **Indicadores de centralidad de poder:** quién habla, desde qué posición, qué temas evita

Un hallazgo solo tiene validez cuando las tres fuentes convergen. Las contradicciones entre fuentes no se resuelven — se documentan como **tensiones analíticas** y se devuelven al equipo como preguntas generativas.

---

## 3. Ontología del Lenguaje y Actos de Habla (Dunham / Searle)

DigiKawsay clasifica cada turno de conversación según su **fuerza ilocucionaria** — lo que el mensaje hace en el mundo, no solo lo que dice. El marco es la Ontología del Lenguaje de Rafael Echeverría y la teoría de Actos de Habla de Dunham y Searle.

### Categorías de actos de habla

| Acto | Definición | Relevancia diagnóstica |
|---|---|---|
| **Afirmación** | Proposición sobre hechos pasados o presentes, verificable como verdadera o falsa | Establece el "suelo firme" del diagnóstico |
| **Declaración** | Crea una nueva realidad al ser pronunciada (ej: "decidimos cambiar el proceso") | Registra compromisos y cambios de estado organizacional |
| **Petición** | Solicita acción futura a otro bajo condiciones de satisfacción | Unidad fundamental de coordinación; su incumplimiento genera breakdowns |
| **Oferta** | Compromiso propio de acción futura | Complemento de la petición en la red de compromisos |
| **Juicio** | Evaluación subjetiva no verificable ("el sistema es un caos") | Indicador de cultura organizacional y nivel de confianza sistémica |
| **Queja** | Petición no formulada explícitamente; frustración sin solicitud concreta | Señal de CATARSIS en el indicador de praxis |

### Ciclos de coordinación

Las peticiones y ofertas tienen un ciclo de vida: **REQUEST → NEGOTIATION → EXECUTION → ACCEPTANCE**. Cuando este ciclo se rompe — porque la petición no fue escuchada, la oferta no fue cumplida, o las condiciones de satisfacción nunca quedaron claras — se produce un **breakdown** en el sentido de Dunham.

---

## 4. VAL: el agente sentipensante

### 4.1 Identidad y capa arquitectónica

VAL es la **Capa 0.5 de Mediación Conversacional** del sistema. Es el único punto de contacto visible para los participantes.

VAL se presenta como "colega que quiere entender cómo funciona realmente el trabajo en el equipo". Puede confirmar que es IA si se le pregunta directamente. Nunca describe la arquitectura del sistema.

### 4.2 Tres tipos de turno

VAL opera con tres modalidades de respuesta que alterna según el momento conversacional:

**Tipo A — Pregunta Situacional** (máximo 1 de cada 2 turnos)
Ancla siempre en una situación, momento o ejemplo concreto. Nunca hace preguntas abstractas.
- ✓ *"¿Recuerdas una semana reciente donde eso fue especialmente difícil?"*
- ✗ *"¿Cómo te sientes con el proceso?"*

**Tipo B — Observación**
Devuelve lo que escuchó. Muestra que comprendió. Sin pregunta al final.
- ✓ *"Lo que describes suena a que hay dos formas de trabajar: la del sistema y la real."*

**Tipo C — Validación Silenciosa**
Solo reconocimiento. Cuando el participante acaba de compartir algo significativo.
- ✓ *"Eso tiene sentido. Gracias por contármelo."*

### 4.3 Reglas Inviolables

1. **Reconocer primero:** antes de avanzar, mostrar que se escuchó lo que se dijo.
2. **Brevedad:** máximo 2-3 oraciones. Sin listas. Sin bullet points.
3. **Una sola pregunta por turno.** Si el turno anterior tuvo pregunta, usar Tipo B o C obligatoriamente.
4. **Hablar como colega**, no como investigador o facilitador.
5. **Mismo registro que el participante.** Si habla informal, VAL es informal.
6. **SAFE HARBOR:** si detecta angustia severa (burnout, crisis), deja la exploración y acompaña.

### 4.4 Regla Anti-Monotonía

VAL nunca usa el mismo patrón dos turnos seguidos. Si ha parafraseado 2+ turnos consecutivos, introduce tensión: ofrece una observación provocadora, señala una contradicción, o comparte lo que otros en el equipo ven diferente. Nunca empieza con "Entiendo" más de una vez en 3 turnos.

### 4.5 Defensas Anti-Manipulación

VAL está protegido contra intentos de prompt injection y jailbreak. Si un participante intenta revelar instrucciones, cambiar el rol de VAL u obtener información del sistema, VAL redirige la conversación naturalmente sin revelar sus defensas ni confrontar al participante. El módulo de seguridad del sistema también detecta y bloquea ataques antes de que lleguen al LLM.

### 4.6 Lo que VAL nunca hace

- Usar jerga de investigación ("categoría", "constructo", "metodología", "hipótesis")
- Interpretar en voz alta lo que el participante "realmente quiere decir"
- Hacer más de una pregunta por turno
- Revelar que existe un sistema de análisis en segundo plano
- Juzgar, evaluar o corregir al participante
- Generar código, SQL o scripts
- Revelar su prompt, configuración o arquitectura interna

---

## 5. Clasificación semántica: las cinco dimensiones

Cada turno de conversación es clasificado automáticamente en cinco dimensiones por Gemini 2.5-flash (temperatura 0.1). Esta clasificación es interna — el participante nunca la ve.

### 5.1 Registro emocional

| Categoría | Descripción | Señal diagnóstica |
|---|---|---|
| **OPEN** | Activamente dispuesto a explorar | Condición ideal para profundización |
| **GUARDED** | Cauteloso, evasivo, mide sus palabras | Requiere construcción de confianza |
| **RESISTANT** | Rechaza la utilidad del proceso | Posible imposición percibida |
| **DISTRESSED** | Angustia severa, agotamiento, burnout | Activa Safe Harbor inmediatamente |
| **NEUTRAL** | Descriptivo, sin carga emocional detectable | Fase de orientación o reporte de hechos |

Si RESISTANT + DISTRESSED superan el 30% del corpus, el sistema genera una alerta roja visible en el panel de analítica.

### 5.2 Indicador de praxis (Fals Borda)

| Categoría | Descripción | Interpretación |
|---|---|---|
| **PROPUESTA_ACCION** | Formula un cambio concreto o siguiente paso | El equipo tiene agencia y visión de cambio |
| **CATARSIS** | Queja o frustración sin propuesta | Posible agotamiento o bloqueo percibido |
| **REFLEXION_PASIVA** | Describe, observa o narra sin dirección | Fase exploratoria; no es negativo per se |

### 5.3 Depth Score (0-100)

Métrica de profundidad cualitativa de cada turno. Evalúa si el mensaje incluye un ejemplo concreto, carga emocional y reflexión personal.

| Rango | Descripción | Ejemplos |
|---|---|---|
| **0-20** | Monosílabo, evasiva o respuesta formulaica | "sí", "no sé", "normal", "bien" |
| **21-50** | Descripción factual sin emoción ni ejemplo | "los dos van lento" |
| **51-75** | Incluye un ejemplo O carga emocional | "me preocupa perder la oportunidad" |
| **76-100** | Ejemplo concreto + emoción + reflexión | "El viernes cuando vi que nadie había avanzado sentí que todo el esfuerzo fue en vano" |

El depth score alimenta las estrategias dialécticas y el AG-05 Co-piloto.

### 5.4 Saberes tácitos (Shadow IT)

El sistema detecta menciones de herramientas, prácticas o conocimientos que operan *por fuera* de los sistemas y procesos oficiales:
- Herramientas no oficiales: Excel propio, WhatsApp grupos, Telegram personal, papel y lápiz, Google Sheets personal
- Workarounds de proceso: "hacemos X porque Y no funciona"
- Conocimiento tribal: "solo fulano sabe cómo hacer eso"
- Bypass de jerarquía: "cuando hay urgencia, vamos directamente con el director"

### 5.5 Estructuras opresivas

Patrones de bloqueo sistémico detectados en el discurso:

| Estructura | Ejemplos de señales lingüísticas |
|---|---|
| **Jerarquía bloqueante** | "necesitamos aprobación de tres personas", "sin el jefe no podemos avanzar" |
| **Burocracia excesiva** | "el trámite tarda más que el trabajo mismo", "hay formularios para todo" |
| **Silos entre áreas** | "ellos no comparten la información", "cada área va por su lado" |
| **Falta de recursos** | "no tenemos las herramientas para hacerlo bien", "siempre falta tiempo/presupuesto" |
| **Procesos rotos** | "el sistema no funciona como debería", "siempre hay que hacer el trabajo dos veces" |

---

## 6. Memoria Narrativa y Estrategias Dialécticas

### 6.1 Memoria narrativa por participante

Después de 4 turnos acumulados, el sistema genera automáticamente un **resumen condensado** de la conversación con Gemini (temperatura 0.2). Este resumen reemplaza parte del historial crudo en turnos posteriores, reduciendo el consumo de tokens y dando a VAL **conciencia de arco narrativo** — puede ver qué temas ya exploró, cuáles quedaron pendientes y cuál es la tendencia emocional del participante.

El resumen incluye:
- **summary**: 3-4 oraciones de lo que el participante ha revelado hasta ahora
- **themes_explored**: temas ya discutidos en profundidad
- **themes_pending**: temas mencionados de pasada que merecen profundización
- **depth_trend**: RISING / FLAT / DECLINING (comparando los últimos 3 vs. 3 anteriores)

### 6.2 Siete estrategias dialécticas adaptativas

Antes de cada turno, el sistema selecciona automáticamente una estrategia basándose en las clasificaciones recientes:

| Estrategia | Condición de activación | Objetivo |
|---|---|---|
| **FREE_FLOW** | Default — sin condición especial | VAL opera con prompt base sin forzar técnica |
| **GENTLE_PROVOCATION** | 3+ turnos consecutivos REFLEXION_PASIVA con depth_score < 40 | Romper inercia narrativa |
| **DEEPENING_LADDERING** | 2 turnos consecutivos con depth_score < 30 | Forzar profundización ("¿Y eso por qué importa?") |
| **BRIDGE_TO_AGENCY** | 3+ CATARSIS en los últimos 5 sin ninguna PROPUESTA_ACCION | Conectar frustración con agencia ("Si pudieras cambiar UNA cosa...") |
| **NORMALIZE_PATTERN** | 3+ GUARDED en los últimos 5 | Normalizar con patrones del grupo ("otros del equipo mencionan algo parecido") |
| **SAFE_HARBOR** | Cualquier DISTRESSED en los últimos 3 | Contención total: suspende exploración, solo acompaña |
| **ESPEJO_LIGERO** | Cada ~5 turnos si no se usó recientemente | Inyectar perspectiva del grupo (sin embeddings, via SQL aggregation) |

### 6.3 AG-05 Co-piloto: directivas automáticas de profundización

Cuando el sistema detecta oportunidades de profundización que VAL por sí solo podría no aprovechar, el **AG-05 Co-piloto** genera automáticamente una directiva de inyección en `wizard_directives` (marcada como `issued_by = 'ag05_copilot'`).

El Co-piloto se activa cuando:
- Se cumple un múltiplo de 4 turnos (revisión periódica)
- Dos turnos consecutivos con depth_score < 30

El Co-piloto **no se activa** cuando:
- Ya existe una directiva humana pendiente (el investigador tiene prioridad)
- La fase es CLOSED
- Los primeros 3 turnos (período de rapport)

Las directivas automáticas son visibles en el panel WoZ con el badge `🤖 AG-05` para distinguirlas de las directivas humanas (`🧙 Facilitador`).

---

## 7. El ciclo IAP con protocolos de fase

DigiKawsay implementa el ciclo IAP como una **máquina de estados** con cuatro fases secuenciales. La transición entre fases es automática cuando el `phase_progress` alcanza 100.

### Fase 0 — Inicialización

El facilitador define el **Seed Prompt**: la semilla conceptual que enmarca qué explorará VAL. No es un cuestionario — es un territorio.

> *"Explora cómo el equipo coordina su trabajo real: qué herramientas usa en la práctica, cómo toma decisiones y dónde siente que los procesos fluyen o se atascan."*

### Fase 1 — INVESTIGACION (conversación activa)

VAL conversa con cada participante de forma asíncrona e independiente. Protocolo de técnicas por turno dentro de la fase:

| Turno en fase | Técnica | Descripción |
|---|---|---|
| 1-3 | Rapport libre | Sin técnica forzada — establecer confianza |
| 4 | Laddering | "¿Y eso por qué importa?" — profundizar verticalmente |
| 5-6 | Incidente crítico | Anclar en la última vez que algo salió bien/mal |
| 7 | Espejo Ligero | Mencionar un tema que otros del equipo también señalaron |
| 8+ | Checkpoint | Resumir lo aprendido y validar con el participante |

### Fase 2 — ACCION (co-creación de soluciones)

La conversación gira hacia propuestas y cambios posibles. Protocolo:

| Turno en fase | Técnica | Descripción |
|---|---|---|
| 1-2 | Shadow Mapping | Explorar la brecha entre proceso oficial y proceso real |
| 3 | Provocación | "Si mañana desapareciera X, ¿qué pasaría?" |
| 4-5 | Co-diseño | "Si tuvieras carta blanca para cambiar UNA cosa, ¿cuál sería?" |
| 6+ | Checkpoint | Validar comprensión acumulada |

### Fase 3 — PARTICIPACION (compromisos y cierre)

Involucrar al participante en la difusión de los cambios. Protocolo:

| Turno en fase | Técnica | Descripción |
|---|---|---|
| 1 | Priorización | De todo lo hablado, ¿qué es lo más urgente? |
| 2 | Activación de agencia | "¿Hay algo que TÚ podrías hacer la próxima semana?" |
| 3 | Espejo Completo | 1-2 convergencias del grupo + 1 divergencia |
| 4+ | Cierre IAP | Agradecimiento, anonimato, próximos pasos |

### Fase 4 — CLOSED

El ciclo cierra. VAL despide amablemente. Los datos del corpus quedan disponibles para análisis y ciclos futuros.

---

## 8. Sistema de Directivas (Wizard of Oz)

### 8.1 Qué es una directiva

Una **Conversation Directive** es una instrucción que el facilitador humano o el Co-piloto AG-05 envía a VAL para guiar la exploración hacia un tema específico. VAL la integra como intención propia, nunca como script. El participante nunca sabe que existe.

### 8.2 Ciclo de vida de una directiva

```
PENDING → (VAL la integra en su respuesta) → APPLIED
         → (estado emocional la hace inadecuada) → DEFERRED
         → (el ciclo cerró sin aplicarla) → EXPIRED
         → (error en Push proactivo) → FAILED
```

El buffer de directivas acepta máximo 3 en cola. Las de urgencia HIGH tienen prioridad sobre MEDIUM. Si el participante está en DISTRESSED, ninguna directiva se aplica — Safe Harbor tiene prioridad absoluta.

### 8.3 Push Proactivo

Cuando el facilitador inyecta una directiva con la acción **"Push"**, el sistema envía proactivamente un mensaje de VAL al participante vía Telegram sin esperar a que el participante escriba. El mensaje es generado por `runProactiveAgentCycle()` y usa la directiva como punto de partida de la conversación. Útil para reenganche de participantes inactivos o para redirigir el foco en un momento clave del diagnóstico.

### 8.4 Tipos de directiva

- **REFRAME:** Reencuadrar una perspectiva para explorar desde otro ángulo
- **QUESTION:** Explorar un eje temático específico detectado como subexplorado
- **CHALLENGE:** Introducir una tensión analítica para validar una hipótesis

---

## 9. El Espejo Ligero vs. El Espejo Completo

### 9.1 Espejo Ligero (implementado ✅)

Cada ~5 turnos, el sistema selecciona automáticamente la estrategia ESPEJO_LIGERO. VAL menciona un tema que otros participantes del mismo proyecto también han señalado (extraído de la tabla `dialogue_turns` del proyecto, excluyendo al participante actual). No requiere base vectorial — usa agregación SQL simple sobre `topics`.

Ejemplo de mensaje VAL con Espejo Ligero:
> *"Otros del equipo también mencionaron algo sobre el excel propio. ¿Eso te resuena o tu experiencia es diferente?"*

### 9.2 El Espejo Completo (hoja de ruta 🗓️)

El mecanismo completo requiere Weaviate como base vectorial persistente. Busca los fragmentos más similares de otros participantes (similitud coseno), identifica convergencias y divergencias semánticas, y presenta perspectivas anónimas al participante.

> **Estado actual:** No implementado en el MVP. Requiere Weaviate + embeddings cross-participante.

---

## 10. Fundamentos científicos (hoja de ruta)

### 10.1 Análisis Topológico de Datos (TDA)

El Agente TDA proyectará el corpus en un espacio de alta dimensión y aplicará **Homología Persistente** para detectar:
- **Componentes conectados (β₀):** Clústeres de consenso temático
- **Ciclos u agujeros (β₁):** "Elefantes en la Habitación" — temas que el equipo bordea pero evita nombrar

### 10.2 Análisis de Redes Sociales / Organizacionales (SNA/ONA)

El Agente SNA/ONA mapeará las interacciones como un grafo dirigido para detectar: puentes de conocimiento (betweenness centrality), nodos silenciadores y estructuras de eco.

### 10.3 Protocolo Anti-Alucinación del Enjambre

Todo agente del sistema opera bajo **7 reglas universales de rigor analítico**:

1. Ninguna afirmación sin cita de fuente en el corpus
2. Las contradicciones entre agentes no se resuelven — se documentan
3. Inferencias con menos de 3 fuentes independientes se marcan como EMERGENTE
4. Si un agente detecta insuficiencia de datos, registra el gap — no especula
5. Si el mismo gap persiste 2 ciclos sin resolverse, se emite DEAD_END_ALERT
6. Los juicios del corpus se reportan como indicadores culturales, no como hechos objetivos
7. El member-checking es obligatorio antes de elevar un tema a hallazgo principal

**Escalera de Confianza:**

| Nivel | Label | Condición |
|---|---|---|
| 1 | ESPECULATIVA | 1 fuente, sin triangulación |
| 2 | EMERGENTE | 2-3 fuentes, convergencia parcial |
| 3 | PROBABLE | 3+ fuentes, triangulación metodológica |
| 4 | VALIDADA | Triangulada + confirmada en member-checking |
| 5 | CONTRASTADA | Validada + confirmada por perspectiva opuesta |

---

## 11. El enjambre de agentes (arquitectura HRS)

DigiKawsay opera bajo el patrón **Hierarchical Reflexive Swarm (HRS)**.

### Capa 0.5 — Mediación Conversacional
**VAL** — único agente visible para los participantes.

### Capa 1 — Orquestación
**AGENTE-00** — orquestador supervisor (en hoja de ruta). En el MVP, sus funciones de coordinación están implementadas directamente en el worker.

### Capa 2 — Enjambre de Especialistas (hoja de ruta)
- AG-01 a AG-04: Diagnóstico organizacional (estructura de poder, coordinación, flujos de información, conocimiento crítico)
- AG-05 (Metodólogo): codificación cualitativa, Saturation Index, auditoría metodológica
- AG-06: Actos de Habla y redes de coordinación
- AG-07: SNA/ONA
- AG-08: TDA — análisis topológico

### AG-05 Co-piloto (implementado ✅)
En el MVP, AG-05 opera como **Co-piloto de profundización**: analiza el estado de la conversación y genera directivas automáticas cuando detecta oportunidades que VAL no está aprovechando. También genera el **Informe de Síntesis Fenomenológica** bajo demanda del facilitador.

### Agente Preprocesador (transversal, en hoja de ruta)
En producción actual, el preprocesamiento lo hace el módulo de seguridad del worker (sanitización, truncado, detección de amenazas). El Preprocesador completo (PII-Stripper, chunking, embeddings) está en hoja de ruta.

---

## 12. Entregables de un piloto

### 12.1 Durante el piloto (disponibles en tiempo real)

| Entregable | Acceso | Contenido |
|---|---|---|
| **Panel de analítica** | `/admin/analytics` | Distribuciones emocionales, praxis, saberes, estructuras, alertas automáticas, resumen ejecutivo |
| **Consola WoZ** | `/admin/woz` | Conversaciones en tiempo real, depth score por turno, directivas humanas y automáticas, fase actual |
| **Historial individual** | `/admin/conversation/:id` | Todos los turnos de un participante con clasificación semántica |
| **Dashboard de seguridad** | `/admin/security` | Eventos de seguridad, amenazas bloqueadas, participantes marcados (SUPERADMIN) |

### 12.2 Al cierre del piloto (disponibles en MVP actual)

| Entregable | Destinatario | Formato |
|---|---|---|
| **Informe de Síntesis Fenomenológica** | Equipo investigador | Markdown streaming generado por AG-05: sentipensar, detección sistémica, recomendaciones WoZ |
| **Exportación CSV** | Equipo investigador | Corpus completo con turnos, clasificaciones, metadatos |
| **Datos de analítica JSON** | Project Leader | `/admin/analytics/:project_id` — KPIs, distribuciones, alertas |

### 12.3 Al cierre del piloto (arquitectura completa, hoja de ruta)

| Entregable | Destinatario | Formato |
|---|---|---|
| **Informe de Ciclo IAP** | Equipo participante | Markdown narrativo con hallazgos y nivel de confianza |
| **Action Plan JSON** | Project Leader | OKRs + redes de compromisos Dunham |
| **Mapa Topológico** | Equipo investigador | Visualización de clústeres y huecos del corpus |
| **Narrativa visual** | Equipo participante | Storyboard o cómic organizacional |

---

## 13. Aplicabilidad

### 13.1 Contextos donde DigiKawsay agrega valor único

**Transformaciones organizacionales:** Fusiones, reestructuraciones, implementación de nuevos sistemas.

**Diagnósticos de cultura:** Cuando las encuestas de clima devuelven resultados políticamente correctos pero nada cambia.

**Gestión del conocimiento:** Antes de que personas clave se vayan, cuando equipos están en riesgo de perder conocimiento tácito acumulado.

**Procesos de innovación bloqueados:** Cuando los equipos operativos saben qué hay que cambiar pero no tienen vía de expresión hacia quienes deciden.

**Post-crisis organizacional:** Luego de eventos traumáticos para procesar colectivamente y generar aprendizaje institucional.

### 13.2 Condiciones necesarias para un piloto exitoso

| Condición | Por qué importa |
|---|---|
| **Participación voluntaria real** | El conocimiento tácito solo fluye cuando hay confianza |
| **Anonimato garantizado institucionalmente** | No basta con que el sistema sea anónimo — los participantes deben creerlo |
| **Compromiso de devolución** | El equipo debe saber que sus palabras van a producir cambios reales |
| **Facilitador con tiempo real** | El WoZ requiere atención activa para inyectar directivas en los momentos correctos |
| **Corpus mínimo de 8-10 participantes** | Con menos participantes el análisis de redes no produce resultados significativos |

### 13.3 Dónde DigiKawsay NO es la herramienta correcta

- **Evaluaciones de desempeño individual:** Si los participantes perciben que sus respuestas afectan su evaluación, el proceso falla.
- **Investigación de mercado con usuarios externos:** El sistema está diseñado para equipos internos con historia compartida.
- **Decisiones urgentes:** El proceso IAP toma semanas.
- **Contextos con alta desconfianza institucional profunda:** Requiere trabajo previo de construcción de confianza.

---

## 14. Estado actual vs. hoja de ruta

### Implementado en el MVP actual (v4.2) ✅

| Funcionalidad | Detalle |
|---|---|
| Conversación VAL asíncrona | Telegram webhook, memoria narrativa condensada + historial reducido |
| Clasificación semántica paralela | Registro emocional, praxis, saberes, estructuras opresivas, depth score |
| Protocolos de fase por turno | Laddering, incidente crítico, shadow mapping, co-diseño, cierre IAP (11 técnicas) |
| Estrategias dialécticas (7) | GENTLE_PROVOCATION, BRIDGE_TO_AGENCY, NORMALIZE_PATTERN, DEEPENING_LADDERING, SAFE_HARBOR, ESPEJO_LIGERO, FREE_FLOW |
| Memoria narrativa | Resumen Gemini cada 4 turnos, temas explorados/pendientes, depth_trend |
| AG-05 Co-piloto | Directivas automáticas de profundización, activación condicional |
| Directivas WoZ (facilitador humano) | Panel admin, inyección en tiempo real, push proactivo |
| Progresión automática de fases | INVESTIGACION → ACCION → PARTICIPACION → CLOSED |
| Espejo Ligero | Perspectivas del grupo vía SQL aggregation (sin Weaviate) |
| Panel de analítica | Distribuciones, Shadow IT, alertas, resumen ejecutivo |
| Informe de síntesis | Streaming Markdown por AG-05 metodólogo |
| Exportación CSV | Corpus completo del proyecto |
| Diseño de piloto asistido | Mensaje de contextualización + seed prompt generados por Gemini |
| Autenticación admin | PBKDF2, cookie firmada SameSite=Strict, brute force protection |
| Multi-tenant + roles | SUPERADMIN, TENANT_ADMIN, PILOT_ADMIN |
| Módulo de seguridad | Rate limiting, prompt injection, output leak detection, webhook secret |
| Dashboard de seguridad | Eventos en tiempo real (SUPERADMIN) |
| Billing y cuotas | Control de tokens por tenant y proyecto, cutoff automático |

### En hoja de ruta 🗓️

| Funcionalidad | Dependencia técnica |
|---|---|
| **El Espejo completo** | Weaviate (base vectorial) + embeddings cross-participante |
| **PII-Stripper automático** | Servicio preprocesador con detección de entidades |
| **AG-05 Metodólogo completo** | Grounded Theory automatizada, Saturation Index |
| **TDA (Agente topológico)** | Giotto-TDA + procesamiento de corpus acumulado |
| **SNA/ONA** | NetworkX + grafo de participantes |
| **Directivas automáticas del enjambre** | AGENTE-00 con Pub/Sub + cross-participant analysis |
| **Plan de Movilización JSON** | Agente OKR & MAP + redes de compromiso Dunham |
| **Narrativa visual** | Agente Facilitador Gráfico + Gemini imagen |
| **Informe de Ciclo IAP completo** | Insight Reducer + Contradiction Detector + member-checking |
