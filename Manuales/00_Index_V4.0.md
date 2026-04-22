# Manuales DigiKawsay: Índice General (Arquitectura Híbrida v4.0)

Bienvenido a la documentación oficial de la plataforma **DigiKawsay v4.0**, la herramienta de inteligencia artificial sentipensante para diagnósticos de cultura organizacional. 

El sistema ha madurado hacia una **Arquitectura Híbrida de Microservicios**. Mantenemos la agilidad local del Borde (Cloudflare) como solución minimalista (MVP) para casos específicos, pero el motor principal y corporativo opera mediante un enjambre de agentes en **Python**, mensajería **Pub/Sub** y orquestación con **Docker Compose**. Esto otorga persistencia robusta relacional (PostgreSQL), búsqueda semántica distribuida (Weaviate) y cadenas cognitivas complejas (LangGraph).

A continuación, encontrarás los enlaces a todos los manuales necesarios para administrar y desplegar exitosamente un piloto diagnóstico a nivel corporativo:

*   **[01. Manual Conceptual y Entregables](01_Manual_Conceptual_V4.0.md)**
    *   Comprende qué es DigiKawsay funcional y filosóficamente. Entiende el paradigma Falsbordiano "sentipensante", la composición del enjambre multi-agente, la mecánica vectorial de *El Espejo* y descubre exactamente qué productos (datos, reportes y métricas Flywheel) entrega el sistema al finalizar.
*   **[02. Manual de Ejecución de Piloto](02_Manual_Ejecucion_Piloto_V4.0.md)**
    *   Guía paso a paso para planear, instrumentar y levantar un clúster local/nube. Abarca configuración de variables `.env`, orquestación con Docker Compose, establecimiento del webhook en Telegram y la creación de un nuevo proyecto desde el panel central.
*   **[03. Manual del Facilitador (Panel WoZ y Obsidian)](03_Manual_Facilitador_V4.0.md)**
    *   Documento crucial para los investigadores cualitativos. Te enseña a inyectar directivas humanas como *Wizard of Oz*, evaluar las métricas de eficacia de tú intervención y cómo observar telemetría en tiempo real mediante el Dashboard gerencial.
*   **[04. Manual Técnico y de Arquitectura](04_Manual_Tecnico_V4.0.md)**
    *   Para ingenieros de infraestructura y desarrolladores backend. Mapeo profundo de la topología Pub/Sub, esquemas de PostgreSQL, flujos en Python (AG-05, Agente00, Preprocessor) y la compatibilidad opcional transicional con Cloudflare Hono.js.
*   **[05. Guía de Experiencia y Usuario Final](05_Manual_Usuario_V4.0.md)**
    *   Para ilustrar el proceso orgánico hacia los empleados/voluntarios participantes (Gatekeeping de links, anonimización rigurosa PII-Stripper, ritmos de diálogo asíncrono y salidas éticas del sistema).
