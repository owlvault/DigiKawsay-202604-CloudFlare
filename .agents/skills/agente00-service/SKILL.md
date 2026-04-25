# Skill: AGENTE-00 Service

## Propósito
API REST FastAPI que actúa como panel de administración del facilitador.
Gestiona proyectos, participantes, directivas WoZ y exportación de datos.
Sirve el panel de control HTML (`static/panel.html`).

## Archivos del servicio
```
src/agente00-service/
├── main.py              — FastAPI app, todos los endpoints /admin/*
├── monitor.py           — Métricas GCP (Gemini API calls, billing)
├── requirements.txt     — Dependencias Python
├── static/
│   ├── panel.html       — Panel de control SPA (JavaScript vanilla)
│   └── dashboard.html   — Monitor de infraestructura Obsidian
└── templates/
    └── setup_wizard.html — Wizard configuración Telegram
```

## Cómo levantar el servicio
```bash
cd src/agente00-service
pip install -r requirements.txt
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/digikawsay" \
TELEGRAM_BOT_TOKEN="tu_token" \
GCP_PROJECT_ID="digikawsay" \
uvicorn main:app --host 0.0.0.0 --port 8002 --reload
```

## Cómo probar endpoints
```bash
# Listar proyectos
curl http://localhost:8002/admin/projects

# Crear proyecto
curl -X POST http://localhost:8002/admin/create_project \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "seed_prompt": "¿Cómo fluye la comunicación?", "max_participants": 5}'

# Inyectar directiva WoZ
curl -X POST http://localhost:8002/admin/inject_directive \
  -H "Content-Type: application/json" \
  -d '{"participant_id": "123", "project_id": "uuid", "content": "Indaga sobre X", "urgency": "HIGH"}'

# Reporte del piloto
curl http://localhost:8002/admin/report/{project_id}
```

## Endpoints existentes (NO duplicar)
```
POST /admin/create_project          — Crear piloto
GET  /admin/projects                — Listar proyectos con métricas
GET  /admin/project/{id}            — Detalle de un proyecto
POST /admin/register_participant    — Registrar un participante
POST /admin/register_batch          — Registro masivo (FormData)
GET  /admin/participants/{project_id} — Participantes con engagement
GET  /admin/conversation/{participant_id} — Historial de conversación
POST /admin/inject_directive        — Inyectar directiva WoZ
GET  /admin/directives/{project_id} — Historial de directivas
GET  /admin/export/{project_id}     — Exportar transcripciones (json|csv)
GET  /admin/report/{project_id}     — Reporte del piloto
POST /admin/close_project           — Cerrar piloto + despedida
POST /admin/setup-webhook           — Configurar webhook Telegram
GET  /admin                         — Servir panel.html
GET  /api/monitor                   — Métricas del sistema
```

## Cómo añadir un endpoint nuevo
```python
# En main.py, después de los endpoints existentes

class NuevoPayload(BaseModel):
    param1: str
    param2: Optional[int] = None

@app.post("/admin/nuevo_endpoint")
def nuevo_endpoint(payload: NuevoPayload):
    """Descripción breve."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO tabla (...) VALUES (%s, %s) RETURNING id",
            (payload.param1, payload.param2)
        )
        result = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return {"status": "success", "id": str(result['id'])}
    except Exception as e:
        logger.error(f"Error en nuevo_endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

## Cómo añadir una sección al panel HTML (panel.html)
```html
<!-- 1. Nav item en el sidebar (después de los existentes) -->
<div class="nav-item" onclick="showSection('nueva')">📌 Nueva Sección</div>

<!-- 2. Sección en main content (después de las secciones existentes) -->
<div id="sec-nueva" class="section">
    <h2 style="margin-bottom: 24px;">Nueva Sección</h2>
    <div class="card">
        <h3>Contenido</h3>
        <!-- contenido aquí -->
    </div>
</div>
```

```javascript
// 3. En la función showSection(), añadir el case:
if (name === 'nueva') loadNueva();

// 4. Implementar la función de carga:
async function loadNueva() {
    const data = await api('/admin/nuevo_endpoint');
    // renderizar datos
}
```

## Clases CSS disponibles en panel.html
- `.card` — contenedor con borde y padding
- `.kpi` / `.kpi-grid` — métricas numéricas en grid
- `.badge.badge-active` / `.badge-invited` / `.badge-completed` — estados de participante
- `.btn.btn-primary` / `.btn-secondary` / `.btn-danger` / `.btn-sm` — botones
- `.msg-user` / `.msg-val` — burbujas de chat
- Variables CSS: `--primary`, `--accent`, `--danger`, `--warning`, `--text`, `--text2`, `--border`
