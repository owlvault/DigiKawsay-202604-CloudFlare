# Skill: VAL Service

## Propósito
Agente conversacional LangGraph que mantiene diálogos 1:1 con participantes via Telegram.
Escucha mensajes via Pub/Sub, genera respuestas con Gemini, persiste turnos en PostgreSQL,
activa El Espejo cada 3 turnos, y notifica métricas a AGENTE-00.

## Archivos del servicio
```
src/val-service/
├── main.py      — Pub/Sub subscriber principal, orquestador del ciclo de turno
├── graph.py     — LangGraph: val_node, custom_tool_node, tools, VAL_BASE_PROMPT
├── state.py     — TypedDicts: DigiKawsayState, DialogueState, ConversationDirective
├── espejo.py    — Algoritmo El Espejo: get_espejo(), format_espejo_for_val()
└── requirements.txt
```

## Cómo levantar el servicio
```bash
cd src/val-service
pip install -r requirements.txt
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/digikawsay" \
WEAVIATE_URL="http://localhost:8080" \
GEMINI_API_KEY="tu_key" \
GCP_PROJECT_ID="digikawsay" \
python main.py
```

## Estructura del ciclo de turno (main.py: process_dialogue_packet)
```
1. Leer seed_prompt del proyecto desde DB (_load_project_context)
2. Leer directivas WoZ pendientes desde DB (_load_pending_directives)
3. Construir system prompt dinámico (_build_system_prompt en graph.py)
4. Invocar LangGraph app.invoke(input_data, config)
5. Extraer respuesta + metadata de emoción y speech_act
6. Persistir turno en dialogue_turns + dialogue_states (_persist_turn)
7. Publicar respuesta al participante (iap.channel.outbound)
8. Cada 3 turnos: activar El Espejo (espejo.py)
9. Notificar a AG-00 (iap.val.to.ag00): TURN_COMPLETED con métricas
10. Marcar directivas como APPLIED (_mark_directives_applied)
```

## LangGraph (graph.py)
```python
# Grafo: START → val_agent → [si hay tool calls] → tools → val_agent → END
# val_node: invoca LLM con system prompt + mensajes → genera respuesta
# custom_tool_node: ejecuta herramientas y actualiza dialogue_states

# Herramientas disponibles (se invocan automáticamente por el LLM):
# - detect_emotion(emotion: str) → actualiza dialogue_states.emotional_register
# - classify_speech_act(classification: str) → añade a dialogue_states.topics_covered
# - apply_and_clear_directive(applied_directive_summary: str) → limpia expert_directives
```

## System Prompt (graph.py:86 — VAL_BASE_PROMPT)
NUNCA modificar directamente. Si se necesita ajustar comportamiento de VAL:
1. Crear una variable nueva con el cambio propuesto
2. Documentar la razón del cambio como comentario con fecha
3. Hacer el cambio de forma aditiva (añadir sección, no reemplazar reglas)

## El Espejo (espejo.py)
```python
# Se activa en main.py cuando: turn_count >= 3 AND turn_count % 3 == 0
# Requiere: al menos 3 fragmentos de OTROS participantes en Weaviate
# Devuelve: 2 convergencias + 1 divergencia como texto formateado Markdown
# Falla silenciosamente si Weaviate no disponible
```

## Añadir una nueva herramienta LangGraph (graph.py)
```python
@tool
def nueva_herramienta(parametro: str) -> str:
    """Descripción de la herramienta — el LLM usa esto para decidir cuándo invocarla."""
    return f"Resultado registrado: {parametro}"

# Añadir a la lista:
tools = [classify_speech_act, detect_emotion, apply_and_clear_directive, nueva_herramienta]

# En custom_tool_node, añadir el caso:
elif tool_name == "nueva_herramienta":
    valor = tool_args.get("parametro", "")
    current_dstate["nuevo_campo"] = valor
    state_changed = True
```

## Añadir un campo nuevo a DigiKawsayState (state.py)
```python
class DigiKawsayState(TypedDict):
    # ... campos existentes ...
    nuevo_campo: Optional[str]  # descripción del propósito
```

## Mensaje de contingencia
Definido en main.py:29 como `CONTINGENCY_MESSAGE`. Se envía cuando hay error de cuota (429)
o autenticación (403) de la API de Gemini. No modificar sin considerar el impacto en UX.
