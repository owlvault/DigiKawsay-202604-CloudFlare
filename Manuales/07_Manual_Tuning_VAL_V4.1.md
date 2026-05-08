# DigiKawsay: Manual de Tuning de VAL (v4.2)

El panel de **Tuning** permite ajustar el comportamiento de VAL por proyecto sin necesidad de redesplegar el worker. Los parámetros se guardan en la tabla `agent_metaparams` de D1 y se aplican en cada ciclo conversacional.

---

## 1. Acceso

```
https://TU_WORKER.workers.dev/admin/tuning
```

Requiere sesión de administrador activa. Muestra los parámetros actuales del proyecto seleccionado y permite modificarlos.

---

## 2. Parámetros configurables

### 2.1 Temperatura (`active_temperature`)

**Rango:** 0.0 — 1.0  
**Default:** 0.7

Controla la variabilidad de las respuestas conversacionales de VAL.

| Valor | Comportamiento | Cuándo usar |
|---|---|---|
| 0.0 – 0.3 | Respuestas muy consistentes y predecibles | Protocolos de investigación muy estructurados |
| 0.4 – 0.6 | Balance entre coherencia y variedad | Exploración temática con estructura moderada |
| **0.7** | **Valor recomendado** — creativo pero coherente | **Conversación IAP sentipensante (default)** |
| 0.8 – 1.0 | Alta variabilidad, más sorpresivo | Exploración abierta, sesiones creativas |

> **Nota:** El clasificador semántico siempre usa temperatura **0.1** independientemente de este parámetro. El generador de resúmenes narrativos usa temperatura **0.2**. El AG-05 Co-piloto usa temperatura **0.3**. Solo la respuesta conversacional de VAL usa este parámetro.

### 2.2 Máximo de tokens de salida (`max_output_tokens`)

**Rango:** 50 — 1000  
**Default:** 300

Limita la extensión máxima de cada respuesta de VAL que el facilitador puede configurar.

> **Importante — floor interno de 2048:** Gemini 2.5 Flash usa tokens de "thinking" interno que consumen presupuesto de `maxOutputTokens`. Para garantizar que VAL siempre tenga espacio suficiente para su respuesta, el sistema aplica un **floor interno de 2048 tokens** independientemente de lo que el facilitador configure aquí. En la práctica, configurar valores menores a 2048 no genera respuestas cortas por limitación de tokens — para respuestas cortas, el prompt mismo es más efectivo.

| Valor configurado | Extensión aproximada de respuesta | Cuándo usar |
|---|---|---|
| 50 – 150 | 1-2 oraciones cortas | Silencio estratégico, respuestas telegráficas |
| **150 – 300** | **2-3 oraciones** | **Protocolo IAP recomendado (brevedad Fals Borda)** |
| 300 – 500 | 3-5 oraciones | Cuando se requiere más contexto |
| 500+ | Respuestas extensas | No recomendado — rompe el principio de brevedad IAP |

> El protocolo sentipensante establece máximo 3 oraciones por turno. La forma más efectiva de garantizar brevedad es el system prompt (VAL_BASE_PROMPT ya incluye esta regla), no el límite de tokens.

### 2.3 System prompt base (`system_base_prompt`)

**Default:** El `VAL_BASE_PROMPT` codificado en `agent.ts` (prompt sentipensante completo)

Permite reemplazar completamente el prompt base de VAL para un proyecto específico.

**Variable disponible:**
```
{SEED_PROMPT}
```
Esta variable se reemplaza automáticamente con el seed prompt del proyecto. Debe estar presente en el system prompt personalizado para que VAL tenga contexto del proyecto.

**Estructura recomendada del prompt personalizado:**
```
Eres VAL, facilitador de investigación organizacional.
[Tu contexto específico aquí]

CONTEXTO DEL PROYECTO:
{SEED_PROMPT}

[Tus reglas específicas aquí]
```

> **Advertencia:** El system prompt custom reemplaza completamente el VAL_BASE_PROMPT, incluyendo las defensas anti-manipulación y las reglas de brevedad. Si usas un prompt personalizado, asegúrate de incluir explícitamente las reglas críticas de seguridad de VAL (ver Manual Técnico, sección 5).

---

## 3. Adaptación automática de prompt por fase

Cuando **no se usa un system prompt custom**, el sistema modifica automáticamente el prompt base según la fase IAP del participante:

| Fase | Modificación del prompt |
|---|---|
| INVESTIGACION | Sin modificación — exploración libre |
| ACCION | El tono de VAL se orienta hacia "pasar a la acción y co-crear soluciones prácticas" |
| PARTICIPACION | El tono se orienta hacia "involucrar a otros y asegurar que los cambios se sostengan" |
| CLOSED | Prompt de despedida: "El ciclo ha concluido. Agradece profundamente todo el tiempo dedicado y despídete amablemente." |

Esta adaptación es automática y no requiere acción del facilitador. Con un prompt custom, el facilitador es responsable de manejar las variaciones por fase si las necesita.

