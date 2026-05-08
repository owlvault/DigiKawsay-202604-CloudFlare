# DigiKawsay: Manual de Billing y Multi-Tenant (v4.2)

Este manual documenta la arquitectura multi-tenant de DigiKawsay, el sistema de control de cuotas de tokens, el panel de billing y las operaciones de gestión de tenants. Está dirigido a SUPERADMIN y administradores de cuenta.

---

## 1. Arquitectura multi-tenant

### 1.1 Modelo de datos

```
tenants (tenant_id, name)
    │
    ├── administrators (role: SUPERADMIN/TENANT_ADMIN/PILOT_ADMIN)
    │
    ├── projects (project_id, name, seed_prompt, ...)
    │       └── participants / dialogue_turns / wizard_directives / ...
    │
    └── tenant_quotas (max_tokens_monthly, used_tokens_monthly, cutoff_active)
```

Cada tenant tiene:
- Sus propios administradores con roles
- Sus propios proyectos con participantes completamente aislados
- Su propia cuota mensual de tokens

### 1.2 Aislamiento de datos

Un TENANT_ADMIN solo ve proyectos donde `project.tenant_id = admin.tenant_id`. Un PILOT_ADMIN solo ve proyectos listados en la tabla `admin_projects`. La función `getAdminProjectFilter(adminUser)` implementa este aislamiento dinámicamente en todas las consultas.

### 1.3 Tenant por defecto

El primer administrador se crea con el tenant `digikawsay_global`. Este tenant es el "tenant raíz" del sistema. El SUPERADMIN que pertenece a este tenant puede ver y gestionar todos los tenants.

---

## 2. Sistema de cuotas de tokens

### 2.1 Dos niveles de cuota

| Nivel | Tabla | Granularidad | Quién puede modificarla |
|---|---|---|---|
| **Tenant** | `tenant_quotas` | Mensual (se resetea por fecha) | SUPERADMIN |
| **Proyecto** | `project_quotas` | Total acumulado (sin reset) | SUPERADMIN |

Ambos niveles se verifican en cada ciclo de conversación. El acceso se bloquea si **cualquiera** de los dos supera su límite.

### 2.2 Valores por defecto

| Nivel | Cuota por defecto |
|---|---|
| Tenant | 1,000,000 tokens mensuales |
| Proyecto | 500,000 tokens totales |

Estos valores se crean automáticamente la primera vez que un proyecto/tenant registra uso. No es necesario pre-configurarlos.

### 2.3 Flujo de verificación de quota

```typescript
async function checkQuota(db, tenantId, projectId): Promise<boolean> {
  // Verificar tenant
  const tq = await db.prepare(
    `SELECT max_tokens_monthly, used_tokens_monthly, cutoff_active
     FROM tenant_quotas WHERE tenant_id = ?`
  ).bind(tenantId).first();
  if (tq && (tq.cutoff_active === 1 || tq.used_tokens_monthly >= tq.max_tokens_monthly)) return false;

  // Verificar proyecto
  const pq = await db.prepare(
    `SELECT max_tokens, used_tokens, cutoff_active
     FROM project_quotas WHERE project_id = ?`
  ).bind(projectId).first();
  if (pq && (pq.cutoff_active === 1 || pq.used_tokens >= pq.max_tokens)) return false;

  return true;
}
```

Cuando `checkQuota` retorna `false`, el participante recibe:
> *"Mantenimiento temporal. Estaré disponible pronto."*

### 2.4 Registro de uso

Cada operación que consume tokens queda registrada en `usage_logs`:

| `operation_type` | Quién lo genera | Tokens típicos |
|---|---|---|
| `VAL_CYCLE` | Cada turno de conversación (VAL + clasificador) | 2,000-8,000 |
| `AG05_COPILOT` | AG-05 Co-piloto (cada ~4 turnos) | ~600 |
| `PROACTIVE_PUSH` | Push proactivo desde WoZ | ~3,000-6,000 |
| `NARRATIVE_SUMMARY` | Resumen narrativo (cada 4 turnos) | ~400 |
| `SYNTHESIS_REPORT` | Informe de síntesis completo del proyecto | 10,000-50,000 |

