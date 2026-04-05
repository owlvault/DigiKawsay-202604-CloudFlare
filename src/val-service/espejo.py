"""
El Espejo (The Mirror) — DigiKawsay Semantic Convergence Engine

Uses cosine similarity over Weaviate vector store to find:
- Convergences: perspectives semantically similar to the participant's
- Divergences: perspectives semantically distant (complementary viewpoints)

This is the core algorithmic differentiator of DigiKawsay.
"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

WEAVIATE_URL = os.getenv("WEAVIATE_URL", "http://localhost:8080")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

_weaviate_client = None
_gemini_client = None


def _get_weaviate():
    global _weaviate_client
    if _weaviate_client is None:
        try:
            import weaviate
            _weaviate_client = weaviate.connect_to_custom(
                http_host=WEAVIATE_URL.replace("http://", "").split(":")[0],
                http_port=int(WEAVIATE_URL.split(":")[-1]) if ":" in WEAVIATE_URL.split("//")[-1] else 8080,
                http_secure=False,
                grpc_host=WEAVIATE_URL.replace("http://", "").split(":")[0],
                grpc_port=50051,
                grpc_secure=False,
            )
        except Exception as e:
            logger.error(f"Weaviate connection failed: {e}")
    return _weaviate_client


def _get_gemini():
    global _gemini_client
    if _gemini_client is None and GEMINI_API_KEY:
        from google import genai
        _gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    return _gemini_client


def _embed(text: str) -> Optional[list[float]]:
    """Generate embedding for a text."""
    client = _get_gemini()
    if not client:
        return None
    try:
        result = client.models.embed_content(
            model="text-embedding-004",
            contents=text,
        )
        return list(result.embeddings[0].values)
    except Exception as e:
        logger.error(f"Embedding failed: {e}")
        return None


def get_espejo(participant_id: str, project_id: str,
               latest_text: str, n_convergences: int = 2,
               n_divergences: int = 1) -> dict:
    """
    Run the Mirror algorithm for a participant.
    
    Returns a dict with convergences and divergences — anonymous perspectives
    from other participants that are semantically similar/distant.
    
    Args:
        participant_id: The current participant's ID (excluded from results)
        project_id: Filter results to this project
        latest_text: The participant's latest contribution (to compute similarity)
        n_convergences: Number of similar perspectives to return
        n_divergences: Number of contrasting perspectives to return
    
    Returns:
        {
            "convergences": [{"text": "...", "distance": 0.12}, ...],
            "divergences": [{"text": "...", "distance": 0.87}, ...],
            "total_fragments": N,
            "sufficient_data": bool
        }
    """
    weaviate = _get_weaviate()
    if not weaviate:
        return {"convergences": [], "divergences": [], "total_fragments": 0,
                "sufficient_data": False, "error": "Weaviate not available"}

    # Generate embedding for the query text
    query_vector = _embed(latest_text)
    if not query_vector:
        return {"convergences": [], "divergences": [], "total_fragments": 0,
                "sufficient_data": False, "error": "Embedding generation failed"}

    try:
        from weaviate.classes.query import MetadataQuery, Filter

        collection = weaviate.collections.get("RawFragment")

        # Count total fragments in this project (excluding current participant)
        # We need at least 3 other people's contributions for meaningful results
        count_result = collection.aggregate.over_all(
            filters=(
                Filter.by_property("project_id").equal(project_id) &
                Filter.by_property("participant_id").not_equal(participant_id)
            ),
            total_count=True,
        )
        total_fragments = count_result.total_count or 0

        if total_fragments < 3:
            return {
                "convergences": [], "divergences": [],
                "total_fragments": total_fragments,
                "sufficient_data": False,
                "message": f"Se necesitan al menos 3 aportes de otros participantes. Actualmente hay {total_fragments}."
            }

        # --- CONVERGENCES: nearest neighbors ---
        near_results = collection.query.near_vector(
            near_vector=query_vector,
            limit=n_convergences + 5,  # over-fetch to filter out self
            filters=(
                Filter.by_property("project_id").equal(project_id) &
                Filter.by_property("participant_id").not_equal(participant_id)
            ),
            return_metadata=MetadataQuery(distance=True),
        )

        convergences = []
        seen_participants = set()
        for obj in near_results.objects:
            pid = obj.properties.get("participant_id", "")
            if pid != participant_id and pid not in seen_participants:
                convergences.append({
                    "text": obj.properties.get("text", ""),
                    "distance": round(obj.metadata.distance, 4) if obj.metadata.distance else None,
                    "anonymous_id": f"Participante #{hash(pid) % 100:02d}",
                })
                seen_participants.add(pid)
                if len(convergences) >= n_convergences:
                    break

        # --- DIVERGENCES: farthest neighbors ---
        # Weaviate doesn't have native "farthest" query, so we fetch more and sort
        far_results = collection.query.near_vector(
            near_vector=query_vector,
            limit=50,  # fetch many, sort descending
            filters=(
                Filter.by_property("project_id").equal(project_id) &
                Filter.by_property("participant_id").not_equal(participant_id)
            ),
            return_metadata=MetadataQuery(distance=True),
        )

        # Sort by distance descending (most distant = most divergent)
        all_objs = sorted(far_results.objects,
                         key=lambda o: o.metadata.distance if o.metadata.distance else 0,
                         reverse=True)

        divergences = []
        div_seen = set()
        for obj in all_objs:
            pid = obj.properties.get("participant_id", "")
            if pid != participant_id and pid not in div_seen and pid not in seen_participants:
                divergences.append({
                    "text": obj.properties.get("text", ""),
                    "distance": round(obj.metadata.distance, 4) if obj.metadata.distance else None,
                    "anonymous_id": f"Participante #{hash(pid) % 100:02d}",
                })
                div_seen.add(pid)
                if len(divergences) >= n_divergences:
                    break

        return {
            "convergences": convergences,
            "divergences": divergences,
            "total_fragments": total_fragments,
            "sufficient_data": True,
        }

    except Exception as e:
        logger.error(f"Espejo query failed: {e}")
        return {"convergences": [], "divergences": [], "total_fragments": 0,
                "sufficient_data": False, "error": str(e)}


def format_espejo_for_val(espejo_result: dict) -> str:
    """
    Format Espejo results as natural language for VAL to share with the participant.
    """
    if not espejo_result.get("sufficient_data"):
        return ""

    convergences = espejo_result.get("convergences", [])
    divergences = espejo_result.get("divergences", [])

    if not convergences and not divergences:
        return ""

    parts = []
    parts.append("🪞 *El Ecosistema de Ideas*\n")

    if convergences:
        parts.append("💚 *Perspectivas que resuenan con la tuya:*")
        for c in convergences:
            parts.append(f"  _{c['anonymous_id']}_ dice: \"{c['text'][:150]}...\"")

    if divergences:
        parts.append("\n🔶 *Una mirada complementaria:*")
        for d in divergences:
            parts.append(f"  _{d['anonymous_id']}_ comparte: \"{d['text'][:150]}...\"")

    parts.append(
        "\n_Estas perspectivas anónimas buscan ampliar tu reflexión. "
        "¿Alguna te sorprende o te provoca una nueva idea?_"
    )

    return "\n".join(parts)
