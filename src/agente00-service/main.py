import os
import time
import uuid
from datetime import datetime
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import logging

import psycopg2  # Dummy import for MVP. In prod use asyncpg or SQLAlchemy

DATABASE_URL = os.getenv("DATABASE_URL", "postgres://user:pass@localhost:5432/digikawsay")

app = FastAPI(title="AGENTE-00 Supervisor", version="1.0.0 (MVP)")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DirectivePayload(BaseModel):
    participant_id: str
    project_id: str
    cycle_id: int
    content: str
    urgency: str = "MEDIUM"

@app.post("/admin/inject_directive")
def inject_directive(payload: DirectivePayload):
    """
    Endpoint de 'Shadowing'. Un analista humano (simulando al Swarm) 
    inyecta una directiva forzada al estado de 'expert_directives' de LangGraph.
    
    Típicamente esto lo haría AGENTE-00 leyendo outputs de Pub/Sub `iap.swarm.output`, 
    pero en el MVP lo exponemos como API manual para el 'Wizard of Oz'.
    """
    logger.info(f"Inyectando directiva para participante: {payload.participant_id}")
    
    directive_id = str(uuid.uuid4())
    directive = {
        "id": directive_id,
        "directive_type": "MANUAL_OVERRIDE",
        "content": payload.content,
        "urgency": payload.urgency,
        "issued_by": "human_investigator",
        "status": "PENDING",
        "issued_at": datetime.utcnow().isoformat() + "Z"
    }
    
    # Simular la actualización al Checkpointer (Postgres) de LangGraph
    try:
        # Aquí buscaríamos el thread_id (participant_id) en la tabla del checkpointer 
        # e inyectaríamos la directiva en 'expert_directives'.
        
        # connection = psycopg2.connect(DATABASE_URL)
        # cursor = connection.cursor()
        # cursor.execute("UPDATE langgraph_checkpoints SET state = jsonb_insert... WHERE thread_id = %s", (payload.participant_id,))
        # connection.commit()
        
        logger.info(f"Directiva inyectada exitosamente (Simulado). \nContenido: {payload.content}")
        return {"status": "success", "directive_id": directive_id}
        
    except Exception as e:
        logger.error(f"Error inyectando directiva: {e}")
        raise HTTPException(status_code=500, detail="Database override failed")

@app.post("/system/pubsub/val_report")
def handle_val_report(request: dict):
    """
    Webhook para recibir el hit de Pub/Sub `iap.val.to.ag00` (En Cloud Run las suscripciones push son comunes).
    Actualiza métricas de ciclo.
    """
    try:
        logger.info(f"Reporte de VAL recibido: {request}")
        # Lógica para registrar el N_Turnos y evaluar Saturation_Index simulada...
        return {"status": "acknowledged"}
    except Exception as e:
        logger.error("Error validando el reporte de VAL")
        raise HTTPException(status_code=400, detail="Bad reporting format")

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "agente00-service", "mode": "Wizard-Of-Oz"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