---

## 3. Panel de Billing (`/admin/billing`)

Accesible solo para SUPERADMIN en `https://TU_WORKER.workers.dev/admin/billing`.

### 3.1 Tabla de Tenants

Muestra para cada tenant:
- Nombre del tenant
- Tokens usados en el mes actual vs. cuota mensual
- Barra de progreso de uso
- Estado del cutoff (activo/inactivo)
- Formulario para ajustar cuota y activar/desactivar cutoff

### 3.2 Tabla de Proyectos

Muestra para cada proyecto:
- Nombre del proyecto y tenant al que pertenece
- Tokens usados totales vs. cuota del proyecto
- Barra de progreso
- Estado del cutoff
- Formulario para ajustar cuota y activar/desactivar cutoff

### 3.3 Logs de uso por operación

Tabla con el total de tokens consumidos y número de llamadas por tipo de operación:

| Operación | Tokens totales | # Llamadas |
|---|---|---|
| VAL_CYCLE | XXX,XXX | XXX |
| AG05_COPILOT | XX,XXX | XXX |
| ... | | |

---

## 4. Gestión de cuotas

### 4.1 Ajustar cuota de tenant (panel)

En el panel de billing, busca el tenant y usa el formulario de actualización:
- **Max tokens mensuales:** nuevo límite mensual
- **Cutoff activo:** checkbox para bloquear inmediatamente todas las conversaciones del tenant independientemente del uso (útil para mantenimiento o suspensión)

### 4.2 Ajustar cuota de proyecto (panel)

Similar al anterior, pero a nivel de proyecto individual.

### 4.3 Ajustar cuotas vía D1 (técnico)

```bash
# Ver uso actual por tenant
npx wrangler d1 execute digikawsay-d1 --remote \
  --command "SELECT t.name, tq.max_tokens_monthly, tq.used_tokens_monthly,
             ROUND(100.0 * tq.used_tokens_monthly / tq.max_tokens_monthly, 1) as pct_used
             FROM tenants t
             LEFT JOIN tenant_quotas tq ON t.tenant_id = tq.tenant_id"

# Resetear manualmente el contador de un tenant al inicio de mes
npx wrangler d1 execute digikawsay-d1 --remote \
  --command "UPDATE tenant_quotas SET used_tokens_monthly = 0 WHERE tenant_id = 'TENANT_ID'"

# Aumentar cuota de un proyecto específico
npx wrangler d1 execute digikawsay-d1 --remote \
  --command "UPDATE project_quotas SET max_tokens = 1000000 WHERE project_id = 'PROJECT_ID'"

# Desactivar cutoff de un tenant
npx wrangler d1 execute digikawsay-d1 --remote \
  --command "UPDATE tenant_quotas SET cutoff_active = 0 WHERE tenant_id = 'TENANT_ID'"
```

---

## 5. Creación de nuevos tenants y administradores

### 5.1 Crear un nuevo tenant

```bash
npx wrangler d1 execute digikawsay-d1 --remote \
  --command "INSERT INTO tenants (tenant_id, name) VALUES ('mi_org_2026', 'Mi Organización')"
```

### 5.2 Crear un TENANT_ADMIN para el nuevo tenant

1. Calcular el hash PBKDF2 en Node.js:
```javascript
const crypto = require('crypto');
const salt = crypto.randomBytes(16);
const hash = crypto.pbkdf2Sync('contraseña_segura', salt, 100000, 32, 'sha256');
const stored = `${salt.toString('hex')}:${hash.toString('hex')}`;
console.log(stored);
```

2. Insertar el administrador:
```bash
npx wrangler d1 execute digikawsay-d1 --remote \
  --command "INSERT INTO administrators (admin_id, tenant_id, username, password_hash, role)
             VALUES (hex(randomblob(16)), 'mi_org_2026', 'admin_morg', 'HASH_CALCULADO', 'TENANT_ADMIN')"
```

3. El TENANT_ADMIN puede hacer login en `/admin/login` y verá solo los proyectos de su tenant.

