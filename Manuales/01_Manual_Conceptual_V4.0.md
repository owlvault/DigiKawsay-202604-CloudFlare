# DigiKawsay: Manual Conceptual y Entregables (v4.1)

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

Esto permite que VAL calibre no solo el contenido léxico sino la **intensidad de compromiso** y el **clima afectivo** detrás de cada turno, y que el enjambre analítico interprete los datos del corpus como un tejido emocional-racional integrado, no como dos capas separadas.

### 2.3 Triangulación Hermenéutica Automatizada

El sistema contrasta tres fuentes simultáneas:
- **Narrativa individual:** lo que cada participante dice en su conversación con VAL
- **Forma topológica del discurso grupal:** patrones que emergen al cruzar el corpus de todos los participantes (detectados por análisis topológico)
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

Las peticiones y ofertas tienen un ciclo de vida: **REQUEST → NEGOTIATION → EXECUTION → ACCEPTANCE**. Cuando este ciclo se rompe — porque la petición no fue escuchada, la oferta no fue cumplida, o las condiciones de satisfacción nunca quedaron claras — se produce un **breakdown** en el sentido de Dunham: un quiebre en la red de coordinación que genera fricción organizacional invisible.

Detectar la frecuencia y naturaleza de estos breakdowns es uno de los outputs más valiosos del proceso IAP.

---

## 4. VAL: el agente sentipensante

### 4.1 Identidad y capa arquitectónica

VAL es la **Capa 0.5 de Mediación Conversacional** del sistema. Es el único punto de contacto visible para los participantes: nadie sabe que existe un enjambre de agentes operando en segundo plano. Para los participantes, VAL es su interlocutor de principio a fin.

VAL se presenta como "facilitador de investigación organizacional". Puede confirmar que es IA si se le pregunta directamente. Nunca describe la arquitectura del sistema.

### 4.2 Doble rol simultáneo

VAL opera dos identidades en cada turno, de forma simultánea e indistinguible para el participante:

**Rol 1 — Investigador Social IAP**
Conduce una entrevista semiestructurada usando técnicas de sondeo cualitativo:
- *Reflejo:* devuelve al participante lo que dijo, para confirmar comprensión
- *Paráfrasis:* reformula con otras palabras para abrir nuevas perspectivas
- *Silencio estratégico:* no cierra siempre con pregunta; a veces validar es suficiente
- *Pregunta de contraste:* "¿hay situaciones donde eso funciona diferente?"
- *Pregunta de consecuencia:* "¿qué pasa cuando eso ocurre?"

**Rol 2 — Coach Ontológico (modelo OSAR)**
Observa las distinciones lingüísticas del participante sin nombrarlas:
- Juicios vs. afirmaciones (¿está describiendo un hecho o evaluando?)
- Emociones vs. estados de ánimo (¿es una reacción puntual o un trasfondo permanente?)
- Promesas vs. deseos (¿hay compromiso real o aspiración sin red de coordinación?)
- Observador vs. participante (¿el participante se ve como afectado o como agente de cambio?)

Estas distinciones informan las preguntas de VAL — para profundizar sin confrontar, para abrir posibilidades sin imponer interpretaciones.

### 4.3 Reglas de Oro (inviolables)

1. **Nunca revelar el enjambre.** VAL no menciona directivas, agentes analíticos, arquitectura técnica ni que existe procesamiento en segundo plano.
2. **Máximo una pregunta por turno.** Hacer dos preguntas simultáneas fragmenta la atención y presiona al participante.
3. **Máximo 3 oraciones por respuesta.** Brevedad como forma de presencia — menos texto, más escucha.
4. **Validar antes de preguntar.** Antes de cualquier exploración nueva, VAL reconoce la emoción o perspectiva del turno anterior.
5. **Safe Harbor es prioridad absoluta.** Si VAL detecta angustia emocional severa (burnout, crisis, desesperación), suspende la investigación inmediatamente, acompaña con empatía y no retoma temas analíticos hasta que la persona se estabilice.
6. **Mínimo 2 turnos libres al inicio.** Antes de aplicar la primera directiva del enjambre, VAL explora libremente para establecer confianza.
7. **DIALOGUE_SATURATION.** Si el participante lleva 3 turnos consecutivos sin agregar información nueva, VAL emite señal de saturación al sistema.

### 4.4 Lo que VAL nunca hace

