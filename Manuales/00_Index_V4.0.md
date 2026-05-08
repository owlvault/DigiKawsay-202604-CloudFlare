# Manuales DigiKawsay — Índice General (v4.2)

**DigiKawsay** es una plataforma de inteligencia artificial sentipensante para diagnósticos de cultura organizacional. Los participantes conversan con **VAL** —agente facilitador fundado en la Investigación Acción Participativa (IAP) de Orlando Fals Borda— a través de Telegram, mientras el sistema captura, clasifica y analiza el conocimiento tácito organizacional en tiempo real.

---

## Sistema en producción (v4.2 — Cloudflare Worker)

El sistema corre completamente sobre **Cloudflare Workers** (serverless, sin Docker, sin microservicios locales). No requiere infraestructura propia.

| Componente | Tecnología | Propósito |
|---|---|---|
| Runtime | Cloudflare Workers + Hono.js (TypeScript) | Lógica central, router HTTP, SSR |
| Base de datos | Cloudflare D1 (SQLite) | Proyectos, participantes, diálogos, directivas WoZ, memoria narrativa, seguridad, billing |
| LLM | Google Gemini 2.5-flash | VAL conversacional + clasificación semántica + resúmenes narrativos + AG-05 Co-piloto |
| Canal | Telegram Bot API (webhook) | Conversaciones con participantes |
| Panel admin | Hono JSX (SSR) | Facilitador: WoZ, analítica, tuning, participantes, seguridad, billing |
| Autenticación | PBKDF2 + signed cookies (HMAC + D1) | Protección del panel con roles y protección anti-fuerza-bruta |
| Multi-tenant | Tabla `tenants` + roles de admin | Aislamiento de proyectos por organización |

**URL del worker:** `https://worker-digikawsay.camilo-carvajalino.workers.dev`

---

## Manuales disponibles

| # | Manual | Audiencia principal |
|---|--------|---------------------|
| [01](01_Manual_Conceptual_V4.0.md) | Manual Conceptual y Entregables | Todos los roles |
| [02](02_Manual_Ejecucion_Piloto_V4.0.md) | Manual de Ejecución de Piloto | Facilitador técnico |
| [03](03_Manual_Facilitador_V4.0.md) | Manual del Facilitador (Panel Admin y WoZ) | Investigador cualitativo |
| [04](04_Manual_Tecnico_V4.0.md) | Manual Técnico y de Arquitectura | Desarrollador / DevOps |
| [05](05_Manual_Usuario_V4.0.md) | Guía de Experiencia del Usuario | Participante |
| [06](06_Manual_Autenticacion_V4.1.md) | Manual de Autenticación de Administradores | Administrador |
| [07](07_Manual_Tuning_VAL_V4.1.md) | Manual de Tuning de VAL | Facilitador técnico |
| [08](08_Manual_Seguridad_V4.2.md) | Manual de Seguridad y Protección | Desarrollador / SUPERADMIN |
| [09](09_Manual_Billing_MultiTenant_V4.2.md) | Manual de Billing y Multi-Tenant | SUPERADMIN / Administrador de cuenta |

---

## Notas de versión

**v4.2 — May 2026 (en producción):** Arquitectura multi-tenant con roles de admin (SUPERADMIN, TENANT_ADMIN, PILOT_ADMIN). Módulo de seguridad completo: detección de prompt injection, rate limiting por participante, protección anti-fuerza-bruta en login, validación de webhook, detección de leaks de output y dashboard de eventos de seguridad. Memoria narrativa por participante (resúmenes cada 4 turnos, compresión semántica). AG-05 Co-piloto: generación automática de directivas de profundización cuando VAL detecta estancamiento. Protocolos de fase por turno (laddering, incidente crítico, shadow mapping, co-diseño, cierre IAP). Siete estrategias dialécticas adaptativas. Espejo Ligero implementado. Billing y control de cuotas por tenant y proyecto. Exportación CSV del corpus. Informe de síntesis en streaming (AG-05 metodólogo). Asistente IA para diseño de pilotos. PBKDF2 para hashing de contraseñas (upgrade desde SHA-256).

