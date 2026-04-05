import os
import uuid
import json
import csv
import io
from datetime import datetime
from fastapi import FastAPI, HTTPException, Form, Query
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
import logging

import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/digikawsay")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")

app = FastAPI(title="AGENTE-00 Supervisor", version="2.0.0 (Pilot-Ready)")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from google.cloud import pubsub_v1
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "digikawsay")
SWARM_AG05_TOPIC = os.getenv("PUBSUB_SWARM_AG05_TOPIC", "iap.swarm.ag05")
try:
    publisher = pubsub_v1.PublisherClient()
except Exception:
    publisher = None


def get_db():
    """Get a database connection."""
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


# ============================================================
# Models
# ============================================================
class CreateProjectPayload(BaseModel):
    name: str
    seed_prompt: str
    description: Optional[str] = ""
    max_participants: int = 10
    pilot_duration_days: int = 7

class RegisterParticipantPayload(BaseModel):
    project_id: str
    display_name: Optional[str] = None

class DirectivePayload(BaseModel):
    participant_id: str
    project_id: str = "demo"
    cycle_id: int = 1
    content: str
    urgency: str = "MEDIUM"

class CloseProjectPayload(BaseModel):
    project_id: str
    send_farewell: bool = True

class WebhookSetupPayload(BaseModel):
    telegram_token: str
    ngrok_url: str


# ============================================================
# S1.5 — Project Management
# ============================================================
@app.post("/admin/create_project")
def create_project(payload: CreateProjectPayload):
    """Create a new diagnostic pilot project with a seed prompt."""
    project_id = str(uuid.uuid4())
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO projects (project_id, name, seed_prompt, description, max_participants, pilot_duration_days, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, 'admin')
        """, (project_id, payload.name, payload.seed_prompt, payload.description,
              payload.max_participants, payload.pilot_duration_days))
        # Create initial cycle
        cur.execute("""
            INSERT INTO cycles (project_id, cycle_id, phase)
            VALUES (%s, 1, 'INVESTIGACION')
        """, (project_id,))
        conn.commit()
        cur.close()
        conn.close()
        logger.info(f"Project created: {project_id} — {payload.name}")
        return {
            "status": "success",
            "project_id": project_id,
            "name": payload.name,
            "invite_url_template": f"https://t.me/<BOT_USERNAME>?start={project_id}"
        }
    except Exception as e:
        logger.error(f"Error creating project: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/projects")
def list_projects():
    """List all pilot projects."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT p.project_id, p.name, p.seed_prompt, p.status, p.created_at,
                   p.max_participants, p.pilot_duration_days,
                   COUNT(DISTINCT pt.participant_id) FILTER (WHERE pt.status = 'active') as active_participants,
                   COUNT(DISTINCT dt.turn_id) as total_turns
            FROM projects p
            LEFT JOIN participants pt ON p.project_id = pt.project_id
            LEFT JOIN dialogue_turns dt ON p.project_id = dt.project_id
            GROUP BY p.project_id
            ORDER BY p.created_at DESC
        """)
        projects = cur.fetchall()
        cur.close()
        conn.close()
        return {"projects": [dict(p) for p in projects]}
    except Exception as e:
        logger.error(f"Error listing projects: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/project/{project_id}")
def get_project(project_id: str):
    """Get project details with its seed prompt."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT * FROM projects WHERE project_id = %s", (project_id,))
        project = cur.fetchone()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        cur.close()
        conn.close()
        return dict(project)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# S1.6 — Participant Registration
# ============================================================
@app.post("/admin/register_participant")
def register_participant(payload: RegisterParticipantPayload):
    """Pre-register a participant and generate an invitation token."""
    invite_token = str(uuid.uuid4())[:8]  # short token for Telegram deep link
    try:
        conn = get_db()
        cur = conn.cursor()
        # Create placeholder with invite token — participant_id will be filled when they message the bot
        placeholder_id = f"pending_{invite_token}"
        cur.execute("""
            INSERT INTO participants (participant_id, project_id, display_name, invite_token, status)
            VALUES (%s, %s, %s, %s, 'invited')
        """, (placeholder_id, payload.project_id, payload.display_name, invite_token))
        conn.commit()
        cur.close()
        conn.close()

        bot_username = "digikawsay_bot"  # will be resolved dynamically
        invite_link = f"https://t.me/{bot_username}?start={invite_token}"

        return {
            "status": "success",
            "invite_token": invite_token,
            "invite_link": invite_link,
            "display_name": payload.display_name
        }
    except Exception as e:
        logger.error(f"Error registering participant: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/register_batch")