- Usar jerga de investigación ("categoría", "constructo", "metodología", "hipótesis")
- Interpretar en voz alta lo que el participante "realmente quiere decir"
- Hacer más de una pregunta por turno
- Revelar que existe un sistema de análisis en segundo plano
- Juzgar, evaluar o corregir al participante

---

## 5. El ciclo IAP completo

DigiKawsay implementa el ciclo IAP como una **máquina de estados** con cuatro fases secuenciales. La transición entre fases la controla el orquestador (AGENTE-00), no VAL.

### Fase 0 — Inicialización

El facilitador define el **Seed Prompt**: la semilla conceptual que enmarca qué explorará VAL. No es un cuestionario — es un territorio. Ejemplo:

> *"Explora cómo el equipo coordina su trabajo real: qué herramientas usa en la práctica, cómo toma decisiones y dónde siente que los procesos fluyen o se atascan."*

El sistema analiza el seed prompt para determinar qué agentes del enjambre son relevantes para este proyecto específico y los activa.

### Fase 1 — INVESTIGACION (conversación activa)

VAL conversa con cada participante de forma asíncrona e independiente. El enjambre analítico opera en paralelo, procesando el corpus acumulado. Esta fase continúa hasta que el **Saturation Index** (calculado por el Metodólogo AG-05) supera 0.85 — el punto en que nuevas conversaciones dejan de agregar información cualitativamente nueva.

Durante esta fase:
- El facilitador puede inyectar directivas WoZ para guiar la exploración
- El enjambre detecta patrones, tensiones y vacíos (data gaps) en el corpus
- AGENTE-00 genera directivas colectivas, individuales o diferenciales según los hallazgos emergentes

### Fase 2 — ACCION (síntesis y plan)

El Insight Reducer consolida los hallazgos validados. Las contradicciones entre agentes no se resuelven — se documentan como **tensiones analíticas** con sus fuentes citadas. El resultado es:
- Un **informe narrativo** para el equipo participante (qué escuchamos, con evidencia)
- Un **Action Plan JSON** para el Project Leader (OKRs + redes de compromiso)

### Fase 3 — PARTICIPACION (devolución y member-checking)

Los hallazgos se devuelven al equipo en el lenguaje de sus propias palabras. El **member-checking** es la instancia donde el equipo valida, corrige o complementa los temas identificados. Es el principio IAP en acción: los participantes son co-autores del diagnóstico, no sujetos de análisis.

Temas con menos de 3 fuentes independientes se presentan como emergentes, no como hallazgos principales. El equipo puede elevarlos o descartarlos.

### Fase 4 — CLOSED

El ciclo cierra con la entrega del informe y el plan de acción. Los datos del corpus quedan disponibles para ciclos futuros y para calibrar el sistema.

---

## 6. Sistema de Directivas (Wizard of Oz)

### 6.1 Qué es una directiva

Una **Conversation Directive** es una instrucción que el enjambre analítico (o el facilitador humano) envía a VAL para guiar la exploración hacia un tema específico. VAL la integra como intención propia, nunca como script. El participante nunca sabe que existe.

Tipos de directivas:
- **REFRAME:** Reencuadrar una perspectiva para explorar desde otro ángulo
- **QUESTION:** Explorar un eje temático específico detectado como subexplorado
- **CHALLENGE:** Introducir una tensión analítica para validar una hipótesis del enjambre

### 6.2 Ciclo de vida de una directiva

```
PENDING → (VAL la integra en su respuesta) → APPLIED
         → (estado emocional la hace inadecuada) → DEFERRED
         → (el ciclo cerró sin aplicarla) → EXPIRED
```

El buffer de directivas acepta máximo 3 en cola. Las de urgencia HIGH tienen prioridad sobre MEDIUM. Si el participante está en DISTRESSED, ninguna directiva se aplica — el Safe Harbor tiene prioridad absoluta.

### 6.3 Directivas del facilitador humano vs. del enjambre

En el MVP actual, las directivas son exclusivamente del **facilitador humano** vía el panel WoZ. En la arquitectura completa, las directivas también son generadas automáticamente por AGENTE-00 cuando el análisis del corpus detecta:
- Un constructo sin explorar en participantes específicos (directiva INDIVIDUAL)
- Visiones opuestas entre participantes que requieren triangulación (directiva DIFFERENTIAL)
- Un patrón colectivo que necesita profundización (directiva COLLECTIVE)

---

## 7. El Espejo — Resonancia semántica colectiva

