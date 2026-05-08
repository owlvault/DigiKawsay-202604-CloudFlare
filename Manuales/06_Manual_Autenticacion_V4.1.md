# DigiKawsay: Manual de Autenticación de Administradores (v4.2)

El panel de administración de DigiKawsay está protegido por un sistema de autenticación con múltiples capas: hashing PBKDF2 de contraseñas, cookies firmadas y protección contra fuerza bruta. Este manual cubre la configuración inicial, el login, la gestión de sesiones, los roles de administrador y las consideraciones de seguridad.

---

## 1. Modelo de roles

DigiKawsay implementa un sistema multi-tenant con tres roles de administrador:

| Rol | Nivel de acceso |
|---|---|
| **SUPERADMIN** | Acceso total: todos los proyectos, todos los tenants, panel de billing, dashboard de seguridad |
| **TENANT_ADMIN** | Todos los proyectos del tenant al que pertenece. Sin acceso a billing ni seguridad global |
| **PILOT_ADMIN** | Solo los proyectos asignados explícitamente en la tabla `admin_projects`. Sin acceso a billing ni seguridad |

El primer administrador creado siempre es SUPERADMIN y pertenece al tenant `digikawsay_global`.

---

## 2. Configuración inicial (Setup)

### 2.1 Primer acceso

La ruta `/admin/setup` solo está disponible cuando **no existe ningún administrador** en la base de datos:

```
https://TU_WORKER.workers.dev/admin/setup
```

Si ya existe al menos un administrador, esta ruta redirige automáticamente a `/admin/login`.

### 2.2 Crear el administrador raíz

Completa el formulario con:
- **Nombre de usuario:** identificador único, sin espacios
- **Contraseña:** mínimo 8 caracteres. Usa una contraseña fuerte (≥ 16 caracteres recomendado)

Al enviar, el sistema:
1. Verifica que el nombre de usuario no exista en `administrators`
2. Crea el tenant `digikawsay_global` si no existe
3. Genera un hash PBKDF2 de la contraseña (ver sección 5)
4. Inserta el administrador con rol `SUPERADMIN` y `tenant_id = 'digikawsay_global'`
5. Redirige al login

> **Guarda tu contraseña.** No hay mecanismo de recuperación automática. Si la olvidas, debes resetearla manualmente (ver sección 7).

---

## 3. Login

```
https://TU_WORKER.workers.dev/admin/login
```

### 3.1 Proceso de autenticación

1. Ingresa tu nombre de usuario y contraseña
2. El sistema verifica primero si el usuario no está bloqueado por fuerza bruta (máximo 5 intentos fallidos en 15 minutos)
3. Si no está bloqueado, busca el administrador en D1 y verifica la contraseña:
   - **Contraseñas nuevas (PBKDF2):** reconstruye el hash con el salt almacenado y compara
   - **Contraseñas legacy (SHA-256):** verifica con el SALT fijo (compatibilidad hacia atrás)
4. La comparación es siempre **timing-safe** (resistente a timing attacks)
5. Si es válido, crea una cookie firmada `dk_session` y redirige a `/admin/lobby`
6. Si falla, registra el intento en `security_events` y redirige a `/admin/login?error=1`

### 3.2 Cookie de sesión

| Atributo | Valor |
|---|---|
| Nombre | `dk_session` |
| Contenido | nombre de usuario (firmado con GEMINI_API_KEY) |
| HttpOnly | Sí — no accesible desde JavaScript |
| SameSite | **Strict** — protección CSRF fuerte |
| Secure | **true** — solo HTTPS |
| MaxAge | 7 días (604800 segundos) |

La firma usa `GEMINI_API_KEY` como secret (fallback a `'digi_secret'` si la variable no existe, para desarrollo local). Si alguien manipula el valor de la cookie, la firma es inválida y la sesión se rechaza automáticamente.

---

## 4. Middleware de protección

Todas las rutas `/admin/*` (excepto las de autenticación) verifican la cookie antes de procesar:

```
Solicitud a /admin/*
  → ¿Es ruta de auth (/admin/login, /admin/login_web, /admin/setup, /admin/setup_web)?
      Sí → continúa sin verificar
      No → ¿Existen administradores en D1?
              No → redirect a /admin/setup
              Sí → ¿Existe cookie dk_session válida?
                       No → redirect a /admin/login
                       Sí → ¿Existe el usuario en D1?
                                No → redirect a /admin/logout (sesión huérfana)
                                Sí → inyectar adminUser en contexto → continuar
```

Rutas exclusivas por rol:
- `/admin/billing` — solo SUPERADMIN (devuelve 403 si otro rol intenta acceder)
- `/admin/security` — solo SUPERADMIN (redirect a `/admin/lobby` si otro rol)

---

## 5. Hashing de contraseñas (PBKDF2)

### 5.1 Algoritmo actual

Las contraseñas nuevas usan **PBKDF2 con salt aleatorio por contraseña**:

```typescript
// Genera una contraseña hasheada
async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  // PBKDF2: 100,000 iteraciones, SHA-256, 256 bits
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return `${saltHex}:${hashHex}`;  // formato: "saltHex:hashHex"
}
```

El hash almacenado en D1 tiene el formato `saltHex:hashHex` (64 chars + colon + 64 chars = 129 chars total).

### 5.2 Compatibilidad legacy (SHA-256)

Contraseñas creadas en v4.1 o anterior usan SHA-256 con salt fijo:
```
SHA-256("digikawsay_edge_salt_v1" + password)
```

El sistema detecta automáticamente el formato: si el hash almacenado contiene `:`, usa PBKDF2; si no, usa el verificador legacy. Los administradores legacy siguen funcionando pero se recomienda que actualicen su contraseña para migrar al formato seguro.

