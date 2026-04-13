---
name: phase2-system-metrics
description: Métricas de maduración del sistema — precisión de AG-05, efectividad de directivas, correlación del Espejo
tags: [phase2, metrics, flywheel, ag05, maturation]
---

# Tarea: Métricas de Maduración del Sistema

## Contexto
Después de ejecutar al menos 3 pilotos, los datos del flywheel permiten calcular
métricas de calidad del sistema. Esta tarea implementa:
1. Un endpoint de métricas de maduración en AGENTE-00
2. Una sección de "Salud del Sistema" en el panel (reemplaza el Math.random() actual)
3. Exportación de dataset de entrenamiento estructurado

**Prerequisito**: La migración 002_flywheel_schema.sql debe estar aplicada y al menos
1 piloto completado con anotaciones de facilitador.

## Archivos a modificar
- `src/agente00-service/main.py` — AÑADIR endpoints de métricas + exportación de dataset
- `src/agente00-service/static/dashboard.html` — MODIFICAR (reemplazar Math.random() con datos reales)

## Implementación

### Paso 1: Endpoint de métricas del sistema

En `src/agente00-service/main.py`, añadir:

```python
@app.get("/admin/system_metrics")
def get_system_metrics():
    """
    Calcula métricas de maduración del sistema a partir de los datos del flywheel.
    Requiere al menos 1 piloto con anotaciones de facilitador.
    """
    try:
        conn = get_db()
        cur = conn.cursor()

        # 1. Precisión de AG-05 (% de turnos donde el facilitador validó que fue correcto)
        cur.execute("""
            SELECT
                COUNT(*) FILTER (WHERE ag05_was_correct = TRUE) AS correct,
                COUNT(*) FILTER (WHERE ag05_was_correct IS NOT NULL) AS total_reviewed
            FROM facilitator_annotations
        """)
        acc_row = cur.fetchone()
        total_reviewed = acc_row["total_reviewed"] or 0
        ag05_precision = round(
            (acc_row["correct"] / total_reviewed * 100) if total_reviewed > 0 else 0, 1
        )

        # 2. Efectividad media de directivas WoZ
        cur.execute("""
            SELECT AVG(effectiveness_score) as avg_score,
                   COUNT(*) FILTER (WHERE effectiveness_score IS NOT NULL) as scored_count
            FROM wizard_directives
        """)
        dir_row = cur.fetchone()
        directive_effectiveness = round(float(dir_row["avg_score"] or 0), 2)

        # 3. Correlación del Espejo (% de pilotos donde se entregó al menos 1 Espejo)
        cur.execute("""
            SELECT
                COUNT(DISTINCT project_id) FILTER (
                    WHERE project_id IN (
                        SELECT DISTINCT project_id FROM dialogue_turns WHERE espejo_delivered = TRUE
                    )
                ) AS projects_with_espejo,
                COUNT(DISTINCT project_id) AS total_projects
            FROM projects WHERE closed_at IS NOT NULL
        """)
        esp_row = cur.fetchone()
        total_closed = esp_row["total_projects"] or 0
        espejo_coverage = round(
            (esp_row["projects_with_espejo"] / total_closed * 100) if total_closed > 0 else 0, 1
        )

        # 4. Saturación del corpus: promedio de fragmentos por piloto cerrado
        cur.execute("""
            SELECT AVG(turn_count) as avg_turns FROM (
                SELECT project_id, COUNT(*) as turn_count
                FROM dialogue_turns
                GROUP BY project_id
            ) sub
        """)
        sat_row = cur.fetchone()
        avg_corpus_size = round(float(sat_row["avg_turns"] or 0), 1)

        # 5. Proyectos activos vs. cerrados
        cur.execute("""
            SELECT
                COUNT(*) FILTER (WHERE closed_at IS NULL) AS active,
                COUNT(*) FILTER (WHERE closed_at IS NOT NULL) AS closed,
                COUNT(*) AS total
            FROM projects
        """)
        proj_row = cur.fetchone()

        # 6. Total de turnos y participantes
        cur.execute("SELECT COUNT(DISTINCT participant_id) AS participants FROM participants")
        part_row = cur.fetchone()

        cur.close()
        conn.close()

        return {
            "ag05_precision_pct": ag05_precision,
            "ag05_turns_reviewed": total_reviewed,
            "directive_effectiveness_avg": directive_effectiveness,
            "directive_scored_count": dir_row["scored_count"] or 0,
            "espejo_coverage_pct": espejo_coverage,
            "avg_corpus_size_turns": avg_corpus_size,
            "projects_active": proj_row["active"],
            "projects_closed": proj_row["closed"],
            "total_participants": part_row["participants"],
            "flywheel_ready": total_reviewed >= 50,  # umbral mínimo para usar datos
        }
    except Exception as e:
        logger.error(f"Error en system_metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

### Paso 2: Endpoint de exportación de dataset de entrenamiento

```python
@app.get("/admin/export_training_dataset/{project_id}")
def export_training_dataset(project_id: str):
    """
    Exporta el dataset de entrenamiento de un proyecto en formato estructurado.
    Incluye: texto original, análisis AG-05, correcciones del facilitador, contexto.
    Usar para fine-tuning o evaluación de modelos.
    """
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT
                dt.turn_id,
                dt.participant_id,
                dt.user_text,
                dt.emotional_register,
                dt.topics,
                dt.espejo_delivered,
                si.sentipensar_score,
                si.praxis_indicator,
                si.relational_parity,
                si.saberes_detectados,
                si.oppressive_structures,
                si.methodological_insight,
                fa.annotation_type,
                fa.label AS facilitator_label,
                fa.ag05_was_correct,
                fa.corrected_praxis,
                fa.corrected_emotion,
                dt.timestamp
            FROM dialogue_turns dt
            LEFT JOIN swarm_insights si ON dt.turn_id = si.turn_id AND si.agent_id = 'AG-05'
            LEFT JOIN facilitator_annotations fa ON dt.turn_id = fa.turn_id
            WHERE dt.project_id = %s
            ORDER BY dt.timestamp ASC
        """, (project_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()

        dataset = [dict(r) for r in rows]
        # Convertir tipos no serializables
        for row in dataset:
            if row.get("timestamp"):
                row["timestamp"] = row["timestamp"].isoformat()

        return {
            "project_id": project_id,
            "total_records": len(dataset),
            "schema_version": "2.0",
            "records": dataset
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### Paso 3: Corregir dashboard.html — reemplazar Math.random()

En `src/agente00-service/static/dashboard.html`, localizar la función que genera
el porcentaje de salud del sistema (aproximadamente línea 343 según el análisis).
Reemplazar el bloque `Math.random()` con una llamada real:

```javascript
// ANTES (eliminar):
// const healthPct = Math.floor(Math.random() * 30) + 70;

// DESPUÉS:
async function loadSystemHealth() {
    try {
        const metrics = await fetch('/admin/system_metrics').then(r => r.json());

        // Calcular salud como promedio ponderado de métricas clave
        const components = [];
        if (metrics.ag05_turns_reviewed > 0) {
            components.push(metrics.ag05_precision_pct);
        }
        if (metrics.directive_scored_count > 0) {
            components.push((metrics.directive_effectiveness_avg / 5) * 100);
        }
        components.push(metrics.espejo_coverage_pct);

        const healthPct = components.length > 0
            ? Math.round(components.reduce((a, b) => a + b, 0) / components.length)
            : null;

        // Actualizar UI
        const healthEl = document.getElementById('system-health-pct');
        if (healthEl) {
            healthEl.textContent = healthPct !== null ? `${healthPct}%` : 'Sin datos';
            healthEl.style.color = healthPct > 80 ? '#06d6a0' :
                                   healthPct > 60 ? '#ffd166' : '#ef476f';
        }

        // Actualizar otros KPIs del dashboard
        const kpis = {
            'kpi-active-projects': metrics.projects_active,
            'kpi-total-participants': metrics.total_participants,
            'kpi-ag05-precision': `${metrics.ag05_precision_pct}%`,
            'kpi-directive-effectiveness': metrics.directive_effectiveness_avg.toFixed(1),
        };
        Object.entries(kpis).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        });

    } catch (e) {
        console.warn('System metrics unavailable:', e);
    }
}

// Llamar al cargar el dashboard y cada 60 segundos
loadSystemHealth();
setInterval(loadSystemHealth, 60000);
```

También buscar y reemplazar cualquier dato hardcodeado en la sección "colmena" del dashboard:

```javascript
// Reemplazar HTML estático de estado de agentes con datos del health endpoint
async function loadSwarmStatus() {
    const services = [
        { id: 'val-service', label: 'VAL', port: null },
        { id: 'ag05-service', label: 'AG-05', url: '/admin/ag05_health' },
    ];
    // Por ahora, marcar como operational si el propio AGENTE-00 responde
    // (los demás servicios no tienen health check cross-service implementado aún)
    const container = document.getElementById('swarm-status-list');
    if (container) {
        container.innerHTML = services.map(s => `
            <div style="display:flex; justify-content:space-between; padding:8px 0;
                        border-bottom:1px solid var(--border);">
                <span>${s.label}</span>
                <span class="badge badge-active">operational</span>
            </div>
        `).join('');
    }
}
```

## Criterios de Éxito
1. `GET /admin/system_metrics` retorna un JSON con todos los campos documentados
2. `ag05_precision_pct` muestra el % real de turnos validados como correctos por el facilitador
3. El dashboard muestra el porcentaje de salud calculado desde datos reales (no Math.random())
4. `GET /admin/export_training_dataset/{project_id}` exporta todos los turnos con sus anotaciones
5. El campo `flywheel_ready: true` aparece cuando hay ≥ 50 turnos revisados

## Cómo verificar
```bash
# 1. Verificar métricas del sistema
curl http://localhost:8002/admin/system_metrics | python3 -m json.tool

# 2. Esperar output como:
# {
#   "ag05_precision_pct": 78.5,
#   "ag05_turns_reviewed": 23,
#   "directive_effectiveness_avg": 3.8,
#   "espejo_coverage_pct": 100.0,
#   "flywheel_ready": false,
#   ...
# }

# 3. Exportar dataset de entrenamiento
curl http://localhost:8002/admin/export_training_dataset/{project_id} \
  | python3 -m json.tool > /tmp/training_export.json

# 4. Verificar que el dashboard NO usa Math.random()
grep -n "Math.random" src/agente00-service/static/dashboard.html
# Debe retornar 0 resultados

# 5. Abrir dashboard en browser y verificar que el health % es estable entre recargas
open http://localhost:8002/admin
```

## Nota sobre datos mínimos para métricas significativas

| Métrica | Datos mínimos para ser significativa |
|---------|-------------------------------------|
| AG-05 precision | ≥ 50 turnos anotados por el facilitador |
| Directive effectiveness | ≥ 20 directivas con score |
| Espejo coverage | ≥ 3 pilotos cerrados |
| Corpus saturation | ≥ 5 pilotos con ≥ 15 turnos cada uno |

Antes de alcanzar estos umbrales, las métricas son indicativas pero no estadísticamente
robustas. El campo `flywheel_ready` en el endpoint lo indica.