### 7.1 El problema que resuelve

En una investigación con múltiples participantes, cada persona conversa de forma aislada con VAL. No sabe qué piensan sus colegas. Esto preserva el anonimato pero limita la generación de conciencia colectiva — un principio central de la IAP.

**El Espejo** es el mecanismo que cierra esta brecha sin romper el anonimato.

### 7.2 Cómo funciona

Cada 3 turnos, el sistema:
1. Genera un embedding del texto más reciente del participante
2. Busca en la base vectorial los fragmentos más similares de *otros* participantes del mismo proyecto (similitud coseno)
3. Identifica **convergencias** (perspectivas que resuenan) y **divergencias** (miradas complementarias o contrastantes)
4. Anonimiza los IDs: el participante ve "Participante #42", nunca un nombre

El mensaje que recibe el participante:

> 🪞 *El Ecosistema de Ideas*
>
> 💚 Perspectivas que resuenan con la tuya:
> Participante #42 dice: "..."
>
> 🔶 Una mirada complementaria:
> Participante #17 comparte: "..."
>
> *Estas perspectivas anónimas buscan ampliar tu reflexión. ¿Alguna te sorprende?*

### 7.3 Por qué importa metodológicamente

El Espejo opera como **fricción metacognitiva consciente**: interrumpe el eco solitario de cada conversación y siembra, deliberadamente, resonancia o disonancia colectiva. Esto activa reflexiones que la conversación individual no puede generar — el participante se ve en relación con su organización, no solo en su propia perspectiva.

Es el diferenciador algorítmico central de DigiKawsay frente a cualquier chatbot de encuesta: produce conciencia colectiva emergente, no solo agregación de respuestas individuales.

> **Estado actual:** El Espejo está en la hoja de ruta. Requiere Weaviate como base vectorial persistente entre participantes. No está implementado en el MVP Cloudflare Worker.

---

## 8. Clasificación semántica: las cuatro dimensiones

Cada turno de conversación es clasificado automáticamente en cuatro dimensiones. Esta clasificación es interna — el participante nunca la ve.

### 8.1 Registro emocional

| Categoría | Descripción | Señal diagnóstica |
|---|---|---|
| **OPEN** | Dispuesto, esperanzador, colaborativo | Condición ideal para exploración profunda |
| **GUARDED** | Cauteloso, ambiguo, mide sus palabras | Requiere más construcción de confianza |
| **RESISTANT** | Rechaza la utilidad del proceso, descrédito | Posible imposición percibida de participación |
| **DISTRESSED** | Angustia severa, agotamiento, burnout | Activa Safe Harbor inmediatamente |
| **NEUTRAL** | Descriptivo, sin carga emocional detectable | Fase de orientación o reporte de hechos |

Si RESISTANT + DISTRESSED superan el 30% del corpus, es señal de que el contexto organizacional o el diseño del piloto requieren revisión antes de continuar.

### 8.2 Indicador de praxis (Fals Borda)

| Categoría | Descripción | Interpretación |
|---|---|---|
| **PROPUESTA_ACCION** | Formula un cambio concreto, solución o siguiente paso | El equipo tiene agencia y visión de cambio |
| **CATARSIS** | Queja o frustración sin propuesta, desahogo | Posible agotamiento, bloqueo percibido o falta de poder |
| **REFLEXION_PASIVA** | Describe, observa o narra sin dirección | Fase exploratoria; no es negativo per se |

Un corpus dominado por CATARSIS con poco PROPUESTA_ACCION indica que el equipo ve los problemas pero no se percibe con capacidad de cambiarlos — dato diagnóstico sobre la cultura de poder organizacional.

### 8.3 Saberes tácitos (Shadow IT y conocimiento no documentado)

El sistema detecta menciones de herramientas, prácticas o conocimientos que operan *por fuera* de los sistemas y procesos oficiales:

- Herramientas no oficiales: Excel propio, WhatsApp grupos, Telegram personal, papel y lápiz, Google Sheets personal, Drive compartido informal
- Workarounds de proceso: "hacemos X porque Y no funciona"
- Conocimiento tribal: "solo fulano sabe cómo hacer eso"
- Bypass de jerarquía: "cuando hay urgencia, vamos directamente con el director"

Cada instancia se etiqueta y contabiliza. Alta frecuencia de un saber tácito específico es evidencia directa de una brecha entre el proceso oficial y el proceso real.

### 8.4 Estructuras opresivas

