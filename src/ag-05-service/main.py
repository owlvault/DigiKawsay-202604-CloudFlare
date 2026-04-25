"""
AG-05 — Methodologist Agent

Analyzes conversational fragments for methodological patterns using Gemini.
Detects: collective language, power dynamics, emotional depth, Shadow IT,
knowledge silos, and recommendation loops.

Expone también un servidor HTTP en el puerto 8005 con el endpoint
POST /analyze_corpus para síntesis temática del corpus completo al cierre del piloto.
"""
import os
import json
import logging
import uuid
import threading
from concurrent.futures import TimeoutError
from typing import List, Optional

from google.cloud import pubsub_v1
from google import genai
from datetime import datetime

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

# ============================================================
# Configuración
# ============================================================
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "digikawsay")
SUBSCRIPTION_NAME = os.getenv("PUBSUB_AG05_INBOUND_SUB", "ag05-swarm-sub")
OUTBOUND_TOPIC = os.getenv("PUBSUB_SWARM_OUTPUT_TOPIC", "iap.swarm.output")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AG-05-Methodologist")

subscriber = pubsub_v1.SubscriberClient()
subscription_path = subscriber.subscription_path(PROJECT_ID, SUBSCRIPTION_NAME)
publisher = pubsub_v1.PublisherClient()

gemini_client = None

# ============================================================
# FastAPI — servidor HTTP para síntesis de corpus
# ============================================================
http_app = FastAPI(title="AG-05 Methodologist", version="1.0.0")


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


# ============================================================
# Prompts de Gemini
# ============================================================
ANALYSIS_PROMPT = """\
Eres un investigador metodológico experto en la IAP (Investigación Acción Participativa) de Orlando Fals Borda, analizando un proceso de transformación en un entorno corporativo digital. No eres un chatbot conversacional; eres un analista estructurado.

Tu objetivo es leer un fragmento de una interacción entre un Colaborador y un facilitador (VAL), y extraer un diagnóstico profundo de la cultura y el poder organizacional basándote en:
1. "Sentipensar": Cómo unen la racionalidad del proceso con la emoción o frustración.
2. "Paridad Relacional": Cómo perciben las jerarquías y si se asumen como sujetos transformadores o subyugados por procesos burocráticos ("los de arriba" vs "nosotros").
3. "Praxis": Si de su reflexión surge una intención de acción, o es mera resignación.
4. "Saberes (Shadow IT)": El equivalente a los saberes populares. Herramientas, atajos o dinámicas informales no documentadas que realmente sostienen la operación.

Analiza el texto y produce un JSON válido con la siguiente estructura y llaves:

{{
  "fals_borda_metrics": {{
    "sentipensar_score": 0,
    "praxis_indicator": "CATARSIS | REFLEXION_PASIVA | PROPUESTA_ACCION",
    "relational_parity": "SUBMISION_JERARQUICA | PARIDAD | AISLAMIENTO"
  }},
  "cultural_shadows": {{
    "saberes_detectados": ["lista de conocimientos no oficiales, Shadow IT o soluciones informales mencionadas"],
    "oppressive_structures": ["normas burocráticas, cuellos de botella o barreras percibidas mencionadas"]
  }},
  "methodological_insight": "Una evaluación profunda (2 líneas) sobre la dinámica de poder o movilización que se lee entre líneas.",
  "recommended_woz_directive": "Recomendación para el facilitador humano para que le pida al agente VAL indagar más."
}}

Fragmento a analizar:
Emoción reportada: {emotion}
Contexto: {topics}
Aporte: "{text}"

Responde SOLO con el JSON, sin markdown ni explicaciones adicionales.
"""

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
      "frecuencia": numero_de_fragmentos_relacionados,
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


# ============================================================
# Gemini — inicialización
# ============================================================
def init_gemini():
    global gemini_client
    if GEMINI_API_KEY:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        logger.info("Gemini client initialized for AG-05 analysis.")
    else:
        logger.warning("No GEMINI_API_KEY — AG-05 will use heuristic fallback.")


# ============================================================
# Análisis de fragmento individual (Pub/Sub)
# ============================================================
def analyze_with_gemini(text: str, emotion: str, topics: list) -> dict:
    """Use Gemini to perform real methodological analysis."""
    if not gemini_client:
        return _heuristic_fallback(text)

    try:
        prompt = ANALYSIS_PROMPT.format(
            text=text,
            emotion=emotion or "No detectada",
            topics=", ".join(topics) if topics else "Ninguno"
        )

        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )

        response_text = response.text.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        analysis = json.loads(response_text)
        logger.info(f"AG-05 Gemini analysis: {analysis.get('insight', '')[:80]}...")
        return analysis

    except Exception as e:
        logger.error(f"Gemini analysis failed: {e}")
        return _heuristic_fallback(text)


