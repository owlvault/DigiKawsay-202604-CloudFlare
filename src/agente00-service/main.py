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

from monitor import GCPMonitor
monitor = GCPMonitor(project_id=os.getenv("GCP_PROJECT_ID", "digikawsay"))

app = FastAPI(title="AGENTE-00 Supervisor", version="1.0.0 (MVP)")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from google.cloud import pubsub_v1
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "my-gcp-project")
SWARM_AG05_TOPIC = os.getenv("PUBSUB_SWARM_AG05_TOPIC", "iap.swarm.ag05")
try:
    publisher = pubsub_v1.PublisherClient()
except Exception:
    publisher = None

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
        <br><hr><br>
        <h3>Configuración</h3>
        <a href='/admin/setup-wizard' style='display:inline-block; padding: 10px 20px; background-color: #8b5cf6; color: white; text-decoration: none; border-radius: 8px;'>🔧 Setup Telegram Bot Wizard</a>
    </body>
    </html>
    """

@app.get("/admin/setup-wizard", response_class=HTMLResponse)
def setup_wizard():
    with open("templates/setup_wizard.html", "r", encoding="utf-8") as f:
        return f.read()

class WebhookSetupPayload(BaseModel):
    telegram_token: str
    ngrok_url: str

@app.post("/admin/setup-webhook")
def setup_webhook(payload: WebhookSetupPayload):
    import requests
    
    # Simple webhook set logic to auto-configure Telegram
    token = payload.telegram_token.strip()
    ngrok = payload.ngrok_url.strip().rstrip('/')
    
    if not token or not ngrok:
        raise HTTPException(status_code=400, detail="Token y URL son requeridos")
    
    # 1. Update telegram hook
    webhook_url = f"{ngrok}/webhook"
    telegram_api = f"https://api.telegram.org/bot{token}/setWebhook?url={webhook_url}"
    
    try:
        response = requests.get(telegram_api)
        result = response.json()
        if not result.get('ok'):
            return {"status": "error", "message": result.get('description', 'Unknown error by Telegram')}
            
        # 2. Update .env simple replacement fallback tool logic
        env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
        if os.path.exists(env_file):
            with open(env_file, 'r') as file:
                env_data = file.read()
            # replace TELEGRAM_BOT_TOKEN logic
            import re
            env_data = re.sub(r'TELEGRAM_BOT_TOKEN=.*', f'TELEGRAM_BOT_TOKEN={token}', env_data)
            with open(env_file, 'w') as file:
                file.write(env_data)

        # Notify success
        return {"status": "success", "message": "Webhook configurado y Token guardado en .env"}
    except Exception as e:
        logger.error(f"Error configuring webhook: {e}")
        return {"status": "error", "message": str(e)}

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
    inyecta una directiva que VAL leerá antes de su próxima respuesta.
    
    Usa una tabla compartida `wizard_directives` en PostgreSQL como puente
    desacoplado entre AG-00 y VAL.
    """
    logger.info(f"Inyectando directiva para participante: {payload.participant_id}")
    
    directive_id = str(uuid.uuid4())
    
    try:
        connection = psycopg2.connect(DATABASE_URL)
        cursor = connection.cursor()
        
        # Crear la tabla si no existe
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS wizard_directives (
                id TEXT PRIMARY KEY,
                participant_id TEXT NOT NULL,
                content TEXT NOT NULL,
                urgency TEXT DEFAULT 'MEDIUM',
                status TEXT DEFAULT 'PENDING',
                issued_by TEXT DEFAULT 'human_investigator',
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        connection.commit()
        
        # Insertar la directiva
        cursor.execute(
            """INSERT INTO wizard_directives (id, participant_id, content, urgency, status, issued_by)
               VALUES (%s, %s, %s, %s, 'PENDING', 'human_investigator')""",
            (directive_id, payload.participant_id, payload.content, payload.urgency)
        )
        connection.commit()
        
        cursor.close()
        connection.close()
        
        logger.info(f"Directiva inyectada en DB. ID: {directive_id}, Contenido: {payload.content}")
        return {"status": "success", "directive_id": directive_id, "participant_id": payload.participant_id}
        
    except Exception as e:
        logger.error(f"Error inyectando directiva: {e}")
        raise HTTPException(status_code=500, detail=f"Database injection failed: {e}")

@app.post("/system/pubsub/val_report")
def handle_val_report(request: dict):
    """
    Webhook para recibir el hit de Pub/Sub `iap.val.to.ag00` (En Cloud Run las suscripciones push son comunes).
    Actualiza métricas de ciclo.
    """
    try:
        if "message" in request and "data" in request["message"]:
            import base64
            payload = json.loads(base64.b64decode(request["message"]["data"]).decode('utf-8'))
        else:
            payload = request

        logger.info(f"Reporte de VAL recibido: {payload}")
        
        turn_count = payload.get("turn_count", 0)
        
        # Despachar a AG-05 si turn_count >= 2
        if turn_count >= 2 and publisher:
            logger.info("Enviando paquete a AG-05 (Methodologist)")
            task_envelope = {
                "message_id": str(uuid.uuid4()),
                "participant_id": payload.get("participant_id"),
                "clean_text": "Conversation context requires methodology analysis.",
                "emotion": payload.get("emotional_register"),
                "topics": payload.get("topics", [])
            }
            publisher.publish(
                publisher.topic_path(PROJECT_ID, SWARM_AG05_TOPIC),
                json.dumps(task_envelope).encode("utf-8")
            )
            
        return {"status": "acknowledged"}
    except Exception as e:
        logger.error(f"Error validando el reporte de VAL: {e}")
        raise HTTPException(status_code=400, detail="Bad reporting format")

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "agente00-service", "mode": "Wizard-Of-Oz"}

@app.get("/dashboard", response_class=HTMLResponse)
def dashboard_ui():
    """Sirve el dashboard de monitoreo premium."""
    static_path = os.path.join(os.path.dirname(__file__), "static", "dashboard.html")
    if os.path.exists(static_path):
        with open(static_path, "r", encoding="utf-8") as f:
            return f.read()
    return HTMLResponse("<h2>Dashboard no encontrado</h2>", status_code=404)

@app.get("/api/monitor")
def get_monitor_data():
    """Endpoint para alimentar el dashboard con datos reales de GCP."""
    return {
        "gemini": monitor.get_gemini_metrics(hours=24),
        "billing": monitor.get_billing_info(),
        "health": monitor.get_system_health()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