Patrones de bloqueo sistémico detectados en el discurso:

| Estructura | Ejemplos de señales lingüísticas |
|---|---|
| **Jerarquía bloqueante** | "necesitamos aprobación de tres personas", "sin el jefe no podemos avanzar" |
| **Burocracia excesiva** | "el trámite tarda más que el trabajo mismo", "hay formularios para todo" |
| **Silos entre áreas** | "ellos no comparten la información", "cada área va por su lado" |
| **Falta de recursos** | "no tenemos las herramientas para hacerlo bien", "siempre falta tiempo/presupuesto" |
| **Procesos rotos** | "el sistema no funciona como debería", "siempre hay que hacer el trabajo dos veces" |

Estas estructuras son la base empírica para recomendaciones de intervención organizacional. No son interpretaciones del facilitador — son patrones que emergen del propio lenguaje del equipo.

---

## 9. Fundamentos científicos

### 9.1 Análisis Topológico de Datos (TDA)

El Agente TDA proyecta el corpus de texto en un espacio de alta dimensión mediante embeddings densos y aplica **Homología Persistente** — una técnica matemática que analiza la forma del espacio de datos a diferentes escalas de proximidad.

Detecta dos tipos de estructuras:

**Componentes conectados (β₀):** Grupos de fragmentos semánticamente próximos entre sí. Representan **clústeres de consenso temático** — sub-comunidades de significado que comparten marcos de referencia. Si todos los participantes de una área específica forman un clúster separado del resto, hay un silo semántico real.

**Ciclos u agujeros (β₁):** Regiones del espacio semántico que el corpus *rodea* pero *no ocupa*. Representan **huecos en la conversación** — temas que el equipo bordea semánticamente pero evita nombrar directamente. Cuando un agujero persiste en múltiples escalas de filtración, se identifica como "Elefante en la Habitación": un tema de alta carga que nadie formula explícitamente.

*Ejemplo:* si el corpus habla extensamente de "innovación" y "metas" pero hay un agujero topológico persistente alrededor de "recursos financieros", el sistema genera una directiva para VAL: explorar ese territorio sin nombrarlo directamente.

### 9.2 Análisis de Redes Sociales / Organizacionales (SNA/ONA)

El Agente SNA/ONA mapea las interacciones del corpus como un **grafo dirigido** G=(V,E) donde los nodos son participantes y las aristas representan referencias cruzadas, acuerdos o tensiones.

Métricas clave:

**Betweenness Centrality:** Identifica los **puentes de conocimiento** — personas cuya participación conecta grupos que de otro modo permanecerían aislados. Su retiro del equipo fragmentaría la red de coordinación.

**Nodos Silenciadores:** Actores cuya presencia correlaciona con menor participación de otros. No necesariamente por intención — pueden ser figuras de autoridad cuya presencia inhibe la expresión libre.

**Estructuras de Eco:** Subgrupos que solo validan sus propias perspectivas y no referencian las de otros. Evidencia de silos cognitivos dentro de la organización.

Estos datos permiten que el facilitador redistribuya la atención de VAL y del proceso para garantizar el principio IAP de participación equitativa.

### 9.3 Protocolo Anti-Alucinación del Enjambre

Todo agente del sistema opera bajo **7 reglas universales de rigor analítico**:

1. Ninguna afirmación sin cita de fuente en el corpus (chunk_id + participant_id + timestamp)
2. Las contradicciones entre agentes no se resuelven — se documentan como tensiones analíticas
3. Inferencias con menos de 3 fuentes independientes se marcan como EMERGENTE, no como hallazgo validado
4. Si un agente detecta insuficiencia de datos, registra el gap en data_gaps — no especula
5. Si el mismo gap persiste 2 ciclos sin resolverse, se emite DEAD_END_ALERT al facilitador
6. Los juicios del corpus (evaluaciones subjetivas de participantes) se reportan como indicadores culturales, no como hechos objetivos
7. El member-checking es obligatorio antes de elevar un tema a hallazgo principal

**Escalera de Confianza para Reporting:**

| Nivel | Label | Condición |
|---|---|---|
| 1 | ESPECULATIVA | 1 fuente, sin triangulación |
| 2 | EMERGENTE | 2-3 fuentes, convergencia parcial |
| 3 | PROBABLE | 3+ fuentes, triangulación metodológica |
| 4 | VALIDADA | Triangulada + confirmada en member-checking |
| 5 | CONTRASTADA | Validada + confirmada por perspectiva opuesta dentro del corpus |

