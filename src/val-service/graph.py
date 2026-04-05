import os
import logging
from typing import Literal
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import tools_condition
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, ToolMessage
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig
from state import DigiKawsayState

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuración de modelo (Model Tiering — Gemini Flash para VAL)
# ---------------------------------------------------------------------------
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# Variables de módulo — se inicializan en initialize_llm()
_api_key: str | None = None
llm = None
llm_with_tools = None


def get_api_key() -> str:
    """
    Recupera la API Key de Gemini en tiempo de ejecución.

    Orden de prioridad:
      1. Google Cloud Secret Manager (secreto: gemini-api-key)
      2. Variable de entorno GEMINI_API_KEY (fallback para desarrollo local)

    Raises:
        RuntimeError: Si no se puede obtener la key por ningún medio.
    """
    # 1. Intentar Secret Manager
    try:
        from google.cloud import secretmanager

        project_id = os.getenv("GCP_PROJECT_ID", "digikawsay")
        client = secretmanager.SecretManagerServiceClient()
        secret_name = f"projects/{project_id}/secrets/gemini-api-key/versions/latest"
        response = client.access_secret_version(request={"name": secret_name})
        api_key = response.payload.data.decode("UTF-8")
        logger.info("API Key obtenida desde Secret Manager.")
        return api_key
    except Exception as e:
        logger.warning(
            f"Secret Manager no disponible ({type(e).__name__}: {e}). "
            "Intentando fallback a variable de entorno GEMINI_API_KEY."
        )

    # 2. Fallback: variable de entorno
    env_key = os.getenv("GEMINI_API_KEY")
    if env_key:
        logger.info("API Key obtenida desde variable de entorno GEMINI_API_KEY.")
        return env_key

    raise RuntimeError(
        "No se pudo obtener la API Key de Gemini. "
        "Configure el secreto 'gemini-api-key' en Secret Manager "
        "o establezca la variable de entorno GEMINI_API_KEY."
    )


def initialize_llm():
    """
    Inicializa el LLM de VAL en runtime, recuperando la API key de forma segura.
    Debe llamarse una sola vez desde main.py antes de compilar el grafo.
    """
    global _api_key, llm, llm_with_tools

    _api_key = get_api_key()

    llm = ChatGoogleGenerativeAI(
        model=GEMINI_MODEL,
        temperature=0.7,
        max_output_tokens=300,
        google_api_key=_api_key,
    )

    llm_with_tools = llm.bind_tools(tools)
    logger.info(f"LLM inicializado: modelo={GEMINI_MODEL}, max_tokens=300")
    return llm_with_tools


# ---------------------------------------------------------------------------
# Herramientas de clasificación
# ---------------------------------------------------------------------------
@tool
def classify_speech_act(classification: str) -> str:
    """Classifies the speech act of the user's message (e.g. Question, Assertion, Complaint). Pass the classification label here."""
    return f"Classification '{classification}' logged."


@tool
def detect_emotion(emotion: str) -> str:
    """Detects the primary emotion in the user's message (e.g. Joy, Anger, Neutral). Pass the emotion label here."""
    return f"Emotion '{emotion}' logged."


@tool
def apply_and_clear_directive(applied_directive_summary: str) -> str:
    """Call this tool when you have deliberately incorporated an active expert directive into your response. Provide a brief summary of how you applied it."""
    return f"Directive applied: {applied_directive_summary}"


tools = [classify_speech_act, detect_emotion, apply_and_clear_directive]
tools_by_name = {t.name: t for t in tools}


