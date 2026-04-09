# DigiKawsay: Manual Conceptual

## 1. ¿Qué es DigiKawsay?

DigiKawsay es una plataforma de **inteligencia artificial sentipensante** diseñada para realizar diagnósticos y descubrimientos dentro de la cultura organizacional. A diferencia de las encuestas tradicionales, DigiKawsay no hace preguntas de opción múltiple; en su lugar, utiliza un **ecosistema de agentes de IA (Swarm)** para mantener conversaciones profundas, asíncronas y uno-a-uno con los miembros de un equipo a través de canales cotidianos como Telegram. 

El objetivo es extraer el conocimiento tácito, la cultura real ("Shadow IT", "Tribal Knowledge") y el clima emocional de la organización mediante la escucha activa y la consolidación cruzada de perspectivas.

## 2. Paradigma Sentipensante

El núcleo de DigiKawsay se basa en la metodología Falsbordiana (IAP - Investigación Acción Participativa). El bot conversacional principal, **VAL**, está diseñado para **sentir y pensar** con el usuario:
- **Validación emocional:** Antes de indagar, VAL valora lo que el participante comparte.
- **Paridad relacional:** VAL asume el rol de un compañero de reflexión, no de un auditor.
- **Sin respuestas correctas:** Promueve un espacio psicológicamente seguro ("Safe Harbor").

## 3. ¿Cómo Funciona la Arquitectura Multi-Agente?

La magia de DigiKawsay reside en que "el bot" con el que habla el usuario es solo la punta del iceberg. Detrás hay un enjambre de especialistas:

1. **La Interfaz (Channel Layer):** Telegram, donde ocurre la conversación.
2. **El Observador Inmediato (VAL):** El bot empático que habla con la persona. Valida, acompaña y registra emociones.
3. **El Analista del Enjambre (AG-05 - Metodólogo):** Analiza en tiempo real patrones de poder, colectivismo e informalidad en las respuestas generales.
4. **El Director (AG-00 - Supervisor):** Consolida la información, vela por el progreso del piloto y sirve de puente para el "Facilitador Humano".

### "El Espejo": El Algoritmo Diferenciador
DigiKawsay utiliza una base de datos vectorial (Weaviate) para mapear semánticamente todo lo que dicen los participantes. **Cada 3 turnos de conversación**, el sistema activa "El Espejo". Busca en toda la base de datos aportes anónimos de otros participantes y le devuelve a la persona:
- **Convergencias:** "Alguien más en la organización siente algo parecido: [texto]"
- **Divergencias:** "Por otro lado, alguien tiene una vista complementaria: [texto]"

Esto genera consciencia colectiva sin romper el anonimato.

## 4. Productos y Entregables de un Piloto Completado

Cuando un ciclo de DigiKawsay termina, la organización no se lleva un "puntaje de clima", sino hallazgos estructurales profundos. El sistema entrega:

1. **Dashboard de Resonancia:** Un reporte cuantitativo (Tasas de participación, turnos por persona) y cualitativo (temas más hablados, registro emocional dominante).
2. **Mapa Topológico de Cultura:** Identificación de "Silos de conocimiento" y "Bypass de procesos" detectados por el Agente 05.
3. **Transcripciones Anonimizadas:** Base de datos estructurada con el análisis de "Actos de Habla" por turno.
4. **Data Gaps y Probes:** Conocimiento que el enjambre identificó como "faltante" pero vital.

---
*Fin del Manual Conceptual.*