### 5.3 Crear un PILOT_ADMIN con acceso restringido

```bash
# 1. Crear el admin
npx wrangler d1 execute digikawsay-d1 --remote \
  --command "INSERT INTO administrators (admin_id, tenant_id, username, password_hash, role)
             VALUES ('pilot-admin-uuid', 'mi_org_2026', 'pilot_admin_ana', 'HASH', 'PILOT_ADMIN')"

# 2. Asignar proyectos específicos
npx wrangler d1 execute digikawsay-d1 --remote \
  --command "INSERT INTO admin_projects (admin_id, project_id) VALUES ('pilot-admin-uuid', 'project-uuid-1')"
npx wrangler d1 execute digikawsay-d1 --remote \
  --command "INSERT INTO admin_projects (admin_id, project_id) VALUES ('pilot-admin-uuid', 'project-uuid-2')"
```

---

## 6. Estimación de costos

Los tokens de Gemini 2.5-flash (al momento de la documentación) tienen un costo aproximado de $0.15 / 1M tokens de entrada y $0.60 / 1M tokens de salida.

### Estimación por piloto típico (10 participantes, 20 turnos c/u)

| Operación | Estimado de tokens | Costo estimado |
|---|---|---|
| VAL_CYCLE (200 turnos × 4,000 tok avg) | 800,000 | ~$0.50 |
| Clasificación semántica (200 × 300 tok) | 60,000 | ~$0.05 |
| AG05_COPILOT (~50 activaciones × 600 tok) | 30,000 | ~$0.02 |
| Memoria narrativa (~50 resúmenes × 400 tok) | 20,000 | ~$0.01 |
| Informe de síntesis (×1) | 20,000 | ~$0.01 |
| **Total estimado** | **~930,000 tokens** | **~$0.60** |

La cuota por defecto de 500,000 tokens por proyecto cubre un piloto estándar con margen. Para pilotos con más participantes o turnos más largos, considera aumentar la cuota de proyecto a 1,000,000 o 2,000,000 tokens.

---

## 7. Monitoreo de uso en producción

### Consultas útiles en D1

```bash
# Uso total por proyecto (ranking)
npx wrangler d1 execute digikawsay-d1 --remote \
  --command "SELECT p.name as proyecto, SUM(ul.tokens_total) as total_tokens,
             COUNT(*) as n_operaciones
             FROM usage_logs ul
             JOIN projects p ON ul.project_id = p.project_id
             GROUP BY ul.project_id
             ORDER BY total_tokens DESC"

# Uso por tipo de operación (últimos 7 días)
npx wrangler d1 execute digikawsay-d1 --remote \
  --command "SELECT operation_type, SUM(tokens_total) as tokens,
             COUNT(*) as calls, AVG(tokens_total) as avg_tokens
             FROM usage_logs
             WHERE timestamp > datetime('now', '-7 days')
             GROUP BY operation_type"

# Participantes más activos en un proyecto
npx wrangler d1 execute digikawsay-d1 --remote \
  --command "SELECT p.display_name, ds.turn_count,
             COUNT(dt.turn_id) as turns_with_tokens
             FROM participants p
             LEFT JOIN dialogue_states ds ON p.participant_id = ds.participant_id
             LEFT JOIN dialogue_turns dt ON p.participant_id = dt.participant_id
             WHERE p.project_id = 'TU_PROJECT_ID'
             GROUP BY p.participant_id
             ORDER BY turn_count DESC"
```

---

## 8. Cutoff automático y mensajes de mantenimiento

Cuando el cutoff se activa (automáticamente al superar cuota, o manualmente), todos los participantes activos que intenten enviar un mensaje recibirán:

> *"Mantenimiento temporal. Estaré disponible pronto."*

Este mensaje es neutral y no revela información sobre límites de tokens. El facilitador debe comunicar directamente a los participantes si el piloto está pausado temporalmente.

Para reactivar el acceso:
1. Aumentar la cuota en el panel de billing, o
2. Desactivar el cutoff manualmente con: `UPDATE tenant_quotas SET cutoff_active = 0 WHERE tenant_id = 'X'`
