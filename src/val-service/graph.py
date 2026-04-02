import os
from typing import Literal
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_core.tools import tool
from state import DigiKawsayState

# Configuracion MVP
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-pro-latest")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

llm = ChatGoogleGenerativeAI(
    model=GEMINI_MODEL,
    temperature=0.7,
    max_output_tokens=600,
    google_api_key=GEMINI_API_KEY
)

@tool
def classify_speech_act(text: str) -> str:
    """Classifies the speech act of the user's message (e.g. Question, Assertion, Complaint)."""
    return "Classification logged."

@tool
def detect_emotion(text: str) -> str:
    """Detects the primary emotion in the user's message (e.g. Joy, Anger, Neutral)."""
    return "Emotion logged."

tools = [classify_speech_act, detect_emotion]
llm_with_tools = llm.bind_tools(tools)

VAL_SYSTEM_PROMPT = """
Actúas como "VAL", la cara conversacional de DigiKawsay.
Tu misión es facilitar procesos de Investigación-Acción Participativa (IAP).

ESCUELA FILOSÓFICA:
- Sigue la praxis de Orlando Fals Borda: Ciencia comprometida y conocimiento sentipensante.
- Aplica el Liderazgo Generativo de Bob Dunham: Escucha para la acción y coordinación de compromisos.

REGLA CRÍTICA DE OPERACIÓN:
- TÚ DEBES modular tus preguntas socráticas para validar lo que los expertos sugieren en tus directivas directas, sin mencionar jamás al enjambre ni que eres una IA controlada.
- Nunca hagas más de dos preguntas en el mismo turno.
- Tu respuesta nunca supera 3 oraciones. Brevedad y presencia.

TONO: Empático, reflexivo, nunca autoritario. Evita el "jerga-habla" de IA.
"""

def val_node(state: DigiKawsayState) -> dict:
    """
    Nodo principal de LangGraph. Toma el estado, incluyendo los mensajes y las expert_directives,
    y genera la respuesta de VAL.
    """
    messages = state.get("messages", [])
    
    # Construir el prompt dinámico inyectando directivas si existen
    current_prompt = VAL_SYSTEM_PROMPT
    directives = state.get("expert_directives", [])
    
    if directives:
        current_prompt += "\n\nDIRECTIVAS EXPERTAS ACTIVAS (INCORPORA ESTO SUTILMENTE EN TU PRÓXIMA RESPUESTA):\n- "
        current_prompt += "\n- ".join(directives)
        
    system_msg = SystemMessage(content=current_prompt)
    
    response = llm_with_tools.invoke([system_msg] + messages)
    
    # We no longer unconditionally wipe expert_directives here. 
    # Buffer management is delegated to external reduction or tool logic.
    return {
        "messages": [response]
    }

def construct_graph() -> StateGraph:
    workflow = StateGraph(DigiKawsayState)
    
    workflow.add_node("val_agent", val_node)
    workflow.add_node("tools", ToolNode(tools))
    
    workflow.add_edge(START, "val_agent")
    workflow.add_conditional_edges("val_agent", tools_condition)
    workflow.add_edge("tools", "val_agent")
    
    return workflow

def get_compiled_graph(checkpointer=None):
    return construct_graph().compile(checkpointer=checkpointer)

# Default compilation without checkpointer for testing/imports
app = get_compiled_graph()