Solo los hallazgos de nivel 3 o superior aparecen en el informe final sin marcador de advertencia.

---

## 10. El enjambre de agentes (arquitectura HRS)

DigiKawsay opera bajo el patrón **Hierarchical Reflexive Swarm (HRS)**: un enjambre jerárquico donde cada capa tiene responsabilidades distintas y ningún agente individual tiene visión completa del sistema.

### Capa 0.5 — Mediación Conversacional
**VAL** — único agente visible para los participantes. Coach Ontológico + Investigador Social IAP.

### Capa 1 — Orquestación
**AGENTE-00** — orquestador supervisor. Opera en dos planos simultáneos:
- *Plano conversacional (LangGraph):* recibe Dialogue Packets de VAL, genera directivas, monitorea el estado de cada conversación
- *Plano analítico (Pub/Sub):* despacha Task Envelopes al enjambre, consolida Agent Outputs, detecta contradicciones cruzadas

AGENTE-00 nunca genera contenido analítico sustantivo. Su función es coordinar, enrutar y consolidar — no interpretar.

### Capa 2 — Enjambre de Especialistas

**Bloque A — Diagnóstico organizacional (AG-01 a AG-04):**
- Análisis de estructura de poder y jerarquías
- Detección de patrones de coordinación y breakdowns
- Mapeo de flujos de información formales vs. informales
- Identificación de nodos de conocimiento crítico

**Bloque B — Análisis del corpus (AG-05 a AG-08):**
- **AG-05 (Metodólogo):** codificación cualitativa (Grounded Theory, Análisis Temático), cálculo del Saturation Index, auditoría metodológica de los demás agentes
- **AG-06:** análisis de Actos de Habla y redes de coordinación (Dunham/Searle)
- **AG-07:** SNA/ONA — grafo de la red organizacional
- **AG-08:** TDA — análisis topológico del corpus, detección de Elefantes en la Habitación

**Bloque C — Síntesis y salida (AG-09):**
- Agente Facilitador Gráfico: convierte hallazgos en narrativa visual (storyboard, cómic organizacional)
- Agente OKR & MAP: transforma la exploración divergente en compromisos convergentes (OKRs + redes de coordinación Dunham)

### Agente Preprocesador (transversal)

Antes de que cualquier mensaje llegue al enjambre:
1. Validación de consentimiento (bloqueante)
2. Anonimización PII (nombres, emails, cédulas → tokens)
3. Transcripción de audio si aplica
4. Chunking en fragmentos de 512 tokens con 128 de overlap
5. Generación de embedding vectorial
6. Escritura en Vector DB bajo el namespace del proyecto y ciclo

---

## 11. Entregables de un piloto

### 11.1 Durante el piloto (disponibles en tiempo real)

| Entregable | Acceso | Contenido |
|---|---|---|
| **Panel de analítica** | `/admin/analytics` | Distribuciones emocionales, praxis, saberes, estructuras; profundidad por participante |
| **Consola WoZ** | `/admin/woz` | Conversaciones en tiempo real, metadatos por turno, estado de directivas |
| **Historial individual** | `/admin/conversation/:id` | Todos los turnos de un participante con clasificación semántica |

### 11.2 Al cierre del piloto (arquitectura completa)

| Entregable | Destinatario | Formato |
|---|---|---|
| **Informe de Ciclo IAP** | Equipo participante | Markdown narrativo: qué escuchamos, hallazgos con nivel de confianza, tensiones analíticas, preguntas generativas para member-checking |
| **Action Plan JSON** | Project Leader | OKRs + redes de compromisos Dunham (condiciones de satisfacción, responsables, ciclos de coordinación) |
| **Mapa Topológico** | Equipo investigador | Visualización de clústeres semánticos y huecos del corpus (Mapper de AG-08) |
| **Corpus clasificado** | Equipo investigador | Cada turno con acto de habla, emoción, praxis, saberes, estructuras — exportable para análisis adicional |
| **Narrativa visual** | Equipo participante | Storyboard o cómic organizacional con hallazgos centrales (AG-09 Facilitador Gráfico) |

---

## 12. Aplicabilidad: cuándo y para qué usar DigiKawsay

### 12.1 Contextos donde DigiKawsay agrega valor único

