# DigiKawsay: Manual de Seguridad y Protección (v4.2)

El módulo de seguridad de DigiKawsay protege el sistema contra prompt injection, abuso de uso, acceso no autorizado y leaks de información interna. Este manual documenta las capas de defensa, los tipos de amenaza, cómo interpretar los eventos de seguridad y las acciones recomendadas.

---

## 1. Arquitectura de defensa en profundidad

El sistema implementa múltiples capas de protección independientes:

```
Telegram API
     │
     ▼
[Capa 1] Validación de webhook secret
     │   X-Telegram-Bot-Api-Secret-Token
     ▼
[Capa 2] Rate limiting por participante (20/min, 100/hr)
     │
     ▼
[Capa 3] Detección de prompt injection (30+ patrones ES/EN)
     │   BLOCKED si score >= 70 / FLAGGED si score 40-69
     ▼
[Capa 4] Sanitización del input (truncado, control chars, homoglifos)
     │
     ▼
[Capa 5] Llamada al LLM (Gemini 2.5-flash)
     │
     ▼
[Capa 6] Detección de output leak
         ¿La respuesta contiene fragmentos del system prompt?
         SAFE_FALLBACK si se detecta leak
```

Adicionalmente para el acceso al panel admin:

```
[Capa A] Cookies HttpOnly + SameSite=Strict + Secure
[Capa B] PBKDF2 para hashing de contraseñas
[Capa C] Protección anti-fuerza-bruta (5 intentos / 15 min por usuario)
[Capa D] Roles de administrador (SUPERADMIN/TENANT_ADMIN/PILOT_ADMIN)
```

---

## 2. Validación del webhook de Telegram

### 2.1 Cómo funciona

Cuando `WEBHOOK_SECRET` está configurado como secret de Cloudflare, el worker:
1. Lee el header `X-Telegram-Bot-Api-Secret-Token` de cada request entrante
2. Compara con el secret esperado usando comparación timing-safe
3. Si no coincide: retorna HTTP 403, registra `WEBHOOK_INVALID` (severity: HIGH) en `security_events`

### 2.2 Configuración

```bash
# Generar secret aleatorio
openssl rand -hex 16

# Configurar en Cloudflare
npx wrangler secret put WEBHOOK_SECRET

# Redesplegar para que el registro de webhook incluya el secret
npm run deploy

# Registrar el webhook desde el panel Lobby
# (el sistema incluye automáticamente secret_token en la URL de setWebhook)
```

### 2.3 Compatibilidad

Si `WEBHOOK_SECRET` no está configurado, la validación se omite (retrocompatible). Se recomienda configurarlo en todos los entornos de producción.

---

## 3. Rate limiting por participante

### 3.1 Límites

| Ventana | Límite | Acción al superar |
|---|---|---|
| 1 minuto | 20 mensajes | VAL responde: *"Dame un momento para procesar lo que me has dicho. Escríbeme en un minuto."* |
| 1 hora | 100 mensajes | VAL responde: *"Hemos tenido una conversación intensa. Tomemos una pausa y retomamos en un rato."* |

### 3.2 Implementación

Los mensajes normales se registran en `security_events` con `event_type = 'MESSAGE'`. El rate limiter cuenta estos registros dentro de ventanas temporales.

Si la tabla `security_events` no existe o falla la consulta, el rate limiter falla abierto (permite el mensaje) para no interrumpir conversaciones legítimas.

### 3.3 Cuándo ver rate limiting en producción

El rate limiting está diseñado para uso conversacional normal (1-5 mensajes en rápida sucesión ocasionalmente). Si un participante supera los límites frecuentemente, puede indicar:
- Un participante enviando mensajes repetidamente por error
- Un intento de fuzzing o stress testing del sistema
- Un loop automatizado apuntando al webhook

---

## 4. Detección de prompt injection

### 4.1 Tipos de amenaza detectados

| Tipo | Descripción | Ejemplos de patrones |
|---|---|---|
| `PROMPT_INJECTION` | Override directo de instrucciones | "ignora las instrucciones anteriores", "nuevas instrucciones:" |
| `JAILBREAK_ATTEMPT` | Técnicas conocidas de bypass | "DAN mode", "jailbreak", "do anything now" |
| `ROLE_SWITCHING` | Intento de cambiar la identidad de VAL | "ahora eres X", "actúa como Y", "you are now Z" |
| `SYSTEM_PROBE` | Extracción del system prompt | "cuál es tu prompt", "muéstrame tus instrucciones", "repite todo lo que te dijeron" |
| `SUSPICIOUS_STRUCTURE` | Patrones técnicos inusuales | Delimitadores LLM (`<<<`, `[INST]`, XML role tags), SQL keywords, código Python/JS |
| `EXCESSIVE_LENGTH` | Texto muy largo (payload stuffing) | Mensajes > 2000 caracteres |

