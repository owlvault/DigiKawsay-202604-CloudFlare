# DigiKawsay: Manual de Autenticación de Administradores (v4.1)

El panel de administración de DigiKawsay está protegido por un sistema de autenticación basado en cookies firmadas. Este manual cubre la configuración inicial, el login, la gestión de sesiones y las consideraciones de seguridad.

---

## 1. Configuración inicial (Setup)

### 1.1 Primer acceso

La ruta `/admin/setup` solo está disponible cuando **no existe ningún administrador** en la base de datos. Es el punto de entrada para inicializar el sistema por primera vez.

```
https://TU_WORKER.workers.dev/admin/setup
```

Si ya existe al menos un administrador, esta ruta redirige automáticamente a `/admin/login`. No es posible crear administradores adicionales por esta vía (ver sección 5).

### 1.2 Crear el administrador raíz

Completa el formulario con:
- **Nombre de usuario:** identificador único (ej. `investigador_principal`). No se permiten espacios.
- **Contraseña:** mínimo 8 caracteres. Usa una contraseña fuerte.

Al enviar, el sistema:
1. Verifica que el nombre de usuario no exista en la tabla `administrators`
2. Calcula `SHA-256(SALT + contraseña)` donde `SALT = "digikawsay_edge_salt_v1"`
3. Inserta el registro en `administrators` con el hash
4. Redirige al login

> **Guarda tu contraseña.** No hay mecanismo de recuperación automática. Si la olvidas, debes resetearla manualmente (ver sección 6).

---

## 2. Login

```
https://TU_WORKER.workers.dev/admin/login
```

### 2.1 Proceso de autenticación

1. Ingresa tu nombre de usuario y contraseña
2. El sistema calcula `SHA-256(SALT + contraseña_ingresada)` y lo compara con el hash almacenado en D1
3. Si coincide, crea una **cookie firmada** (`dk_session`) con tu nombre de usuario
4. Redirige a `/admin/lobby`

Si las credenciales son incorrectas, redirige a `/admin/login?error=1` mostrando un mensaje de error.

### 2.2 Cookie de sesión

| Atributo | Valor |
|---|---|
| Nombre | `dk_session` |
| Contenido | nombre de usuario (firmado con COOKIE_SECRET) |
| HttpOnly | Sí — no accesible desde JavaScript |
| SameSite | Lax — protección CSRF básica |
| Path | `/` |
| Expiración | Sesión del navegador (se mantiene mientras el tab esté abierto) |

La firma usa el secret `COOKIE_SECRET` configurado en Cloudflare. Si alguien manipula el valor de la cookie, la firma es inválida y la sesión se rechaza.

---

## 3. Middleware de protección

Todas las rutas `/admin/*` (excepto las de autenticación) verifican la cookie antes de procesar la solicitud:

```
Solicitud a /admin/* 
  → ¿Es /admin/login, /admin/login_web, /admin/setup, /admin/setup_web?
      Sí → continúa sin verificar
      No → ¿Existe cookie dk_session válida?
               Sí → continúa
               No → redirect a /admin/login
```

Si la cookie fue modificada o el `COOKIE_SECRET` cambió, la verificación falla y la sesión se invalida.

---

## 4. Logout

```
https://TU_WORKER.workers.dev/admin/logout
```

Borra la cookie `dk_session` del navegador y redirige a `/admin/login`. La sesión queda invalidada inmediatamente para ese navegador. No hay invalidación server-side (la cookie simplemente deja de existir).

---

## 5. Gestión de administradores adicionales

La versión actual soporta **múltiples administradores** en la tabla `administrators`, pero no expone un panel de gestión de usuarios. Para agregar administradores adicionales, hay dos opciones:

### Opción A — Comando D1 directo (recomendado para equipos técnicos)

Calcular el hash manualmente no es trivial (requiere el SALT exacto). La forma más segura es usar el endpoint de setup temporalmente:

1. Borrar todos los administradores existentes (con backup previo):
   ```bash
   npx wrangler d1 execute digikawsay-d1 --remote \
     --command "SELECT * FROM administrators"
   # Guarda los datos antes de continuar
   ```
2. Eliminar un administrador para habilitar /admin/setup:
   ```bash
   # Solo si es seguro hacerlo
   npx wrangler d1 execute digikawsay-d1 --remote \
     --command "DELETE FROM administrators WHERE username = 'user_to_replace'"
   ```
3. Usar `/admin/setup` para crear el nuevo usuario
4. Restaurar administradores borrados si aplica

### Opción B — Insert directo con hash precalculado

Si tienes acceso al entorno de desarrollo, puedes calcular el hash:
```javascript
// En Node.js
const crypto = require('crypto');
const SALT = 'digikawsay_edge_salt_v1';
const hash = crypto.createHash('sha256').update(SALT + 'mi_contraseña').digest('hex');
console.log(hash);
```

Luego insertar directamente:
```bash
npx wrangler d1 execute digikawsay-d1 --remote \
  --command "INSERT INTO administrators (admin_id, username, password_hash, role) VALUES (lower(hex(randomblob(16))), 'nuevo_admin', 'HASH_CALCULADO', 'admin')"
```

---

## 6. Reset de contraseña

No existe pantalla de recuperación. El proceso manual es:

1. Calcular el nuevo hash (ver Opción B de la sección anterior)
2. Actualizar en D1:
   ```bash
   npx wrangler d1 execute digikawsay-d1 --remote \
     --command "UPDATE administrators SET password_hash = 'NUEVO_HASH' WHERE username = 'tu_usuario'"
   ```

---

## 7. Consideraciones de seguridad

### COOKIE_SECRET
El secret que firma las cookies es crítico. Si se compromete:
1. Generar un nuevo secret aleatorio: `openssl rand -hex 32`
2. Actualizar en Cloudflare: `npx wrangler secret put COOKIE_SECRET`
3. Redesplegar: `npm run deploy`
4. Todas las sesiones activas quedan invalidadas automáticamente (las cookies antiguas fallan la verificación de firma)

### Fortaleza del hash
El sistema usa SHA-256 con un salt fijo (`digikawsay_edge_salt_v1`). Esto es adecuado para un MVP de acceso restringido. Para producción a escala se recomienda migrar a `bcrypt` o `Argon2` (requiere Workers-compatible library).

### Ataques de fuerza bruta
La versión actual no implementa rate limiting en el endpoint de login. Para mitigar ataques de fuerza bruta:
- Usa una contraseña larga (≥ 16 caracteres, aleatoria)
- Considera activar Cloudflare Rate Limiting en la ruta `/admin/login_web` desde el dashboard de Cloudflare (sin cambios de código)

### Acceso al panel admin
El panel admin es acceso restringido para el equipo de investigación. No compartir credenciales con participantes del piloto. El panel expone historiales de conversación y datos de analítica.
