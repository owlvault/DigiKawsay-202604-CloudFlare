import os
from typing import Literal
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import tools_condition
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, ToolMessage
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig
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
            "safe_harbor_active": False
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
                
            tool_msg = ToolMessage(content=res, name=tool_name, tool_call_id=tool_call["id"])
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

# Default compilation without checkpointer for testing/imports
app = get_compiled_graph()
