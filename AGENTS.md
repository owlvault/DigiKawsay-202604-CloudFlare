# DigiKawsay — Reglas para Agentes de Código

## Principios de Implementación
1. Lee los archivos relevantes antes de modificarlos. Nunca asumir su contenido.
2. Mantén el patrón existente del archivo que modificas. No introduzcas nuevas abstracciones sin necesidad explícita.
3. Cada tarea produce un cambio atómico y verificable. Si requiere >6 archivos, subdivide.
4. Antes de crear un archivo nuevo, verifica que no exista uno similar con `Glob`.
5. Las migraciones de BD van en `infra/migrations/`. Nunca modificar `infra/db_init.sql` directamente.

## Proceso Obligatorio por Tarea
1. Leer los archivos en scope antes de proponer cambios
2. Identificar qué patrón existente aplica (DB, Pub/Sub, endpoint, frontend)
3. Implementar siguiendo ese patrón
4. Verificar que código relacionado existente no se rompe

## Restricciones de Seguridad
- NUNCA usar f-strings para construir SQL — siempre usar parámetros `%s`
- NUNCA omitir `consent_given` check en flujos de participantes
- NUNCA exponer participant_id en contextos multi-participante
- NUNCA commitear secrets o credenciales

## Gestión de Dependencias
- Nuevas dependencias Python: añadir a `requirements.txt` del microservicio específico
- No añadir dependencias globales entre microservicios
- Verificar que el paquete ya no esté instalado antes de añadirlo

## Compatibilidad de Schemas
- Al añadir columnas a tablas existentes: siempre con `DEFAULT` para no romper registros históricos
- Al cambiar el schema de un mensaje Pub/Sub: actualizar TODOS los servicios consumidores
- Al añadir endpoints FastAPI: seguir el patrón de `get_db()` existente en `agente00-service/main.py`