def _heuristic_fallback(text: str) -> dict:
    """Fallback heuristic analysis when Gemini is unavailable."""
    text_lower = text.lower()

    action_words = ["deberíamos", "propongo", "cambiar", "podemos", "hagamos"]
    shadow_words = ["whatsapp", "excel", "a mano", "por fuera", "pregúntale a"]
    submissive_words = ["el jefe", "recursos humanos", "los de arriba", "ellos mandan", "no podemos"]

    is_action = any(kw in text_lower for kw in action_words)
    has_shadow = [kw for kw in shadow_words if kw in text_lower]
    is_submissive = any(kw in text_lower for kw in submissive_words)

    return {
        "fals_borda_metrics": {
            "sentipensar_score": 5,
            "praxis_indicator": "PROPUESTA_ACCION" if is_action else "CATARSIS",
            "relational_parity": "SUBMISION_JERARQUICA" if is_submissive else "PARIDAD"
        },
        "cultural_shadows": {
            "saberes_detectados": has_shadow,
            "oppressive_structures": ["Bloqueo burocrático (heurística)"] if is_submissive else []
        },
        "methodological_insight": "Análisis heurístico (Gemini no disponible). "
                   + ("Fuerte indicio de sumisión jerárquica." if is_submissive else "Dinámica relacional estándar."),
        "recommended_woz_directive": "Pregunta cómo podrían organizar mejor esa idea sin depender de jerarquías tradicionales.",
        "_fallback": True,
    }


def insight_reducer(agent_output: dict):
    """Publish processed insight to the swarm output topic."""
    try:
        publisher.publish(
            publisher.topic_path(PROJECT_ID, OUTBOUND_TOPIC),
            json.dumps(agent_output).encode("utf-8")
        )
        logger.info(f"Insight published to {OUTBOUND_TOPIC}")
    except Exception as e:
        logger.error(f"Failed publishing insight: {e}")


def process_task_envelope(message: pubsub_v1.subscriber.message.Message):
    """Process a task from AG-00 and produce a methodological observation."""
    try:
        packet = json.loads(message.data.decode("utf-8"))
        participant_id = packet.get("participant_id")
        text = packet.get("clean_text", packet.get("original_text", ""))
        emotion = packet.get("emotion", "")
        topics = packet.get("topics", [])

        logger.info(f"AG-05 analyzing message from {participant_id}")

        analysis = analyze_with_gemini(text, emotion, topics)

        agent_output = {
            "output_id": str(uuid.uuid4()),
            "task_id": packet.get("message_id", "unknown_task"),
            "agent_id": "AG-05",
            "participant_id": participant_id,
            "type": "METHODOLOGY_OBSERVATION",
            "payload": analysis,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }

        insight_reducer(agent_output)
        message.ack()

    except Exception as e:
        logger.error(f"AG-05 processing failed: {e}")
        message.nack()


# ============================================================
# Síntesis de corpus completo (HTTP)
# ============================================================
def synthesize_corpus(project_id: str, fragments: List[FragmentInput]) -> dict:
    """Sintetiza el corpus completo usando Gemini."""
    if not gemini_client:
        return _heuristic_corpus_synthesis(fragments)

    # Preparar resumen del corpus (máx 50 para no exceder contexto)
    corpus_lines = []
    for i, f in enumerate(fragments[:50], 1):
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


# ============================================================
# Endpoints HTTP
# ============================================================
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


# ============================================================
# Entrypoint
# ============================================================
def start_http_server():
    """Corre el servidor FastAPI en un thread daemon separado."""
    uvicorn.run(http_app, host="0.0.0.0", port=8005, log_level="warning")


def main():
    init_gemini()

    logger.info("Starting AG-05 HTTP server on port 8005...")
    http_thread = threading.Thread(target=start_http_server, daemon=True)
    http_thread.start()

    logger.info(f"AG-05 Methodologist active on: {subscription_path}")
    streaming_pull_future = subscriber.subscribe(subscription_path, callback=process_task_envelope)

    with subscriber:
        try:
            streaming_pull_future.result()
        except TimeoutError:
            streaming_pull_future.cancel()
            streaming_pull_future.result()
        except Exception as e:
            logger.error(f"AG-05 Subscriber failed: {e}")
            streaming_pull_future.cancel()


if __name__ == "__main__":
    main()
