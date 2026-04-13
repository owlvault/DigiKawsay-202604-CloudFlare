# Reglas: Convenciones de API y Servicios

## Endpoints FastAPI (agente00-service)
```python
# Patrón estándar para todos los endpoints admin
@app.get("/admin/recurso/{id}")
def get_recurso(id: str):
    """Docstring breve de una línea."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT * FROM tabla WHERE id = %s", (id,))
        result = cur.fetchone()
        cur.close()
        conn.close()
        if not result:
            raise HTTPException(status_code=404, detail="No encontrado")
        return dict(result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error en get_recurso: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

## Pub/Sub Subscribers
```python
def process_message(message: pubsub_v1.subscriber.message.Message):
    try:
        packet = json.loads(message.data.decode("utf-8"))
        # --- lógica de procesamiento ---
        participant_id = packet.get("participant_id", "unknown")
        logger.info(f"Procesando mensaje de {participant_id}")
        # --- fin lógica ---
        message.ack()
    except Exception as e:
        logger.error(f"Error procesando mensaje: {e}")
        message.nack()  # Pub/Sub reintentará el mensaje
```

## Pub/Sub Publishers
```python
def publish_event(topic: str, payload: dict):
    try:
        topic_path = publisher.topic_path(PROJECT_ID, topic)
        future = publisher.publish(topic_path, json.dumps(payload).encode("utf-8"))
        future.result()  # bloquear para confirmar entrega
        logger.info(f"Publicado en {topic}")
    except Exception as e:
        logger.error(f"Error publicando en {topic}: {e}")
        raise
```

## Respuestas de API
```python
# Éxito con datos
return {"status": "success", "data": datos, "count": len(datos)}

# Éxito sin datos
return {"status": "success", "id": nuevo_id}

# Error (usar HTTPException, no dict)
raise HTTPException(status_code=400, detail="Descripción del error")
```

## Frontend JavaScript — Llamadas API
```javascript
// GET
const data = await api('/admin/endpoint');

// POST con JSON
const res = await api('/admin/endpoint', {
    method: 'POST',
    body: JSON.stringify({ param: valor })
});

// POST con FormData
const form = new FormData();
form.append('campo', valor);
const res = await fetch('/admin/endpoint', { method: 'POST', body: form });
const data = await res.json();

// Feedback al usuario
if (res.status === 'success') {
    toast('Operación exitosa');
} else {
    toast('Error: ' + (res.detail || 'Desconocido'));
}
```

## Logging
```python
import logging
logger = logging.getLogger(__name__)

# Niveles
logger.info(f"Acción completada: {descripcion}")
logger.warning(f"Situación no crítica: {detalle}")
logger.error(f"Error en función X: {e}")
```