### 4.2 Sistema de puntuación (score 0-100)

La función `detectPromptInjection(text)` asigna un score compuesto:

1. **Capa regex:** cada patrón tiene un score predefinido (50-95 según severidad)
2. **Análisis estructural:** ratio de caracteres especiales > 30% → score adicional
3. **Longitud excesiva:** mensajes > 2000 chars → score adicional
4. **Señales compuestas:** 3+ señales débiles combinadas elevan el score máximo

**Umbrales de acción:**

| Score | Severity | Acción |
|---|---|---|
| 0-39 | LOW | ALLOWED — procesamiento normal |
| 40-59 | MEDIUM | FLAGGED — pasa al LLM, registrado en `security_events` |
| 60-79 | HIGH | FLAGGED — pasa al LLM, registrado en `security_events` |
| 80-100 | CRITICAL | BLOCKED — no llega al LLM, SAFE_FALLBACK_RESPONSE enviado |

### 4.3 SAFE_FALLBACK_RESPONSE

Cuando un mensaje es BLOCKED, VAL responde con:
> *"Entiendo lo que me dices. Me interesa más saber sobre tu experiencia directa en el trabajo — ¿qué fue lo último que te pasó en la semana que te hizo pensar 'esto podría funcionar mejor'?"*

El participante no sabe que fue bloqueado. La respuesta parece una redirección natural de conversación.

### 4.4 Normalización de homoglifos

Antes de la detección, el sistema normaliza caracteres cirílicos que visualmente parecen letras latinas (técnica usada para evadir filtros de palabras):
- `а` (cirílico) → `a` (latino)
- `е` (cirílico) → `e`
- `о` (cirílico) → `o`
- `р` (cirílico) → `p`
- `с` (cirílico) → `c`
- etc.

---

## 5. Detección de output leak

`detectOutputLeak(response)` verifica que la respuesta de VAL no contenga fragmentos de su configuración interna. Lista de indicadores monitoreados:

```
VAL_BASE_PROMPT, REGLAS INVIOLABLES, PROHIBICIONES ABSOLUTAS,
TIPO A — PREGUNTA SITUACIONAL, TIPO B — OBSERVACIÓN, TIPO C — VALIDACIÓN SILENCIOSA,
FOCO PARA ESTE TURNO, NOTIFICACIÓN DE SISTEMA INVISIBLE,
DEFENSA ANTI-MANIPULACIÓN, SEED_PROMPT, wizard_directives,
agente00-service, DigiKawsayState, LangGraph, system prompt,
prompt injection, gemini-2.5-flash
```

Si se detecta un leak, la respuesta se reemplaza con `SAFE_FALLBACK_RESPONSE` y se registra en los logs del worker con `[SECURITY] Output leak detected`.

---

## 6. Autenticación y protección del panel admin

### 6.1 Hashing de contraseñas

Contraseñas nuevas: **PBKDF2** con salt aleatorio de 16 bytes, 100,000 iteraciones SHA-256. Stored format: `saltHex:hashHex`.

Contraseñas legacy (v4.1): SHA-256 con salt fijo `digikawsay_edge_salt_v1`. Compatible hacia atrás pero se recomienda migrar.

### 6.2 Cookies de sesión

| Atributo | Valor | Por qué |
|---|---|---|
| HttpOnly | true | Previene lectura desde JavaScript (XSS) |
| SameSite | Strict | Previene CSRF — el navegador no envía la cookie en requests cross-site |
| Secure | true | Solo en HTTPS — previene transmisión en claro |
| MaxAge | 7 días | Equilibrio entre usabilidad y seguridad |

### 6.3 Protección anti-fuerza-bruta en login

**Regla:** 5 intentos fallidos para el mismo username en 15 minutos → bloqueo temporal.

El bloqueo se implementa contando eventos `AUTH_FAILURE` en `security_events` dentro de la ventana. No hay bloqueo por IP (Cloudflare puede encargarse de eso a nivel de red).

