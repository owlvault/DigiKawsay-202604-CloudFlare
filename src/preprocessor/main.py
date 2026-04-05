import os
import json
import logging
import time
from concurrent.futures import TimeoutError
from google.cloud import pubsub_v1
from google import genai

# Configuration
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "digikawsay")
SUBSCRIPTION_NAME = os.getenv("PUBSUB_INBOUND_SUBSCRIPTION", "preprocessor-inbound-sub")
OUTBOUND_TOPIC = os.getenv("PUBSUB_PACKET_TOPIC", "iap.val.packet")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
WEAVIATE_URL = os.getenv("WEAVIATE_URL", "http://localhost:8080")
EMBEDDING_MODEL = "text-embedding-004"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

subscriber = pubsub_v1.SubscriberClient()
subscription_path = subscriber.subscription_path(PROJECT_ID, SUBSCRIPTION_NAME)

publisher = pubsub_v1.PublisherClient()
outbound_topic_path = publisher.topic_path(PROJECT_ID, OUTBOUND_TOPIC)

# Initialize Gemini client for embeddings
gemini_client = None
weaviate_client = None


def init_gemini():
    """Initialize Gemini client for embeddings."""
    global gemini_client
    if GEMINI_API_KEY:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        logger.info("Gemini client initialized for embeddings.")
    else:
        logger.warning("No GEMINI_API_KEY set — embeddings will be zero vectors.")


def init_weaviate():
    """Initialize Weaviate client and create collection if needed."""
    global weaviate_client
    try:
        import weaviate
        from weaviate.classes.config import Configure, Property, DataType

        weaviate_client = weaviate.connect_to_custom(
            http_host=WEAVIATE_URL.replace("http://", "").split(":")[0],
            http_port=int(WEAVIATE_URL.split(":")[-1]) if ":" in WEAVIATE_URL.split("//")[-1] else 8080,
            http_secure=False,
            grpc_host=WEAVIATE_URL.replace("http://", "").split(":")[0],
            grpc_port=50051,
            grpc_secure=False,
        )

        # Create collection if it doesn't exist
        if not weaviate_client.collections.exists("RawFragment"):
            weaviate_client.collections.create(
                name="RawFragment",
                vectorizer_config=Configure.Vectorizer.none(),
                properties=[
                    Property(name="participant_id", data_type=DataType.TEXT),
                    Property(name="project_id", data_type=DataType.TEXT),
                    Property(name="text", data_type=DataType.TEXT),
                    Property(name="message_id", data_type=DataType.TEXT),
                    Property(name="timestamp", data_type=DataType.TEXT),
                ]
            )
            logger.info("Weaviate 'RawFragment' collection created.")
        else:
            logger.info("Weaviate 'RawFragment' collection already exists.")

    except Exception as e:
        logger.error(f"Weaviate initialization failed: {e}")
        weaviate_client = None


def anonymize_text(text: str) -> str:
    """
    Basic PII anonymization.
    Replaces common patterns: emails, phone numbers, IDs.
    """
    import re
    # Email
    text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]', text)
    # Phone numbers (Colombian format and international)
    text = re.sub(r'\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b', '[PHONE]', text)
    # CC/NIT numbers (Colombian ID patterns)
    text = re.sub(r'\b\d{6,12}\b', lambda m: '[ID]' if len(m.group()) >= 8 else m.group(), text)
    return text


def embed_text(text: str) -> list[float]:
    """
    Generate real embeddings using Gemini text-embedding-004.
    Falls back to zero vector if API is unavailable.
    """
    if gemini_client is None:
        return [0.0] * 768

    try:
        result = gemini_client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=text,
        )
        vector = result.embeddings[0].values
        logger.info(f"Embedding generated: dim={len(vector)}, norm={sum(v**2 for v in vector[:5]):.4f}...")
        return list(vector)
    except Exception as e:
        logger.error(f"Embedding generation failed: {e}")
        return [0.0] * 768


def store_in_weaviate(participant_id: str, project_id: str, text: str,
                      message_id: str, timestamp: str, vector: list[float]):
    """Store a vectorized fragment in Weaviate."""
    if weaviate_client is None:
        logger.warning("Weaviate not available — skipping storage.")
        return None

    try:
        collection = weaviate_client.collections.get("RawFragment")
        obj_uuid = collection.data.insert(
            properties={
                "participant_id": participant_id,
                "project_id": project_id,
                "text": text,
                "message_id": message_id,
                "timestamp": timestamp or "",
            },
            vector=vector,
        )
        logger.info(f"Stored in Weaviate: {obj_uuid}")
        return str(obj_uuid)
    except Exception as e:
        logger.error(f"Weaviate storage failed: {e}")
        return None


def process_message(message: pubsub_v1.subscriber.message.Message):
    """Process an inbound message: anonymize, embed, store, and forward to VAL."""
    try:
        payload = json.loads(message.data.decode("utf-8"))
        participant_id = payload.get("participant_id", "unknown")
        project_id = payload.get("project_id", "")
        raw_text = payload.get("text", "")
        message_id = payload.get("message_id", "unknown")
        timestamp = payload.get("timestamp", "")

        logger.info(f"Processing message from {participant_id}")

        # 1. Anonymize PII
        clean_text = anonymize_text(raw_text)

        # 2. Generate embeddings
        vector = embed_text(clean_text)

        # 3. Store in Weaviate
        chunk_id = store_in_weaviate(participant_id, project_id, clean_text,
                                       message_id, timestamp, vector)

        # 4. Build DIALOGUE_PACKET
        dialogue_packet = {
            "participant_id": participant_id,
            "project_id": project_id,
            "session_id": f"session_{project_id[:8]}" if project_id else "session_mvp",
            "message_id": message_id,
            "original_text": raw_text,
            "clean_text": clean_text,
            "chunk_id": chunk_id or f"chunk_{message_id}",
            "has_embedding": any(v != 0.0 for v in vector[:10]),
            "timestamp": timestamp,
        }

        # 5. Publish to iap.val.packet
        out_payload = json.dumps(dialogue_packet).encode("utf-8")
        future = publisher.publish(outbound_topic_path, out_payload)
        future.result()

        message.ack()
        logger.info(f"Message processed and forwarded to VAL: {message_id}")

    except Exception as e:
        logger.error(f"Error processing message {message.message_id}: {e}")
        message.nack()


def main():
    init_gemini()
    init_weaviate()

    logger.info(f"Preprocessor listening on: {subscription_path}")
    streaming_pull_future = subscriber.subscribe(subscription_path, callback=process_message)

    with subscriber:
        try:
            streaming_pull_future.result()
        except TimeoutError:
            streaming_pull_future.cancel()
            streaming_pull_future.result()
        except Exception as e:
            logger.error(f"Subscriber failed: {e}")
            streaming_pull_future.cancel()
    
    # Cleanup
    if weaviate_client:
        weaviate_client.close()


if __name__ == "__main__":
    main()
