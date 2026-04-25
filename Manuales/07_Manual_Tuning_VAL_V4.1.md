# DigiKawsay: Manual de Tuning de VAL (v4.1)

El panel de **Tuning** permite ajustar el comportamiento de VAL por proyecto sin necesidad de redesplegar el worker. Los parámetros se guardan en la tabla `agent_metaparams` de D1 y se aplican en cada ciclo conversacional.

---

## 1. Acceso

```
https://TU_WORKER.workers.dev/admin/tuning
```

Requiere sesión de administrador activa. Muestra los parámetros actuales del proyecto y permite modificarlos.

---

## 2. Parámetros configurables

### 2.1 Temperatura (`active_temperature`)

**Rango:** 0.0 — 1.0  
**Default:** 0.7

Controla la variabilidad de las respuestas de VAL.

| Valor | Comportamiento | Cuándo usar |
|---|---|---|
| 0.0 – 0.3 | Respuestas muy consistentes y predecibles | Protocolos de investigación muy estructurados |
| 0.4 – 0.6 | Balance entre coherencia y variedad | Exploración temática con estructura moderada |
| **0.7** | **Valor recomendado** — creativo pero coherente | **Conversación IAP sentipensante (default)** |
| 0.8 – 1.0 | Alta variabilidad, más sorpresivo | Exploración abierta, sesiones creativas |

> **Nota:** El clasificador semántico siempre usa temperatura 0.1 independientemente de este parámetro. Solo afecta la respuesta conversacional de VAL.

### 2.2 Máximo de tokens de salida (`max_output_tokens`)

**Rango:** 50 — 1000  
**Default:** 300

Limita la extensión máxima de cada respuesta de VAL.

| Valor | Extensión aproximada | Cuándo usar |
|---|---|---|
| 50 – 100 | 1 oración muy corta | Respuestas telegráficas, silencio estratégico extremo |
| **150 – 300** | **2-3 oraciones** | **Protocolo IAP recomendado (brevedad Fals Borda)** |
| 300 – 500 | 3-5 oraciones | Cuando se requiere más desarrollo contextual |
| 500+ | Respuestas largas | No recomendado para conversación VAL — rompe el principio de brevedad |

> El protocolo sentipensante de Fals Borda establece máximo 3 oraciones por turno. Valores sobre 400 tokens tienden a violar esta regla.

### 2.3 System prompt base (`system_base_prompt`)

**Default:** El `VAL_BASE_PROMPT` codificado en `agent.ts` (prompt completo sentipensante con reglas IAP)

Permite reemplazar completamente el prompt base de VAL para un proyecto específico. Útil cuando:
- Se requiere un tono diferente para una industria específica
- Se necesita ajustar las reglas de interacción para un contexto particular
- Se quiere experimentar con variaciones del protocolo IAP

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

> **Advertencia:** Modificar el system prompt puede alterar fundamentalmente el comportamiento de VAL. Si se rompe el protocolo sentipensante (validación emocional, brevedad, una pregunta por turno), las conversaciones perderán calidad. Documenta siempre los cambios y prueba en un proyecto de staging antes de aplicar en producción.

---

## 3. Cuándo ajustar cada parámetro

### Escenario: VAL hace respuestas demasiado largas
→ Reducir `max_output_tokens` a 150-200

### Escenario: VAL repite frases similares en cada turno
→ Aumentar temperatura a 0.75-0.85

### Escenario: VAL genera respuestas muy erráticas o fuera de contexto
→ Bajar temperatura a 0.5-0.6

### Escenario: El equipo es de un sector muy específico (salud, gobierno, educación)
→ Personalizar el system prompt con contexto del sector en el prefacio, manteniendo las reglas IAP centrales

### Escenario: Piloto con participantes que hablan en un idioma diferente al español
→ Agregar en el system prompt: `"Responde siempre en el mismo idioma en que el participante escriba."`

---

## 4. Valores por defecto (comportamiento sin tuning)

Si no se ha configurado tuning para un proyecto, el sistema usa los valores hardcoded en `agent.ts`:

```typescript
const valLlm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  temperature: 0.7,
  maxOutputTokens: 300,
});
```

Y el system prompt completo `VAL_BASE_PROMPT` que incluye:
- Identidad sentipensante (Fals Borda, IAP)
- 6 reglas de interacción (validar primero, brevedad, una pregunta, paridad relacional, curiosidad genuina, silencio estratégico)
- Safe Harbor protocol
- Prohibiciones absolutas (no revelar enjambre, no jerga técnica, no más de una pregunta)

---

## 5. Cómo guardar cambios

1. Navega a `/admin/tuning`
2. Ajusta los controles (slider de temperatura, campo de tokens, textarea de prompt)
3. Haz clic en **"Guardar configuración"**
4. El sistema hace un `UPSERT` en `agent_metaparams` para el `project_id` activo
5. Los cambios aplican en el **siguiente turno de conversación** — no hay necesidad de reiniciar ni redesplegar

---

## 6. Verificar que el tuning está activo

Para confirmar que los parámetros de tuning se están aplicando:

```powershell
$WORKER = "https://TU_WORKER.workers.dev"
$PROJECT = "TU_PROJECT_ID"

# Verificar que la fila existe en agent_metaparams
# (solo via wrangler D1, no hay endpoint público de consulta)
npx wrangler d1 execute digikawsay-d1 --remote `
  --command "SELECT * FROM agent_metaparams WHERE project_id = '$PROJECT'"
```

Si la fila existe, el tuning está activo. Si no existe, el sistema usa los defaults de `agent.ts`.

---

## 7. Resetear al comportamiento default

Para volver al comportamiento original de VAL, elimina la fila de tuning:

```bash
npx wrangler d1 execute digikawsay-d1 --remote \
  --command "DELETE FROM agent_metaparams WHERE project_id = 'TU_PROJECT_ID'"
```

El siguiente turno usará los parámetros hardcoded en `agent.ts`.
