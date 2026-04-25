---
name: phase0-task2-analyze-corpus
description: Añadir endpoint de síntesis de corpus al servicio AG-05 con FastAPI
tags: [phase0, ag05, gemini, fastapi, corpus-synthesis]
---

# Tarea: Endpoint de Síntesis de Corpus en AG-05

## Contexto
AG-05 actualmente analiza fragmentos individuales (un mensaje a la vez) mientras el piloto corre.
Para producir el entregable final del piloto, el facilitador necesita una síntesis temática
del corpus completo. Esta tarea añade un servidor HTTP a AG-05 con un endpoint de análisis batch.

## Archivos a modificar
- `src/ag-05-service/main.py` — MODIFICAR (añadir FastAPI app + endpoint /analyze_corpus)
- `src/ag-05-service/requirements.txt` — VERIFICAR (añadir fastapi, uvicorn si no están)

## Implementación

### Paso 1: Añadir FastAPI al servicio AG-05

En `src/ag-05-service/main.py`, añadir después de los imports existentes:

```python
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import threading

http_app = FastAPI(title="AG-05 Methodologist", version="1.0.0")
```

### Paso 2: Añadir modelos Pydantic

```python
class FragmentInput(BaseModel):
    participant_id: str
    text: str
    emotion: Optional[str] = ""
    topics: Optional[List[str]] = []
    sentipensar_score: Optional[float] = None
    praxis_indicator: Optional[str] = None
    relational_parity: Optional[str] = None
    saberes_detectados: Optional[List[str]] = []
    oppressive_structures: Optional[List[str]] = []

class CorpusAnalysisRequest(BaseModel):
    project_id: str
    fragments: List[FragmentInput]

class CorpusAnalysisResponse(BaseModel):
    project_id: str
    total_fragments: int
    temas_emergentes: List[dict]
    distribucion_praxis: dict
    saberes_organizacionales: List[str]
    estructuras_opresivas: List[str]
    momentum_general: float
    saturacion_estimada: str
    preguntas_member_checking: List[str]
    synthesis_text: str
```

### Paso 3: Añadir prompt de síntesis de corpus

```python
CORPUS_SYNTHESIS_PROMPT = """\
Eres AG-05, metodólogo experto en Investigación Acción Participativa (IAP).
Has recibido el corpus completo de un proceso de investigación organizacional.

Cada fragmento ha sido pre-analizado con métricas Fals Borda.
Tu tarea es sintetizar el corpus completo en un análisis temático estructurado.

CORPUS ANALIZADO ({n_fragments} fragmentos de {n_participants} participantes):
{corpus_summary}

DISTRIBUCIÓN DE INDICADORES:
- Praxis: {praxis_dist}
- Paridad Relacional: {parity_dist}
- Shadow IT detectado: {saberes_list}
- Estructuras opresivas detectadas: {structures_list}

Produce un JSON válido con esta estructura exacta:
{{
  "temas_emergentes": [
    {{
      "tema": "nombre del tema",
      "descripcion": "explicación de 1-2 oraciones",
      "frecuencia": número_de_fragmentos_relacionados,
      "ejemplos_cita": ["fragmento representativo 1", "fragmento representativo 2"],
      "nivel_confianza": "OBSERVATION | INFERENCE_1 | HYPOTHESIS"
    }}
  ],
  "distribucion_praxis": {{
    "PROPUESTA_ACCION": porcentaje,
    "REFLEXION_PASIVA": porcentaje,
    "CATARSIS": porcentaje
  }},
  "saberes_organizacionales": ["lista deduplicada de Shadow IT y saberes tácitos"],
  "estructuras_opresivas": ["lista deduplicada de barreras sistémicas"],
  "momentum_general": 0.0_a_1.0,
  "saturacion_estimada": "BAJA | MEDIA | ALTA",
  "preguntas_member_checking": [
    "Pregunta para que el equipo valide un hallazgo 1",
    "Pregunta para que el equipo valide un hallazgo 2",
    "Pregunta para que el equipo valide un hallazgo 3"
  ],
  "synthesis_text": "Párrafo narrativo de 3-5 oraciones que resume los hallazgos principales para el reporte."
}}

Responde SOLO con el JSON, sin markdown ni explicaciones.
"""
```

### Paso 4: Añadir función de síntesis

