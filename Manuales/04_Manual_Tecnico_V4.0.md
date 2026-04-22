# DigiKawsay: Manual Técnico y de Arquitectura (v4.0)

## 1. Arquitectura del Sistema (Híbrida/Microservicios)

DigiKawsay **v4.0** implementa un diseño robusto basado en microservicios en Python 3.11, orquestación local con Docker Compose, y una topología de mensajería asíncrona mediante Google Cloud Pub/Sub. Conservamos también una rama (MVP) en entorno Cloudflare Workers para instancias ligeras aisladas.

### Componentes Core de Infraestructura
- **PostgreSQL 15:** Persistencia relacional primaria (proyectos, participantes, turnos de diálogo, directivas del facilitador y métricas del flywheel).
- **Weaviate:** Base de datos vectorial estelar. Permite búsquedas semánticas y embeddings en tiempo real, habilitando el núcleo conceptual de *El Espejo*.
- **Google Cloud Pub/Sub:** Actúa como el sistema nervioso central. Desacopla la ingesta de webhooks en Telegram de la pesada carga cognitiva de la inferencia.
- **FastAPI:** Motor asíncrono que expone la RestAPI interna en el Agente-00 (Puerto 8002) y sirve las interfaces HTML puras.
- **LangGraph & Google GenAI:** El tejido celular que rige a `VAL`, manejando estado (`DigiKawsayState`) y flujos cíclicos de conversación. `gemini-2.5-flash` es el cerebro subyacente determinista rápido.

## 2. Mapa de Microservicios

La topología nativa está dividida en 5 nodos lógicos dentro de la carpeta `src/`.

1. **`channel-layer/` (Puerto 8080):** 
   - Endpoint público expuesto. Intercepta los webhooks de Telegram de manera síncrona. Valida firmas rápidas y deposita el payload completo de chat en Pub/Sub (`iap.channel.inbound`) devolviendo un `HTTP 200` casi inmediato a Telegram.
2. **`preprocessor/`:**
   - Carga el input crudo. Aplica el PII-Stripper (anonimización de nombres corporativos o cédulas), procesa el Embedding vectorial profundo y lo persiste permanentemente en Weaviate antes de empujar el paquete sanitizado hacia `VAL`.
3. **`val-service/`:** 
   - El ente sentipensante principal (LangGraph). Escucha mensajes pulidos. Activa un nodo de IA para leer el `VAL_BASE_PROMPT`. Busca divergencias en Weaviate mediante `espejo.py` para devolverlas al usuario si corresponde. 
4. **`ag-05-service/` (Metodólogo):**
   - Agente secundario especializado en análisis cualitativo Falsbordiano ("Swarm Analytics"). Evalúa latencias de poder y estructuras opresivas organizacionales por cada interacción o consolidado métrico.
5. **`agente00-service/` (Gateway / Puerto 8002):**
   - Panel de control de administrador (`/admin`). Permite a los investigadores ejecutar scripts Wizard of Oz (WoZ), visualizar dashboards en crudo HTML, e interactuar directo con PostgreSQL ignorando flujos asíncronos para tareas de escritura forzada.

### Edge MVP Opcional
Como legado transicional ágil y rápido, vive en `src/worker-digikawsay/` una encarnación hecha en TypeScript + Hono.js para Cloudflare Workers. Usará Cloudflare D1 como persistencia ligera y no usa clústeres. 

## 3. Mapa de Mensajería Pub/Sub

```text
Telegram → channel-layer → [ iap.channel.inbound ]
                                    ↓
                             preprocessor (sub: preprocessor-inbound-sub)
                                    ↓
                         [ iap.val.packet ] (sub: val-packet-sub)
                                    ↓
                              val-service
                             ↙          ↘
          [ iap.channel.outbound ]    [ iap.val.to.ag00 ]
                       ↓                      ↓
               channel-layer            agente00-service
                       ↓                      
                   Telegram

[ iap.swarm.ag05 ] → ag05-swarm-sub → ag-05-service → [ iap.swarm.output ]
```

## 4. Estrictas Restricciones y Reglas de Desarrollo
Todo desarrollador contribuyente *debe* obedecer:
1. **Nunca compartir datos** o PII (Participant ID) cruzado entre el proyecto o en exposición a prompts ajenos.
2. **Consultas a DB seguras:** `psycopg2` siempre utilizando tuplas de argumentos `%s`. Las *f-strings* directas son fallas letales de seguridad.
3. El base prompt no debe tocarse en `graph.py` sin documentación exhaustiva en commits.
4. Las migraciones nuevas siempre van en `infra/migrations/` como `ALTER TABLE ADD COLUMN ... DEFAULT`. No adulterar archivos fundacionales como `db_init.sql` ya ejecutados.
