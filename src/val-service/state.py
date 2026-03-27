from typing import TypedDict, Annotated, List, Dict, Any, Literal
from langgraph.graph.message import add_messages
from datetime import datetime

class ConversationDirective(TypedDict):
    id: str
    directive_type: str # REFRAME, QUESTION, CHALLENGE
    content: str
    urgency: Literal['LOW', 'MEDIUM', 'HIGH']
    issued_by: str
    status: Literal['PENDING', 'APPLIED', 'DEFERRED']
    issued_at: str

class DialogueState(TypedDict):
    participant_id: str
    emotional_register: str
    momentum_score: float
    topics_covered: List[str]
    safe_harbor_active: bool

class DigiKawsayState(TypedDict):
    # -- Plano conversacional (VAL) --
    messages: Annotated[list, add_messages]
    dialogue_states: Dict[str, DialogueState]  # indexado por participant_id
    directive_buffer: List[ConversationDirective]
    
    # -- Configuración del proyecto --
    project_config: Dict[str, Any]
    
    # -- Directivas del enjambre (invisible para participantes en el MVP) --
    expert_directives: List[str]
    pending_directives: List[ConversationDirective]
    
    # -- Indicadores de convergencia --
    is_saturated: bool
    saturation_index: float
    consensus_reached: bool
    cycle_id: int
    iap_phase: Literal['INVESTIGACION','ACCION','PARTICIPACION','CLOSED']
    
    # -- Trazabilidad --
    coverage_matrix: Dict[str, Dict[str, str]]