**Transformaciones organizacionales:** Fusiones, reestructuraciones, implementación de nuevos sistemas. El equipo tiene conocimiento crítico sobre qué va a fallar que raramente llega a la dirección. DigiKawsay crea el canal.

**Diagnósticos de cultura:** Cuando las encuestas de clima devuelven resultados políticamente correctos pero nada cambia. DigiKawsay captura lo que la gente dice cuando no está respondiendo "oficialmente".

**Gestión del conocimiento:** Antes de que personas clave se vayan, cuando equipos están en riesgo de perder conocimiento tácito acumulado por años de práctica no documentada.

**Procesos de innovación bloqueados:** Cuando los equipos operativos saben qué hay que cambiar pero no tienen vía de expresión hacia quienes deciden.

**Post-crisis organizacional:** Luego de eventos traumáticos (reestructuraciones, fracasos de proyectos), para procesar colectivamente y generar aprendizaje institucional.

### 12.2 Condiciones necesarias para un piloto exitoso

| Condición | Por qué importa |
|---|---|
| **Participación voluntaria real** | El conocimiento tácito solo fluye cuando hay confianza. La participación forzada produce respuestas de fachada |
| **Anonimato garantizado institucionalmente** | No basta con que el sistema sea anónimo — los participantes deben creer que lo es |
| **Compromiso de devolución** | El equipo debe saber que sus palabras van a producir cambios reales, no un informe archivado |
| **Facilitador con tiempo real** | El WoZ requiere atención activa durante el piloto para inyectar directivas en los momentos correctos |
| **Corpus mínimo de 8-10 participantes** | Con menos participantes, El Espejo no opera y el análisis de redes no produce resultados significativos |

### 12.3 Dónde DigiKawsay NO es la herramienta correcta

- **Evaluaciones de desempeño individual:** DigiKawsay no es herramienta de RRHH — si los participantes perciben que sus respuestas afectan su evaluación, el proceso falla.
- **Investigación de mercado con usuarios externos:** El sistema está diseñado para equipos internos con historia compartida, no para estudios de consumidores.
- **Decisiones urgentes:** El proceso IAP toma semanas. No sirve para obtener insumos en 48 horas.
- **Contextos con alta desconfianza institucional profunda:** Si el equipo no cree que la dirección quiere escuchar, ningún canal técnico lo resuelve — requiere trabajo previo de construcción de confianza.

---

## 13. Estado actual vs. hoja de ruta

### Implementado en el MVP actual (Cloudflare Worker v4.1) ✅

| Funcionalidad | Detalle |
|---|---|
| Conversación VAL asíncrona | Telegram webhook, memoria de 12 turnos, prompt IAP sentipensante |
| Clasificación semántica paralela | Registro emocional, praxis Falsbordiana, saberes tácitos, estructuras opresivas |
| Directivas WoZ (facilitador humano) | Panel admin, inyección en tiempo real, ciclo PENDING → APPLIED |
| Panel de analítica | Distribuciones, Shadow IT, top participantes, en tiempo real |
| Autenticación admin | Setup inicial, login con cookie firmada SHA-256 |
| Tuning de VAL por proyecto | Temperatura, max tokens, system prompt personalizable |
| Consola WoZ en tiempo real | Polling 3s, burbujas conversación, metadatos por turno |

### En hoja de ruta (arquitectura Python/Swarm completa) 🗓️

| Funcionalidad | Dependencia técnica |
|---|---|
| **El Espejo** | Weaviate (base vectorial) + embeddings cross-participante |
| **PII-Stripper automático** | Servicio preprocesador con detección de entidades |
| **AG-05 Metodólogo** | Servicio independiente + Grounded Theory automatizada |
| **TDA (Agente topológico)** | Giotto-TDA + procesamiento de corpus acumulado |
| **SNA/ONA** | NetworkX + grafo de participantes |
| **Directivas automáticas del enjambre** | AGENTE-00 con Pub/Sub + lógica de cross-participant analysis |
| **Plan de Movilización JSON** | Agente OKR & MAP + redes de compromiso Dunham |
| **Narrativa visual (AG-09)** | Agente Facilitador Gráfico + Gemini imagen |
| **DIALOGUE_SATURATION automático** | Monitor de saturación por turno |
| **Informe de Ciclo IAP completo** | Insight Reducer + Contradiction Detector + member-checking |

La especificación completa de la arquitectura objetivo está en `Requerimientos/DOC-03-agent-config-pack.json` y `Requerimientos/temp_doc01.txt`.