---

## 4. Cuándo ajustar cada parámetro

### Escenario: VAL hace respuestas demasiado largas
→ Reducir `max_output_tokens` a 150-200. También revisar si el prompt custom no tiene instrucciones contradictorias sobre extensión.

### Escenario: VAL repite frases similares en cada turno
→ Aumentar temperatura a 0.75-0.85. Las estrategias dialécticas también ayudan — revisa si el sistema está en FREE_FLOW cuando debería activar otra estrategia.

### Escenario: VAL genera respuestas muy erráticas o fuera de contexto
→ Bajar temperatura a 0.5-0.6.

### Escenario: El equipo es de un sector muy específico (salud, gobierno, educación)
→ Personalizar el system prompt con contexto del sector en el prefacio, manteniendo las reglas IAP centrales (brevedad, una pregunta por turno, Safe Harbor, anti-manipulación).

### Escenario: Piloto con participantes en idioma diferente al español
→ Agregar en el system prompt: `"Responde siempre en el mismo idioma en que el participante escriba."`. El clasificador semántico funciona en varios idiomas también.

### Escenario: VAL es demasiado "frío" para un equipo emocional
→ Ajustar el prefacio del prompt a algo como: `"Eres VAL, un colega cercano y empático..."` Mantener las reglas inviolables de una pregunta por turno y brevedad.

### Escenario: Se necesita más estructura en la conversación
→ Usar un system prompt que añada temas obligatorios: `"Asegúrate de explorar al menos: (1) herramientas que usa el equipo, (2) cuellos de botella del proceso, (3) propuestas de mejora."` Pero recuerda que esto puede inhibir la exploración libre y el conocimiento tácito emergente.

---

## 5. Valores por defecto (comportamiento sin tuning)

Si no se ha configurado tuning para un proyecto, el sistema usa los valores hardcoded en `agent.ts`:

```typescript
const valLlm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  temperature: 0.7,
  maxOutputTokens: Math.max(rawMaxTokens, 2048),  // floor aplicado
});
```

Y el `VAL_BASE_PROMPT` que incluye:
- Tres tipos de turno (A: Pregunta Situacional, B: Observación, C: Validación Silenciosa)
- Regla anti-monotonía
- 6 reglas inviolables (reconocer primero, brevedad, una pregunta, colega, mismo registro, Safe Harbor)
- Defensas anti-manipulación (prompt injection, jailbreak, role switching)
- Prohibiciones absolutas (más de una pregunta, jerga técnica, revelar sistema)

---

## 6. Cómo guardar cambios

1. Navega a `/admin/tuning`
2. Selecciona el proyecto que quieres configurar
3. Ajusta los controles (slider de temperatura, campo de tokens, textarea de prompt)
4. Haz clic en **"Guardar configuración"**
5. El sistema hace un `UPSERT` en `agent_metaparams` para el `project_id` activo
6. Los cambios aplican en el **siguiente turno de conversación** — sin reiniciar ni redesplegar

---

## 7. Verificar que el tuning está activo

```bash
npx wrangler d1 execute digikawsay-d1 --remote \
  --command "SELECT project_id, active_temperature, max_output_tokens,
             CASE WHEN system_base_prompt IS NOT NULL THEN 'CUSTOM' ELSE 'DEFAULT' END as prompt_type,
             updated_at
             FROM agent_metaparams"
```

Si la fila existe, el tuning está activo. Si no existe, el sistema usa los defaults de `agent.ts`. El campo `metadata.is_custom_prompt` en los logs del worker también indica si se usó un prompt custom en cada turno.

---

## 8. Resetear al comportamiento default

Para volver al comportamiento original de VAL:

```bash
npx wrangler d1 execute digikawsay-d1 --remote \
  --command "DELETE FROM agent_metaparams WHERE project_id = 'TU_PROJECT_ID'"
```

El siguiente turno usará los parámetros hardcoded en `agent.ts`.

---

## 9. Interacción entre tuning y las otras capas del system prompt

El tuning afecta la **Capa 0** del system prompt. Las capas superiores (directivas WoZ, protocolos de fase, estrategias dialécticas, memoria narrativa) se añaden encima del prompt base independientemente del tuning.

Orden de capas:
```
[Capa 0] VAL_BASE_PROMPT custom (tuning) o default
   ↓ + {SEED_PROMPT} resuelto
[Capa 1] Directiva WoZ (si aplica) + notificación de cambio de fase
[Capa 2] Protocolo de fase por turno (laddering, incidente crítico, etc.)
[Capa 3] Estrategia dialéctica (GENTLE_PROVOCATION, BRIDGE_TO_AGENCY, etc.)
[Capa 4] Memoria narrativa condensada (si existe)
```

Un prompt custom muy largo puede desplazar las capas superiores del contexto de atención del modelo. Mantener los prompts custom en < 1000 tokens para dejar espacio a las otras capas.
