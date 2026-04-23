# Manuales DigiKawsay — Índice General (v4.1)

**DigiKawsay** es una plataforma de inteligencia artificial sentipensante para diagnósticos de cultura organizacional. Los participantes conversan con **VAL** —agente facilitador fundado en la Investigación Acción Participativa (IAP) de Orlando Fals Borda— a través de Telegram, mientras el sistema captura, clasifica y analiza el conocimiento tácito organizacional en tiempo real.

---

## Sistema en producción (v4.1 — Cloudflare Worker)

El sistema corre completamente sobre **Cloudflare Workers** (serverless, sin Docker, sin microservicios locales). No requiere infraestructura propia.

| Componente | Tecnología | Propósito |
|---|---|---|
| Runtime | Cloudflare Workers + Hono.js (TypeScript) | Lógica central, router HTTP, SSR |
| Base de datos | Cloudflare D1 (SQLite) | Proyectos, participantes, diálogos, directivas WoZ |
| LLM | Google Gemini 2.5-flash | VAL conversacional + clasificación semántica paralela |
| Canal | Telegram Bot API (webhook) | Conversaciones con participantes |
| Panel admin | Hono JSX (SSR) | Facilitador: WoZ, analítica, tuning, participantes |
| Autenticación | Signed cookies (SHA-256 + D1) | Protección del panel de administración |

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

---

## Notas de versión

**v4.1 — Abr 2026 (en producción):** Arquitectura Cloudflare Worker serverless. Incluye: VAL con memoria conversacional en D1, prompt IAP completo, directivas WoZ, clasificación emántica paralela vía Gemini, panel de analítica en tiempo real, tuning de parámetros por proyecto y autenticación de administradores con cookies firmadas.

**v4.0 — Abr 2026 (depreciada):** Los manuales v4.0 originales describían una arquitectura Python/Docker/Pub/Sub/Weaviate/PostgreSQL que no llegó a despliegue en producción. Esa visión arquitectónica permanece como hoja de ruta futura documentada en `Requerimientos/`.

**v3.0 — 2025 (depreciada):** MVP inicial. Archivada en la carpeta `V3.0/` de este directorio.

---

## Alcance del piloto actual (MVP v4.1)

### Funcionalidades implementadas ✅
- Conversación uno-a-uno con VAL vía Telegram (con memoria de los últimos 12 turnos)
- Clasificación semántica automática: registro emocional, indicador de praxis, Shadow IT y estructuras opresivas
- Gestión de proyectos, ciclos y participantes
- Invitaciones herméticas por token único
- Panel Wizard of Oz (WoZ): monitoreo en tiempo real + inyección de directivas
- Panel de analítica: KPIs, distribuciones emocionales, saberes detectados, estructuras opresivas
- Tuning de VAL por proyecto (temperatura, tokens, prompt base)
- Autenticación admin con sesiones seguras

### En hoja de ruta 🗓️
- El Espejo (resonancia semántica entre participantes vía embeddings)
- PII-Stripper automático (filtro de datos personales antes del LLM)
- AG-05 (análisis topológico y de redes organizacionales)
- Arquitectura distribuida con Pub/Sub y Weaviate
- Exportación de corpus analítico y Plan de Movilización JSON