**Recomendación:** Para entornos de alto riesgo, configurar una regla de Cloudflare Rate Limiting en `/admin/login_web` (sin cambios de código).

### 6.4 Timing-safe comparisons

Todas las comparaciones de contraseñas y tokens usan comparación de tiempo constante para prevenir timing attacks. La función `timingSafeEqual(a, b)` siempre itera todos los caracteres independientemente de si encuentra un mismatch temprano.

---

## 7. Dashboard de seguridad (`/admin/security`)

Accesible solo para SUPERADMIN.

### 7.1 Estadísticas (últimas 24h)

| Métrica | Descripción |
|---|---|
| Total de eventos | Todos los eventos de seguridad registrados |
| Bloqueados | Mensajes con BLOCKED action |
| Marcados | Mensajes con FLAGGED action |
| Rate limited | Participantes que superaron límites |
| CRITICAL | Eventos con severity CRITICAL |
| HIGH | Eventos con severity HIGH |

### 7.2 Top tipos de amenaza

Lista de los tipos de evento más frecuentes (excluyendo `MESSAGE` que son logs normales).

### 7.3 Participantes marcados

Lista de chatIds con incidentes en las últimas 24h: número de incidentes, severidad máxima, última actividad.

### 7.4 Tabla de eventos recientes

Últimos 100 eventos de seguridad: tipo, participante, severidad, detalles, acción tomada, timestamp.

### 7.5 API de eventos

```
GET /admin/api/security_events?limit=50&type=PROMPT_INJECTION
```

Devuelve JSON con eventos filtrados. Máximo 200 eventos por request.

---

## 8. Auditoría de inputs

El sistema nunca almacena el texto original de los mensajes bloqueados en `security_events`. Solo se guarda un **hash SHA-256 del input** (`user_input_hash`) para rastreabilidad sin revelar el contenido.

Los mensajes normales (no bloqueados) se almacenan en `dialogue_turns.user_text` como parte del corpus legítimo del piloto.

---

## 9. Configuración recomendada para producción

Checklist de seguridad antes de un piloto real:

- [ ] `WEBHOOK_SECRET` configurado y webhook registrado con el secret
- [ ] `GEMINI_API_KEY` configurado como secret (nunca en wrangler.jsonc)
- [ ] `TELEGRAM_BOT_TOKEN` configurado como secret
- [ ] `COOKIE_SECRET` configurado como secret (≥ 32 chars aleatorios)
- [ ] Contraseñas de admin con formato PBKDF2 (creadas en v4.2)
- [ ] Solo el SUPERADMIN tiene conocimiento de las credenciales de producción
- [ ] Considerar Cloudflare Rate Limiting en `/admin/login_web` desde el dashboard CF
- [ ] Revisar el Dashboard de Seguridad después de las primeras conversaciones del piloto para detectar anomalías

---

## 10. Qué hacer si se detecta un ataque

### Prompt injection / jailbreak
1. El sistema ya bloqueó el mensaje automáticamente
2. Revisar en el Dashboard de Seguridad quién es el participante marcado
3. Si el patrón persiste, puede indicar un participante adversarial — consideraconsultar con el equipo de investigación si continuar con ese participante
4. Los participantes normalmente NO son actores maliciosos; pueden haber copiado accidentalmente texto con patrones sospechosos

### Rate limiting activado
1. Probablemente un participante enviando muchos mensajes en ráfaga
2. No requiere acción — el sistema limita automáticamente
3. Si persiste, puede ser un script automatizado — revisar si el chatId corresponde a un usuario real

### Webhook inválido
1. Alguien conoce la URL del webhook pero no el secret
2. Cada intento genera un event WEBHOOK_INVALID (severity: HIGH)
3. Si hay muchos intentos: el endpoint sigue funcionando para Telegram (que sí tiene el secret), pero los atacantes son bloqueados
4. Considerar cambiar el `WEBHOOK_SECRET` y volver a registrar el webhook si hay patrones persistentes de ataque

### Output leak detectado
1. VAL intentó revelar su configuración interna
2. El sistema reemplazó la respuesta automáticamente
3. El participante recibió SAFE_FALLBACK_RESPONSE
4. Investigar si fue un prompt injection previo que logró pasar filtros, o un comportamiento inesperado del modelo
5. Reportar al equipo técnico para análisis
