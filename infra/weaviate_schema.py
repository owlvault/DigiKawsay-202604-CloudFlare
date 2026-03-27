import weaviate
import os
import sys

def initialize_weaviate_schema(url, api_key, project_id):
    """
    Inicializa el schema de Weaviate para DigiKawsay MVP
    Asume el uso del vectorizador text2vec-palm (Vertex AI / Gemini)
    """
    # Conectar al cliente Weaviate
    auth_config = weaviate.AuthApiKey(api_key=api_key) if api_key else None
    
    # Weaviate SDK v4 (assuming modern client usage)
    # Si se requiere V3, se debe ajustar este bloque.
    print(f"Conectando a Weaviate en {url}...")
    try:
        client = weaviate.Client(url=url, auth_client_secret=auth_config)
    except Exception as e:
        print(f"Error conectando: {e}")
        sys.exit(1)

    # Definir clase RawFragment
    class_raw_fragment = {
        "class": "RawFragment",
        "description": "Fragmento de texto anonimizado del corpus de participantes",
        "vectorizer": "text2vec-palm",
        "moduleConfig": {
            "text2vec-palm": {
                "projectId": project_id,
                "apiEndpoint": "us-central1-aiplatform.googleapis.com", # o tu region
                "modelId": "text-embedding-004"
            }
        },
        "properties": [
            {
                "name": "participant_id",
                "dataType": ["text"],
                "description": "OAuth sub claim del participante",
                "moduleConfig": {"text2vec-palm": {"skip": True}}
            },
            {
                "name": "project_id",
                "dataType": ["text"],
                "moduleConfig": {"text2vec-palm": {"skip": True}}
            },
            {
                "name": "cycle_id",
                "dataType": ["int"],
                "moduleConfig": {"text2vec-palm": {"skip": True}}
            },
            {
                "name": "session_id",
                "dataType": ["text"],
                "moduleConfig": {"text2vec-palm": {"skip": True}}
            },
            {
                "name": "text",
                "dataType": ["text"],
                "description": "Texto anonimizado del fragmento"
            },
            {
                "name": "modality",
                "dataType": ["text"],
                "description": "text | voice | document"
            },
            {
                "name": "timestamp",
                "dataType": ["date"]
            },
            {
                "name": "turn_id",
                "dataType": ["int"]
            }
        ]
    }

    # Definir clase AgentOutput (para uso futuro opcional en MVP)
    class_agent_output = {
        "class": "AgentOutput",
        "description": "Output serializado de agente especialista",
        "vectorizer": "text2vec-palm",
        "properties": [
            {
                "name": "agent_id",
                "dataType": ["text"],
                "moduleConfig": {"text2vec-palm": {"skip": True}}
            },
            {
                "name": "project_id",
                "dataType": ["text"],
                "moduleConfig": {"text2vec-palm": {"skip": True}}
            },
            {
                "name": "output_json",
                "dataType": ["text"],
                "moduleConfig": {"text2vec-palm": {"skip": True}}
            },
            {
                "name": "summary_text",
                "dataType": ["text"],
                "description": "Resumen legible para RAG"
            }
        ]
    }

    classes = [class_raw_fragment, class_agent_output]
    
    for cls in classes:
        if not client.schema.exists(cls["class"]):
            print(f"Clase {cls['class']} no existe. Creándola...")
            client.schema.create_class(cls)
            print(f"Clase {cls['class']} creada con éxito.")
        else:
            print(f"Clase {cls['class']} ya existe. Abortando sobreescritura.")

if __name__ == "__main__":
    WEAVIATE_URL = os.getenv("WEAVIATE_URL", "http://localhost:8080")
    WEAVIATE_API_KEY = os.getenv("WEAVIATE_API_KEY", "")
    GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "my-gcp-project")
    
    initialize_weaviate_schema(WEAVIATE_URL, WEAVIATE_API_KEY, GCP_PROJECT_ID)
