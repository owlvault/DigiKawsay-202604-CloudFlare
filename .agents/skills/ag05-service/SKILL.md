# Skill: AG-05 Methodologist Service

## Propósito
Agente analítico que procesa fragmentos de conversación con el marco IAP de Fals Borda.
Detecta sentipensar, praxis, paridad relacional, Shadow IT y estructuras opresivas.
Recomienda directivas WoZ al facilitador basándose en el análisis.

## Archivos del servicio
```
src/ag-05-service/
├── main.py         — Pub/Sub subscriber, analyze_with_gemini(), _heuristic_fallback()
├── test_ag05.py    — Test de publicación de paquetes de prueba al emulador Pub/Sub
└── requirements.txt
```

## Cómo levantar el servicio
```bash
cd src/ag-05-service
pip install -r requirements.txt
GEMINI_API_KEY="tu_key" \
GCP_PROJECT_ID="digikawsay" \
python main.py
```

## Flujo del agente (main.py)
```
1. Escuchar topic: iap.swarm.ag05 (sub: ag05-swarm-sub)
2. Leer: participant_id, clean_text, emotion, topics del paquete
3. analyze_with_gemini() — llamada a Gemini 2.5-flash con ANALYSIS_PROMPT
   → Fallback: _heuristic_fallback() si Gemini no disponible
4. Construir agent_output con output_id, task_id, agent_id="AG-05", payload
5. insight_reducer() — publicar a iap.swarm.output
6. message.ack()
```

## Schema de Output (lo que AG-05 produce)
```json
{
  "output_id": "uuid",
  "task_id": "message_id del paquete origen",
  "agent_id": "AG-05",
  "participant_id": "telegram_user_id",
  "type": "METHODOLOGY_OBSERVATION",
  "payload": {
    "fals_borda_metrics": {
      "sentipensar_score": 0-10,
      "praxis_indicator": "CATARSIS | REFLEXION_PASIVA | PROPUESTA_ACCION",
      "relational_parity": "SUBMISION_JERARQUICA | PARIDAD | AISLAMIENTO"
    },
    "cultural_shadows": {
      "saberes_detectados": ["lista de Shadow IT y conocimiento tácito"],
      "oppressive_structures": ["cuellos de botella y barreras detectadas"]
    },
    "methodological_insight": "Evaluación 2 líneas de dinámica de poder",
    "recommended_woz_directive": "Recomendación para el facilitador"
  },
  "timestamp": "ISO8601"
}
```

## Prompt de Análisis (main.py:32 — ANALYSIS_PROMPT)
Analiza: emoción reportada, contexto (topics), texto del fragmento.
Produce JSON con la estructura de output descrita arriba.
El fallback heurístico detecta keywords: `["whatsapp", "excel", "a mano", "por fuera"]` para Shadow IT.

## Cómo conectar AG-05 a AGENTE-00 (tarea pendiente — Fase 0)
AG-05 publica a `iap.swarm.output` pero AGENTE-00 aún no consume ese topic.
Para conectarlo:
1. Añadir subscriber en `agente00-service/main.py` para `iap.swarm.output`
2. Crear tabla `swarm_insights` en `infra/migrations/001_swarm_insights.sql`
3. El subscriber guarda cada agent_output en `swarm_insights` con los campos del payload desanidados

## Cómo extender AG-05 para síntesis de corpus (tarea pendiente — Fase 0)
Actualmente AG-05 analiza fragmentos individuales (turn-by-turn).
Para síntesis de corpus añadir un endpoint HTTP (FastAPI) separado:
```
POST /analyze_corpus
Body: { project_id, fragments: [{text, emotion, topics, fals_borda_metrics}] }
Response: { temas_emergentes, distribucion_praxis, saberes_organizacionales,
            estructuras_opresivas, saturacion_estimada, preguntas_member_checking }
```

## Cómo probar AG-05
```bash
cd src/ag-05-service
python test_ag05.py  # publica un paquete de prueba al emulador Pub/Sub
```