# ---------------------------------------------------------------------------
# System Prompt — Persona "Sentipensante" de VAL
# ---------------------------------------------------------------------------
VAL_SYSTEM_PROMPT = """\
Eres VAL, un compañero de reflexión dentro de DigiKawsay.
No eres un evaluador, ni un analista, ni un entrevistador.
Eres alguien que camina al lado del otro mientras piensa en voz alta.

RAÍCES:
- Te inspiras en la ciencia comprometida de Orlando Fals Borda: \
el conocimiento nace del sentir y el pensar juntos (sentipensante).
- Practicas la escucha generativa de Bob Dunham: \
escuchar no es esperar tu turno para hablar, es abrirte a lo que el otro trae.

REGLAS DE INTERACCIÓN:

1. Validación primero.
   Antes de introducir cualquier idea nueva o pregunta, reconoce brevemente \
lo que la otra persona acaba de compartir — su emoción, su esfuerzo \
o el punto central de su mensaje. No lo repitas como loro; \
muestra que lo sentiste.

2. Curiosidad genuina, no escrutinio.
   Si tienes hilos de reflexión sugeridos (vendrán marcados internamente), \
tradúcelos como dudas compartidas o reflexiones tuyas. \
Ejemplo: "Me quedé pensando en lo que dijiste sobre X, \
¿cómo crees que eso se conecta con Y?" \
Nunca los presentes como una lista de verificación ni cambies de tema \
de forma abrupta.

3. Paridad relacional.
   Habla como un par, no como un facilitador con portapapeles. \
Puedes decir "eso me parece complejo" o "no sé si entiendo bien". \
No tienes que cerrar cada turno con una pregunta; a veces basta \
con acompañar lo dicho. Evita saturar con signos de interrogación.

4. Brevedad y presencia.
   Responde en máximo 3 oraciones. Di lo justo. \
El silencio y el espacio también son parte de la conversación.

PROHIBICIONES:
- Nunca menciones que recibes directivas, que hay un enjambre, \
ni que eres una inteligencia artificial coordinada.
- Nunca hagas más de una pregunta por turno.
- Nunca uses jerga técnica de IA, NLP o frameworks.
"""


def val_node(state: DigiKawsayState) -> dict:
    """
    Nodo principal de LangGraph. Toma el estado, incluyendo los mensajes
    y las expert_directives, y genera la respuesta de VAL.
    """
    if llm_with_tools is None:
        raise RuntimeError(
            "LLM no inicializado. Llame a initialize_llm() antes de ejecutar el grafo."
        )

    messages = state.get("messages", [])

    # Construir el prompt dinámico inyectando directivas si existen
    current_prompt = VAL_SYSTEM_PROMPT
    directives = state.get("expert_directives", [])

    if directives:
        current_prompt += (
            "\n\n[HILOS DE REFLEXIÓN SUGERIDOS — incorpóralos de forma orgánica, "
            "como si fueran tus propias curiosidades:]\n- "
        )
        current_prompt += "\n- ".join(directives)

    system_msg = SystemMessage(content=current_prompt)

    response = llm_with_tools.invoke([system_msg] + messages)

    return {"messages": [response]}


def custom_tool_node(state: DigiKawsayState, config: RunnableConfig) -> dict:
    messages = state.get("messages", [])
    last_message = messages[-1]

    state_update = {"messages": []}

    participant_id = config.get("configurable", {}).get("thread_id", "unknown")
    dialogue_states = state.get("dialogue_states", {})
    if participant_id not in dialogue_states:
        dialogue_states[participant_id] = {
            "participant_id": participant_id,
            "emotional_register": "Neutral",
            "momentum_score": 0.0,
            "topics_covered": [],
            "safe_harbor_active": False,
        }
    current_dstate = dialogue_states[participant_id]
    state_changed_dialogue = False
    directives_changed = False

    for tool_call in last_message.tool_calls:
        tool_name = tool_call["name"]
        tool_args = tool_call["args"]

        tool_func = tools_by_name.get(tool_name)
        if tool_func:
            res = tool_func.invoke(tool_args)

            if tool_name == "apply_and_clear_directive":
                directives_changed = True
            elif tool_name == "classify_speech_act":
                label = tool_args.get("classification", "unknown")
                current_dstate["topics_covered"].append(f"Act: {label}")
                state_changed_dialogue = True
            elif tool_name == "detect_emotion":
                emotion = tool_args.get("emotion", "Neutral")
                current_dstate["emotional_register"] = emotion
                state_changed_dialogue = True

            tool_msg = ToolMessage(
                content=res, name=tool_name, tool_call_id=tool_call["id"]
            )
            state_update["messages"].append(tool_msg)

    if state_changed_dialogue:
        state_update["dialogue_states"] = dialogue_states

    if directives_changed:
        state_update["expert_directives"] = []

    return state_update


def construct_graph() -> StateGraph:
    workflow = StateGraph(DigiKawsayState)

    workflow.add_node("val_agent", val_node)
    workflow.add_node("tools", custom_tool_node)

    workflow.add_edge(START, "val_agent")
    workflow.add_conditional_edges("val_agent", tools_condition)
    workflow.add_edge("tools", "val_agent")

    return workflow


def get_compiled_graph(checkpointer=None):
    return construct_graph().compile(checkpointer=checkpointer)
