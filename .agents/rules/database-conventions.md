# Reglas: Convenciones de Base de Datos

## Migraciones
- Toda migración nueva va en `infra/migrations/NNN_descripcion.sql`
- Formato de nombre: número de 3 dígitos + guión bajo + descripción snake_case
  - Ejemplo: `001_swarm_insights.sql`, `002_project_type.sql`
- Crear el directorio `infra/migrations/` si no existe
- NUNCA modificar `infra/db_init.sql` para cambios posteriores a la instalación inicial

## DDL Seguro
```sql
-- Tablas nuevas: siempre IF NOT EXISTS
CREATE TABLE IF NOT EXISTS nueva_tabla (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Columnas nuevas: siempre con DEFAULT para no romper registros existentes
ALTER TABLE tabla_existente ADD COLUMN IF NOT EXISTS
    nueva_columna TEXT DEFAULT 'valor_default';

-- Índices: siempre IF NOT EXISTS
CREATE INDEX IF NOT EXISTS idx_tabla_columna ON tabla_existente(columna);
```

## Consultas
```python
# CORRECTO — parámetros posicionales
cur.execute("SELECT * FROM tabla WHERE id = %s AND status = %s", (id_val, status_val))

# INCORRECTO — nunca hacer esto
cur.execute(f"SELECT * FROM tabla WHERE id = '{id_val}'")  # SQL injection

# Arrays PostgreSQL
cur.execute("UPDATE tabla SET arr = %s WHERE id = %s", (["a", "b"], id_val))
# Para concatenar arrays: arr = arr || %s::text[]
```

## Tipos PostgreSQL Usados en el Proyecto
- UUID: `gen_random_uuid()` para IDs generados
- TEXT: strings (participant_id, project_id como string, contenidos)
- UUID: project_id nativo en tabla projects
- TEXT[]: arrays de strings (topics_covered, saberes_detectados)
- JSONB: payloads flexibles (raw_payload en swarm_insights)
- FLOAT: scores (momentum_score, sentipensar_score)
- BOOLEAN: flags (consent_given, safe_harbor_active)
- TIMESTAMPTZ: timestamps (created_at, updated_at, applied_at)

## Conexión
```python
# Patrón estándar del proyecto
import psycopg2
from psycopg2.extras import RealDictCursor

def get_db():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

def mi_query(param):
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute("...", (param,))
        result = cur.fetchall()
        conn.commit()  # solo si hay INSERT/UPDATE/DELETE
        return [dict(r) for r in result]
    except Exception as e:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()
```