```python
def synthesize_corpus(project_id: str, fragments: List[FragmentInput]) -> dict:
    """Sintetiza el corpus completo usando Gemini."""
    if not gemini_client:
        return _heuristic_corpus_synthesis(fragments)

    # Preparar resumen del corpus
    corpus_lines = []
    for i, f in enumerate(fragments[:50], 1):  # máx 50 para no exceder contexto
        corpus_lines.append(
            f"[{i}] Participante {f.participant_id[:8]}... | "
            f"Praxis: {f.praxis_indicator or 'N/A'} | "
            f"Texto: \"{f.text[:200]}\""
        )

    # Calcular distribuciones
    praxis_counts = {"PROPUESTA_ACCION": 0, "REFLEXION_PASIVA": 0, "CATARSIS": 0}
    parity_counts = {"PARIDAD": 0, "SUBMISION_JERARQUICA": 0, "AISLAMIENTO": 0}
    all_saberes = []
    all_structures = []

    for f in fragments:
        if f.praxis_indicator and f.praxis_indicator in praxis_counts:
            praxis_counts[f.praxis_indicator] += 1
        if f.relational_parity and f.relational_parity in parity_counts:
            parity_counts[f.relational_parity] += 1
        all_saberes.extend(f.saberes_detectados or [])
        all_structures.extend(f.oppressive_structures or [])

    n = len(fragments)
    praxis_pct = {k: round((v / n) * 100, 1) if n > 0 else 0 for k, v in praxis_counts.items()}
    unique_saberes = list(dict.fromkeys(all_saberes))[:10]
    unique_structures = list(dict.fromkeys(all_structures))[:10]
    n_participants = len(set(f.participant_id for f in fragments))

    prompt = CORPUS_SYNTHESIS_PROMPT.format(
        n_fragments=n,
        n_participants=n_participants,
        corpus_summary="\n".join(corpus_lines),
        praxis_dist=str(praxis_pct),
        parity_dist=str(parity_counts),
        saberes_list=str(unique_saberes),
        structures_list=str(unique_structures),
    )

    try:
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        response_text = response.text.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        result = json.loads(response_text)
        result["total_fragments"] = n
        result["project_id"] = project_id
        return result
    except Exception as e:
        logger.error(f"Corpus synthesis failed: {e}")
        return _heuristic_corpus_synthesis(fragments)


def _heuristic_corpus_synthesis(fragments: List[FragmentInput]) -> dict:
    """Síntesis heurística básica cuando Gemini no está disponible."""
    n = len(fragments)
    praxis_counts = {"PROPUESTA_ACCION": 0, "REFLEXION_PASIVA": 0, "CATARSIS": 0}
    all_saberes = []
    all_structures = []

    for f in fragments:
        if f.praxis_indicator and f.praxis_indicator in praxis_counts:
            praxis_counts[f.praxis_indicator] += 1
        all_saberes.extend(f.saberes_detectados or [])
        all_structures.extend(f.oppressive_structures or [])

    return {
        "project_id": "",
        "total_fragments": n,
        "temas_emergentes": [{"tema": "Análisis pendiente", "descripcion": "Gemini no disponible",
                              "frecuencia": n, "ejemplos_cita": [], "nivel_confianza": "HYPOTHESIS"}],
        "distribucion_praxis": praxis_counts,
        "saberes_organizacionales": list(dict.fromkeys(all_saberes))[:10],
        "estructuras_opresivas": list(dict.fromkeys(all_structures))[:10],
        "momentum_general": 0.5,
        "saturacion_estimada": "MEDIA" if n > 20 else "BAJA",
        "preguntas_member_checking": ["¿Reconocen estos patrones en su organización?"],
        "synthesis_text": f"Análisis heurístico de {n} fragmentos. Activar Gemini para síntesis completa.",
        "_fallback": True,
    }
```

### Paso 5: Añadir endpoint HTTP

```python
@http_app.post("/analyze_corpus", response_model=CorpusAnalysisResponse)
async def analyze_corpus(request: CorpusAnalysisRequest):
    """
    Sintetiza temáticamente el corpus completo de un proyecto.
    Llama a este endpoint al cierre de cada piloto para generar el borrador del reporte.
    """
    if not request.fragments:
        raise HTTPException(status_code=400, detail="El corpus no puede estar vacío")

    logger.info(f"Iniciando síntesis de corpus para proyecto {request.project_id}: "
                f"{len(request.fragments)} fragmentos")

    result = synthesize_corpus(request.project_id, request.fragments)
    return result


@http_app.get("/health")
def health():
    return {"status": "healthy", "service": "AG-05", "gemini_ready": gemini_client is not None}
```

