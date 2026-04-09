"""
AG-05 — Methodologist Agent

Analyzes conversational fragments for methodological patterns using Gemini.
Detects: collective language, power dynamics, emotional depth, Shadow IT,
knowledge silos, and recommendation loops.
"""
import os
import json
import logging
import uuid
from concurrent.futures import TimeoutError
from google.cloud import pubsub_v1
from google import genai
from datetime import datetime

# Configuration
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

ANALYSIS_PROMPT = """\
Eres un investigador metodológico experto en la IAP (Investigación Acción Participativa) de Orlando Fals Borda, analizando un proceso de transformación en un entorno corporativo digital. No eres un chatbot conversacional; eres un analista estructurado.

Tu objetivo es leer un fragmento de una interacción entre un Colaborador y un facilitador (VAL), y extraer un diagnóstico profundo de la cultura y el poder organizacional basándote en:
1. "Sentipensar": Cómo unen la racionalidad del proceso con la emoción o frustración.
2. "Paridad Relacional": Cómo perciben las jerarquías y si se asumen como sujetos transformadores o subyugados por procesos burocráticos ("los de arriba" vs "nosotros").
3. "Praxis": Si de su reflexión surge una intención de acción, o es mera resignación.
4. "Saberes (Shadow IT)": El equivalente a los saberes populares. Herramientas, atajos o dinámicas informales no documentadas que realmente sostienen la operación.

Analiza el texto y produce un JSON válido con la siguiente estructura y llaves:

{
  "fals_borda_metrics": {
    "sentipensar_score": 0,
    "praxis_indicator": "CATARSIS | REFLEXION_PASIVA | PROPUESTA_ACCION",
    "relational_parity": "SUBMISION_JERARQUICA | PARIDAD | AISLAMIENTO"
  },
  "cultural_shadows": {
    "saberes_detectados": ["lista de conocimientos no oficiales, Shadow IT o soluciones informales mencionadas"],
    "oppressive_structures": ["normas burocráticas, cuellos de botella o barreras percibidas mencionadas"]
  },
  "methodological_insight": "Una evaluación profunda (2 líneas) sobre la dinámica de poder o movilización que se lee entre líneas.",
  "recommended_woz_directive": "Recomendación para el facilitador humano para que le pida al agente VAL indagar más."
}

Fragmento a analizar:
Emoción reportada: {emotion}
Contexto: {topics}
Aporte: "{text}"

Responde SOLO con el JSON, sin markdown ni explicaciones adicionales.
"""


def init_gemini():
    global gemini_client
    if GEMINI_API_KEY:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        logger.info("Gemini client initialized for AG-05 analysis.")
    else:
        logger.warning("No GEMINI_API_KEY — AG-05 will use heuristic fallback.")


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

        # Parse JSON from response
        response_text = response.text.strip()
        # Handle markdown code blocks if present
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

        # Run analysis (Gemini or heuristic fallback)
        analysis = analyze_with_gemini(text, emotion, topics)

        # Build standard agent output
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


def main():
    init_gemini()
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
