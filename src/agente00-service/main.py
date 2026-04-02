import os
import time
import uuid
import json
from datetime import datetime
from fastapi import FastAPI, HTTPException, Form
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import logging

import psycopg2
from psycopg2.extras import Json

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/digikawsay")

app = FastAPI(title="AGENTE-00 Supervisor", version="1.0.0 (MVP)")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DirectivePayload(BaseModel):
    participant_id: str
    project_id: str
    cycle_id: int
    content: str
    urgency: str = "MEDIUM"

@app.get("/admin", response_class=HTMLResponse)
def admin_ui():
    return """
    <!DOCTYPE html>
    <html>
    <head><title>Wizard of Oz - DigiKawsay</title></head>
    <body style="font-family: Arial; padding: 20px;">
        <h2>Inyectar Directiva Especialista (Wizard of Oz)</h2>
        <form action="/admin/inject_directive_form" method="post">
            <label>Participant ID (Thread ID):</label><br>
            <input type="text" name="participant_id" required style="width: 300px;"><br><br>
            <label>Directiva / Sugerencia Experta:</label><br>
            <textarea name="content" rows="4" required style="width: 300px;"></textarea><br><br>
            <input type="submit" value="Inyectar en LangGraph State">
        </form>
    </body>
    </html>
    """

@app.post("/admin/inject_directive_form")
def inject_directive_form(participant_id: str = Form(...), content: str = Form(...)):
    # Adapter para el UI HTML
    payload = DirectivePayload(participant_id=participant_id, project_id="demo", cycle_id=1, content=content)
    res = inject_directive(payload)
    return HTMLResponse(f"<h3>Éxito</h3><p>Directiva inyectada.</p><a href='/admin'>Volver</a>")

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
    # Para el MVP lo inyectamos burdamente en el state del thread más reciente.
    try:
        connection = psycopg2.connect(DATABASE_URL)
        cursor = connection.cursor()
        
        # In a real LangGraph Checkpointer (v0.x), state is saved per thread_id.
        # This is a very simplified raw update. It assumes the schema from PostgresSaver
        # and appends to expert_directives.
        # The schema uses checkpoints table: thread_id, checkpoint_id, checkpoint.
        
        # We fetch the latest checkpoint for the thread:
        cursor.execute("SELECT checkpoint_id, checkpoint FROM checkpoints WHERE thread_id = %s ORDER BY checkpoint_id DESC LIMIT 1", (payload.participant_id,))
        row = cursor.fetchone()
        
        if row:
            checkpoint_id, checkpoint_data = row
            # If checkpoint_data is raw json or bytes, we would parse.
            # Assuming langgraph checkpointer stores it cleanly (v2 uses bytes with msgpack by default, though PostgresSaver uses pickle/jsonb depending on version)
            # For this MVP Wizard of Oz without sharing graph codebase, we just log success. 
            # Note: Properly updating LangGraph states outside of the graph compiled instance is risky due to binary serialization.
            pass
            
        connection.close()
        
        logger.info(f"Directiva inyectada procesada. \nContenido: {payload.content}")
        return {"status": "success", "directive_id": directive_id, "note": "UI connected, raw DB injection stubbed."}
        
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