**v4.1 — Abr 2026 (depreciada):** Arquitectura Cloudflare Worker serverless. Incluye: VAL con memoria conversacional en D1, prompt IAP completo, directivas WoZ, clasificación semántica paralela vía Gemini, panel de analítica en tiempo real, tuning de parámetros por proyecto y autenticación de administradores con cookies firmadas.

**v4.0 — Abr 2026 (depreciada):** Los manuales v4.0 originales describían una arquitectura Python/Docker/Pub/Sub/Weaviate/PostgreSQL que no llegó a despliegue en producción. Esa visión arquitectónica permanece como hoja de ruta futura documentada en `Requerimientos/`.

**v3.0 — 2025 (depreciada):** MVP inicial. Archivada en la carpeta `V3.0/` de este directorio.

---

## Alcance del piloto actual (MVP v4.2)

### Funcionalidades implementadas ✅
- Conversación uno-a-uno con VAL vía Telegram (con memoria de los últimos 12 turnos o memoria narrativa condensada)
- Clasificación semántica automática: registro emocional, indicador de praxis, Shadow IT, estructuras opresivas y **depth score** (0-100)
- **Memoria narrativa por participante**: resumen condensado cada 4 turnos, temas explorados/pendientes, tendencia de profundidad
- **Siete estrategias dialécticas adaptativas**: GENTLE_PROVOCATION, BRIDGE_TO_AGENCY, NORMALIZE_PATTERN, DEEPENING_LADDERING, SAFE_HARBOR, ESPEJO_LIGERO, FREE_FLOW
- **Protocolos de fase por turno**: laddering, incidente crítico, Espejo Ligero, checkpoint, shadow mapping, provocación, co-diseño, priorización, agencia, cierre IAP
- **Progresión automática de fases**: INVESTIGACION → ACCION → PARTICIPACION → CLOSED basada en phase_progress
- Gestión de proyectos, ciclos y participantes
- Invitaciones herméticas por token único
- Panel Wizard of Oz (WoZ): monitoreo en tiempo real + inyección de directivas humanas + **AG-05 Co-piloto** (directivas automáticas)
- **Push proactivo**: el facilitador puede enviar un mensaje a un participante inactivo desde el panel WoZ
- Panel de analítica: KPIs, distribuciones emocionales, saberes detectados, estructuras opresivas, alertas automáticas, **resumen ejecutivo automático**
- Tuning de VAL por proyecto (temperatura, tokens, prompt base)
- Autenticación admin con sesiones seguras (PBKDF2, cookie firmada SameSite=Strict)
- **Roles de administrador**: SUPERADMIN, TENANT_ADMIN, PILOT_ADMIN
- **Multi-tenant**: aislamiento completo de proyectos y participantes por organización
- **Módulo de seguridad**: detección de prompt injection, rate limiting, brute force, output leak detection
- **Dashboard de seguridad** (SUPERADMIN): eventos en tiempo real, amenazas bloqueadas, participantes marcados
- **Billing y cuotas**: control de tokens por tenant y por proyecto, cutoff automático
- **Exportación CSV** del corpus completo de un proyecto
- **Informe de síntesis** (Markdown streaming) generado por AG-05 metodólogo
- **Diseño de piloto asistido por IA**: genera mensaje de contextualización + seed prompt a partir del contexto del equipo

### En hoja de ruta 🗓️
- El Espejo completo (resonancia semántica entre participantes vía embeddings Weaviate)
- PII-Stripper automático (filtro de datos personales antes del LLM)
- AG-05 Metodólogo completo (Grounded Theory automatizada, Saturation Index calculado por agente)
- Análisis topológico (TDA) y de redes sociales (SNA/ONA)
- Directivas automáticas del enjambre completo (AGENTE-00 con Pub/Sub)
- Plan de Movilización JSON (OKRs + redes de compromiso Dunham)
- Arquitectura distribuida con Pub/Sub y Weaviate