### 5.3 Migrar una contraseña legacy

La forma más sencilla es usar el endpoint de setup temporalmente (eliminar el admin y recrearlo). O bien insertar directamente con un hash calculado en Node.js:

```javascript
// Calcular hash PBKDF2 en Node.js (para insert manual en D1)
const crypto = require('crypto');
function hashPasswordSync(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}
console.log(hashPasswordSync('mi_nueva_contrasena'));
```

```bash
npx wrangler d1 execute digikawsay-d1 --remote \
  --command "UPDATE administrators SET password_hash = 'HASH_CALCULADO' WHERE username = 'mi_usuario'"
```

---

## 6. Logout

```
https://TU_WORKER.workers.dev/admin/logout
```

Borra la cookie `dk_session` del navegador y redirige al login. No hay invalidación server-side — la cookie simplemente deja de existir en el cliente.

---

## 7. Gestión de administradores adicionales

La versión actual no expone un panel de gestión de usuarios en la UI. Las opciones son:

### Opción A — Usar /admin/setup temporalmente (recomendado)

1. Hacer backup de los administradores existentes:
   ```bash
   npx wrangler d1 execute digikawsay-d1 --remote \
     --command "SELECT * FROM administrators"
   ```
2. Eliminar un administrador para habilitar /admin/setup:
   ```bash
   npx wrangler d1 execute digikawsay-d1 --remote \
     --command "DELETE FROM administrators WHERE username = 'admin_temporal'"
   ```
3. Usar `/admin/setup` para crear el nuevo usuario con PBKDF2
4. Actualizar el rol si aplica (ver Opción B)

### Opción B — Insert directo en D1

Genera el hash desde Node.js (ver sección 5.3) y luego:

```bash
npx wrangler d1 execute digikawsay-d1 --remote \
  --command "INSERT INTO administrators (admin_id, tenant_id, username, password_hash, role)
             VALUES (hex(randomblob(16)), 'digikawsay_global', 'nuevo_admin', 'HASH_CALCULADO', 'TENANT_ADMIN')"
```

Para crear un PILOT_ADMIN con acceso a proyectos específicos:
```bash
# 1. Crear el admin
npx wrangler d1 execute digikawsay-d1 --remote \
  --command "INSERT INTO administrators (admin_id, tenant_id, username, password_hash, role)
             VALUES ('admin-uuid', 'digikawsay_global', 'pilot_admin', 'HASH', 'PILOT_ADMIN')"

# 2. Asignar proyectos
npx wrangler d1 execute digikawsay-d1 --remote \
  --command "INSERT INTO admin_projects (admin_id, project_id) VALUES ('admin-uuid', 'project-uuid')"
```

---

## 8. Reset de contraseña

No existe pantalla de recuperación. El proceso manual es:

1. Calcular el nuevo hash (ver sección 5.3)
2. Actualizar en D1:
   ```bash
   npx wrangler d1 execute digikawsay-d1 --remote \
     --command "UPDATE administrators SET password_hash = 'NUEVO_HASH' WHERE username = 'tu_usuario'"
   ```

---

## 9. Protección anti-fuerza-bruta

El sistema registra todos los intentos fallidos de login en `security_events` con `event_type = 'AUTH_FAILURE'`.

**Reglas:**
- **5 intentos fallidos** para el mismo username en **15 minutos** → bloqueo temporal
- Tras el bloqueo, todos los intentos de ese username retornan error sin procesar la contraseña
- El bloqueo se libera automáticamente al expirar la ventana de 15 minutos

**Logs generados:**
- `AUTH_FAILURE` (severity: MEDIUM) — credenciales incorrectas
- `AUTH_LOCKOUT` (severity: HIGH) — intento durante bloqueo activo

Estos eventos son visibles en el Dashboard de Seguridad (`/admin/security`) para SUPERADMIN.

**Recomendación adicional:** Para entornos de producción, considera activar **Cloudflare Rate Limiting** en la ruta `/admin/login_web` desde el dashboard de Cloudflare (sin cambios de código). Esto añade una capa de protección a nivel de red antes de que los requests lleguen al worker.

---

## 10. Consideraciones de seguridad

### COOKIE_SECRET / GEMINI_API_KEY como secret de firma

El worker usa `GEMINI_API_KEY` como secret para firmar las cookies (con fallback a `COOKIE_SECRET` si la variable no existe, o `'digi_secret'` para desarrollo). En producción, el GEMINI_API_KEY actúa como secret implícito — si se rota la API key, **todas las sesiones activas quedan invalidadas automáticamente** (las cookies antiguas fallan la verificación de firma).

Para rotar el secret de sesión sin afectar la API key:
1. Asegurar que `COOKIE_SECRET` esté configurado como secret independiente
2. Actualizar `src/index.tsx` para usar `c.env.COOKIE_SECRET || c.env.GEMINI_API_KEY || 'digi_secret'`
3. Redesplegar

### Fortaleza del hashing
PBKDF2 con 100,000 iteraciones y salt aleatorio por contraseña es adecuado para producción en entornos de acceso restringido. El salt aleatorio previene ataques de tabla arco iris. La comparación timing-safe previene ataques de canal lateral.

### Acceso al panel admin
El panel admin expone historiales de conversación y datos de analítica sensibles. No compartir credenciales con participantes del piloto. Los PILOT_ADMIN solo deben tener acceso a los proyectos que necesitan gestionar.

### Seguridad de Telegram
El secret de webhook (`WEBHOOK_SECRET`) valida que los mensajes provienen genuinamente de Telegram y no de un actor malicioso que conoce la URL del worker. Se recomienda siempre configurarlo en producción.