### Paso 6: Ejecutar FastAPI en thread separado

Al final de la función `main()`, antes del subscriber de Pub/Sub, añadir:

```python
def start_http_server():
    uvicorn.run(http_app, host="0.0.0.0", port=8005, log_level="warning")

def main():
    init_gemini()
    logger.info("Starting AG-05 HTTP server on port 8005...")
    http_thread = threading.Thread(target=start_http_server, daemon=True)
    http_thread.start()

    logger.info(f"AG-05 Methodologist active on: {subscription_path}")
    # ... resto del código existente de main() ...
```

### Paso 7: Añadir endpoint en AGENTE-00 que llama a AG-05

En `src/agente00-service/main.py`, añadir:

```python
AG05_URL = os.getenv("AG05_SERVICE_URL", "http://localhost:8005")

@app.post("/admin/analyze_corpus/{project_id}")
async def analyze_corpus_endpoint(project_id: str):
    """
    Invoca la síntesis de corpus de AG-05 para un proyecto completo.
    Llama a este endpoint para generar el borrador del reporte al cerrar un piloto.
    """
    import httpx
    try:
        # 1. Obtener todos los fragments del proyecto con sus swarm_insights
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT dt.user_text, dt.emotional_register, dt.topics,
                   si.sentipensar_score, si.praxis_indicator, si.relational_parity,
                   si.saberes_detectados, si.oppressive_structures,
                   dt.participant_id
            FROM dialogue_turns dt
            LEFT JOIN swarm_insights si ON dt.turn_id = si.turn_id AND si.agent_id = 'AG-05'
            WHERE dt.project_id = %s
            ORDER BY dt.timestamp ASC
        """, (project_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()

        if not rows:
            raise HTTPException(status_code=404, detail="No hay fragmentos para este proyecto")

        fragments = [
            {
                "participant_id": r["participant_id"],
                "text": r["user_text"] or "",
                "emotion": r["emotional_register"] or "",
                "topics": r["topics"] or [],
                "sentipensar_score": r["sentipensar_score"],
                "praxis_indicator": r["praxis_indicator"],
                "relational_parity": r["relational_parity"],
                "saberes_detectados": r["saberes_detectados"] or [],
                "oppressive_structures": r["oppressive_structures"] or [],
            }
            for r in rows
        ]

        # 2. Llamar a AG-05
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{AG05_URL}/analyze_corpus",
                json={"project_id": project_id, "fragments": fragments}
            )
            response.raise_for_status()
            return response.json()

    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"AG-05 no disponible: {e}")
    except Exception as e:
        logger.error(f"Error en analyze_corpus: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

Verificar que `httpx` esté en `src/agente00-service/requirements.txt`. Si no, añadirlo.

## Criterios de Éxito
1. `src/ag-05-service/main.py` inicia un servidor HTTP en puerto 8005 sin errores
2. `GET http://localhost:8005/health` retorna `{"status": "healthy"}`
3. `POST http://localhost:8005/analyze_corpus` con payload de prueba retorna JSON válido con todos los campos requeridos
4. `POST http://localhost:8002/admin/analyze_corpus/{project_id}` retorna la síntesis del corpus del proyecto
5. El subscriber de Pub/Sub existente en AG-05 sigue funcionando

## Cómo verificar
```bash
# 1. Levantar AG-05
cd src/ag-05-service && python main.py

# 2. Verificar health
curl http://localhost:8005/health

# 3. Probar síntesis con datos de prueba
curl -X POST http://localhost:8005/analyze_corpus \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "test",
    "fragments": [
      {"participant_id": "u1", "text": "Aquí siempre hay que preguntar al jefe para todo",
       "emotion": "Frustration", "praxis_indicator": "CATARSIS",
       "relational_parity": "SUBMISION_JERARQUICA", "saberes_detectados": [],
       "oppressive_structures": ["burocracia"]},
      {"participant_id": "u2", "text": "Podríamos usar un tablero compartido para tomar decisiones",
       "emotion": "Hope", "praxis_indicator": "PROPUESTA_ACCION",
       "relational_parity": "PARIDAD", "saberes_detectados": ["excel compartido"],
       "oppressive_structures": []}
    ]
  }'
```