def register_batch(project_id: str = Form(...), names: str = Form(...)):
    """Register multiple participants at once. Names separated by newlines."""
    name_list = [n.strip() for n in names.strip().split('\n') if n.strip()]
    results = []
    for name in name_list:
        payload = RegisterParticipantPayload(project_id=project_id, display_name=name)
        result = register_participant(payload)
        results.append(result)
    return {"status": "success", "registered": len(results), "invitations": results}


# ============================================================
# S2.6 — Participant Monitoring
# ============================================================
@app.get("/admin/participants/{project_id}")
def list_participants(project_id: str):
    """List all participants in a project with their engagement metrics."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT p.participant_id, p.display_name, p.status, p.consent_given,
                   p.first_message_at, p.last_message_at,
                   COALESCE(ds.turn_count, 0) as turn_count,
                   COALESCE(ds.emotional_register, 'N/A') as emotional_register,
                   COALESCE(ds.momentum_score, 0) as momentum_score,
                   ds.topics_covered
            FROM participants p
            LEFT JOIN dialogue_states ds ON p.participant_id = ds.participant_id
                AND ds.project_id = p.project_id
            WHERE p.project_id = %s
            ORDER BY p.last_message_at DESC NULLS LAST
        """, (project_id,))
        participants = cur.fetchall()
        cur.close()
        conn.close()
        return {"participants": [dict(p) for p in participants]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# S2.5 — Live Conversations (WoZ Panel v2)
# ============================================================
@app.get("/admin/conversation/{participant_id}")
def get_conversation(participant_id: str, project_id: Optional[str] = None):
    """Get the full conversation history for a participant."""
    try:
        conn = get_db()
        cur = conn.cursor()
        query = """
            SELECT turn_number, user_text, val_response, emotional_register,
                   speech_act, topics, directive_applied, timestamp
            FROM dialogue_turns
            WHERE participant_id = %s
        """
        params = [participant_id]
        if project_id:
            query += " AND project_id = %s"
            params.append(project_id)
        query += " ORDER BY turn_number ASC"
        cur.execute(query, params)
        turns = cur.fetchall()
        cur.close()
        conn.close()
        return {"participant_id": participant_id, "turns": [dict(t) for t in turns]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Wizard of Oz — Directive Injection
# ============================================================
@app.post("/admin/inject_directive")
def inject_directive(payload: DirectivePayload):
    """Inject a WoZ directive that VAL will read before its next response."""
    directive_id = str(uuid.uuid4())
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO wizard_directives (id, participant_id, project_id, content, urgency, status, issued_by)
            VALUES (%s, %s, %s, %s, %s, 'PENDING', 'human_investigator')
        """, (directive_id, payload.participant_id, payload.project_id, payload.content, payload.urgency))
        conn.commit()
        cur.close()
        conn.close()
        logger.info(f"Directive injected: {directive_id} for {payload.participant_id}")
        return {"status": "success", "directive_id": directive_id}
    except Exception as e:
        logger.error(f"Error injecting directive: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/directives/{project_id}")
def list_directives(project_id: str):
    """List all directives for a project, with status."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT wd.*, p.display_name
            FROM wizard_directives wd
            LEFT JOIN participants p ON wd.participant_id = p.participant_id
            WHERE wd.project_id = %s
            ORDER BY wd.created_at DESC
        """, (project_id,))
        directives = cur.fetchall()
        cur.close()
        conn.close()
        return {"directives": [dict(d) for d in directives]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# S2.7 — Export Transcripts
# ============================================================
@app.get("/admin/export/{project_id}")
def export_transcripts(project_id: str, format: str = Query("json", enum=["json", "csv"])):
    """Export all conversation transcripts for a project."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT dt.participant_id, p.display_name, dt.turn_number,
                   dt.user_text, dt.val_response, dt.emotional_register,
                   dt.speech_act, dt.topics, dt.directive_applied, dt.timestamp
            FROM dialogue_turns dt
            LEFT JOIN participants p ON dt.participant_id = p.participant_id
            WHERE dt.project_id = %s
            ORDER BY dt.participant_id, dt.turn_number
        """, (project_id,))
        turns = cur.fetchall()
        cur.close()
        conn.close()

        if format == "csv":
            output = io.StringIO()
            if turns:
                writer = csv.DictWriter(output, fieldnames=turns[0].keys())
                writer.writeheader()
                for row in turns:
                    row_dict = dict(row)
                    # Convert lists/dates to strings for CSV
                    for k, v in row_dict.items():
                        if isinstance(v, (list, datetime)):
                            row_dict[k] = str(v)
                    writer.writerow(row_dict)
            return StreamingResponse(
                io.BytesIO(output.getvalue().encode('utf-8')),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename=pilot_{project_id[:8]}_transcripts.csv"}
            )
        else:
            return {"project_id": project_id, "total_turns": len(turns),
                    "transcripts": [dict(t) for t in turns]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# S3.1 — Close Project
# ============================================================
@app.post("/admin/close_project")
def close_project(payload: CloseProjectPayload):
    """Close a pilot project. Optionally notifies participants via Telegram."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            UPDATE projects SET status = 'closed', closed_at = NOW()
            WHERE project_id = %s AND status = 'active'
            RETURNING name
        """, (payload.project_id,))
        result = cur.fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Active project not found")

        # Mark all participants as completed
        cur.execute("""
            UPDATE participants SET status = 'completed'
            WHERE project_id = %s AND status = 'active'
        """, (payload.project_id,))

        # Close cycles
        cur.execute("""
            UPDATE cycles SET phase = 'CLOSED', closed_at = NOW()
            WHERE project_id = %s AND phase != 'CLOSED'
        """, (payload.project_id,))

        conn.commit()

        # Send farewell to participants via Telegram
        if payload.send_farewell and TELEGRAM_BOT_TOKEN:
            import requests
            cur.execute("""
                SELECT participant_id FROM participants
                WHERE project_id = %s AND participant_id NOT LIKE 'pending_%%'
            """, (payload.project_id,))
            participants = cur.fetchall()
            farewell_msg = (
                "🙏 El Foro Organizacional ha concluido. Muchas gracias por compartir "
                "tus perspectivas. Tu voz es parte fundamental de este proceso de "
                "transformación. ¡Hasta pronto!"
            )
            for p in participants:
                try:
                    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
                    requests.post(url, json={"chat_id": p['participant_id'], "text": farewell_msg})
                except Exception:
                    pass

        cur.close()
        conn.close()
        return {"status": "success", "project_name": result['name'], "closed_at": datetime.utcnow().isoformat()}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# S3.2 — Pilot Report Generation
# ============================================================
@app.get("/admin/report/{project_id}")
def generate_report(project_id: str):
    """Generate an automated pilot summary report."""
    try:
        conn = get_db()
        cur = conn.cursor()

        # Project info
        cur.execute("SELECT * FROM projects WHERE project_id = %s", (project_id,))
        project = cur.fetchone()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Participation metrics
        cur.execute("""
            SELECT COUNT(*) FILTER (WHERE status = 'active' OR status = 'completed') as active_count,
                   COUNT(*) FILTER (WHERE status = 'invited') as invited_only,
                   COUNT(*) as total_registered
            FROM participants WHERE project_id = %s
        """, (project_id,))
        participation = dict(cur.fetchone())

        # Conversation depth
        cur.execute("""
            SELECT participant_id,
                   COUNT(*) as turns,
                   MIN(timestamp) as first_turn,
                   MAX(timestamp) as last_turn
            FROM dialogue_turns WHERE project_id = %s
            GROUP BY participant_id
        """, (project_id,))
        depth_rows = cur.fetchall()
        avg_turns = sum(r['turns'] for r in depth_rows) / max(len(depth_rows), 1)

        # Emotional distribution
        cur.execute("""
            SELECT emotional_register, COUNT(*) as count
            FROM dialogue_turns WHERE project_id = %s AND emotional_register IS NOT NULL
            GROUP BY emotional_register ORDER BY count DESC
        """, (project_id,))
        emotions = {r['emotional_register']: r['count'] for r in cur.fetchall()}

        # Topics distribution
        cur.execute("""
            SELECT unnest(topics) as topic, COUNT(*) as count
            FROM dialogue_turns WHERE project_id = %s AND topics IS NOT NULL
            GROUP BY topic ORDER BY count DESC LIMIT 15
        """, (project_id,))
        topics = {r['topic']: r['count'] for r in cur.fetchall()}

        # Directive effectiveness
        cur.execute("""
            SELECT COUNT(*) FILTER (WHERE status = 'APPLIED') as applied,
                   COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
                   COUNT(*) as total
            FROM wizard_directives WHERE project_id = %s
        """, (project_id,))
        directives = dict(cur.fetchone())

        # Feedback summary
        cur.execute("""
            SELECT question_key, AVG(response_score) as avg_score, COUNT(*) as responses
            FROM pilot_feedback WHERE project_id = %s AND response_score IS NOT NULL
            GROUP BY question_key
        """, (project_id,))
        feedback = {r['question_key']: {"avg_score": float(r['avg_score']), "responses": r['responses']}
                    for r in cur.fetchall()}

        cur.close()
        conn.close()

        participation_rate = (participation['active_count'] / max(participation['total_registered'], 1)) * 100

        report = {
            "project": {
                "name": project['name'],
                "seed_prompt": project['seed_prompt'],
                "status": project['status'],
                "created_at": str(project['created_at']),
                "closed_at": str(project.get('closed_at', 'N/A'))
            },
            "kpis": {
                "participation_rate_pct": round(participation_rate, 1),
                "total_registered": participation['total_registered'],
                "active_participants": participation['active_count'],
                "invited_no_response": participation['invited_only'],
                "average_turns_per_participant": round(avg_turns, 1),
                "total_dialogue_turns": sum(r['turns'] for r in depth_rows),
            },
            "emotional_distribution": emotions,
            "top_topics": topics,
            "wizard_of_oz": directives,
            "participant_feedback": feedback,
            "per_participant_depth": [
                {"participant_id": r['participant_id'], "turns": r['turns'],
                 "first_turn": str(r['first_turn']), "last_turn": str(r['last_turn'])}
                for r in depth_rows
            ]
        }
        return report
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Webhook Setup Wizard
# ============================================================
@app.post("/admin/setup-webhook")
def setup_webhook(payload: WebhookSetupPayload):
    import requests
    token = payload.telegram_token.strip()
    ngrok = payload.ngrok_url.strip().rstrip('/')
    if not token or not ngrok:
        raise HTTPException(status_code=400, detail="Token y URL son requeridos")
    webhook_url = f"{ngrok}/webhook"
    telegram_api = f"https://api.telegram.org/bot{token}/setWebhook?url={webhook_url}"
    try:
        response = requests.get(telegram_api)
        result = response.json()
        if not result.get('ok'):
            return {"status": "error", "message": result.get('description', 'Error de Telegram')}
        return {"status": "success", "message": f"Webhook configurado: {webhook_url}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ============================================================
# VAL Report Handler (from PubSub)
# ============================================================
@app.post("/system/pubsub/val_report")
def handle_val_report(request: dict):
    try:
        if "message" in request and "data" in request["message"]:
            import base64
            payload = json.loads(base64.b64decode(request["message"]["data"]).decode('utf-8'))
        else:
            payload = request

        turn_count = payload.get("turn_count", 0)
        if turn_count >= 2 and publisher:
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
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================
# Health & Static
# ============================================================
@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "agente00-service", "version": "2.0.0", "mode": "Pilot-Ready"}


@app.get("/admin", response_class=HTMLResponse)
def admin_ui():
    """Serve the WoZ v2 control panel."""
    static_path = os.path.join(os.path.dirname(__file__), "static", "panel.html")
    if os.path.exists(static_path):
        with open(static_path, "r", encoding="utf-8") as f:
            return f.read()
    return HTMLResponse("<h2>Panel no encontrado. Crea static/panel.html</h2>", status_code=404)


@app.get("/admin/setup-wizard", response_class=HTMLResponse)
def setup_wizard():
    path = os.path.join(os.path.dirname(__file__), "templates", "setup_wizard.html")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    return HTMLResponse("<h2>Setup wizard not found</h2>", status_code=404)


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard_ui():
    static_path = os.path.join(os.path.dirname(__file__), "static", "dashboard.html")
    if os.path.exists(static_path):
        with open(static_path, "r", encoding="utf-8") as f:
            return f.read()
    return HTMLResponse("<h2>Dashboard no encontrado</h2>", status_code=404)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
