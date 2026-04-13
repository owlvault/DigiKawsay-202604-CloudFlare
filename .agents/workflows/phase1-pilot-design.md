---
name: phase1-pilot-design
description: Protocolo técnico para configurar y lanzar un piloto de alta calidad
tags: [phase1, pilot, seed-prompt, directives, facilitation]
---

# Tarea: Protocolo de Diseño de Piloto

## Contexto
Un piloto de alta calidad requiere más que levantar los servicios: necesita un
`seed_prompt` bien construido, una biblioteca de directivas de exploración temática,
y una guía de anotación para el facilitador. Esta tarea implementa las herramientas
de configuración en el panel y crea los templates reutilizables.

## Archivos a crear o modificar
- `src/agente00-service/static/panel.html` — MODIFICAR (sección de diseño de piloto)
- `src/agente00-service/main.py` — VERIFICAR endpoint POST /admin/projects acepta seed_prompt + project_type
- `src/agente00-service/static/directive_library.json` — CREAR (templates de directivas)
- `infra/seed_prompts/` — CREAR directorio con templates de seed_prompt por tipo

## Implementación

### Paso 1: Templates de Seed Prompt

Crear directorio `infra/seed_prompts/` con los siguientes archivos:

**`infra/seed_prompts/cultura_organizacional.txt`:**
```
Eres VAL, un facilitador de investigación organizacional.
Tu misión en esta conversación es explorar cómo {{NOMBRE_ORG}} toma decisiones,
comparte conocimiento, y enfrenta cambios — desde la perspectiva de {{NOMBRE_PARTICIPANTE}}.

Ejes de exploración prioritarios:
1. Flujos de información reales (vs. los formales)
2. Cómo se toman decisiones en la práctica cotidiana
3. Qué herramientas o procesos han surgido "por fuera" del sistema oficial
4. Momentos de orgullo y momentos de frustración en el trabajo colaborativo

Guía la conversación con curiosidad genuina. Escucha más de lo que preguntas.
```

**`infra/seed_prompts/transformacion_digital.txt`:**
```
Eres VAL, un facilitador de investigación sobre transformación digital.
Exploras cómo {{NOMBRE_ORG}} está viviendo el proceso de cambio tecnológico
desde la perspectiva de {{NOMBRE_PARTICIPANTE}}.

Ejes de exploración prioritarios:
1. Adopción real de herramientas digitales (brechas entre lo declarado y lo vivido)
2. Resistencias y miedos al cambio — ¿qué se pierde?
3. Innovaciones que el equipo ha generado por su cuenta (Shadow IT, workarounds)
4. Visión de futuro: ¿qué funcionaría mejor y cómo debería cambiar?

No asumas que la tecnología es neutral. Explora las implicaciones humanas.
```

**`infra/seed_prompts/investigacion_cualitativa.txt`:**
```
Eres VAL, un facilitador de investigación cualitativa.
Tu misión es explorar {{OBJETIVO_INVESTIGACION}} con {{NOMBRE_PARTICIPANTE}},
miembro de {{NOMBRE_ORG}}.

Ejes de exploración:
{{EJES_CUSTOM}}

Usa técnicas de entrevista en profundidad: paráfrasis, preguntas de contraste,
silencios estratégicos. El participante es el experto — tú eres el aprendiz curioso.
```

### Paso 2: Template de biblioteca de directivas

Crear `src/agente00-service/static/directive_library.json`:

```json
{
  "version": "1.0",
  "directives": {
    "CULTURA_ORGANIZACIONAL": [
      {
        "id": "CO-001",
        "type": "QUESTION",
        "urgency": "MEDIUM",
        "theme": "shadow_it",
        "content": "Explora si el participante usa herramientas no oficiales para resolver problemas cotidianos",
        "suggested_wording": "Me pregunto si hay formas creativas que el equipo ha encontrado para trabajar mejor..."
      },
      {
        "id": "CO-002",
        "type": "QUESTION",
        "urgency": "MEDIUM",
        "theme": "decision_making",
        "content": "Indaga el proceso real de toma de decisiones vs. el proceso formal declarado",
        "suggested_wording": "Cuando hay que tomar una decisión importante, ¿cómo sucede realmente?"
      },
      {
        "id": "CO-003",
        "type": "REFRAME",
        "urgency": "LOW",
        "theme": "power_structures",
        "content": "Reencuadra una queja como señal de un sistema con oportunidad de mejora",
        "suggested_wording": "Eso que describes como un problema podría ser también una señal de algo que el equipo necesita pero no tiene todavía..."
      },
      {
        "id": "CO-004",
        "type": "CHALLENGE",
        "urgency": "HIGH",
        "theme": "safe_harbor",
        "content": "Si detectas distress: suspende exploración, valida la experiencia del participante",
        "suggested_wording": "Lo que describes suena difícil. Antes de seguir, ¿cómo estás tú con todo esto?"
      }
    ],
    "TRANSFORMACION_DIGITAL": [
      {
        "id": "TD-001",
        "type": "QUESTION",
        "urgency": "MEDIUM",
        "theme": "adoption_gap",
        "content": "Explora la brecha entre las herramientas implementadas y las que realmente se usan",
        "suggested_wording": "De todo lo que se ha implementado digitalmente, ¿qué es lo que tu equipo realmente usa día a día?"
      },
      {
        "id": "TD-002",
        "type": "QUESTION",
        "urgency": "MEDIUM",
        "theme": "resistance",
        "content": "Explora qué se pierde con el cambio tecnológico (no solo lo que se gana)",
        "suggested_wording": "Con todos los cambios que han venido, ¿hay algo que sientes que se perdió en el camino?"
      },
      {
        "id": "TD-003",
        "type": "REFRAME",
        "urgency": "LOW",
        "theme": "workarounds",
        "content": "Reencuadra los workarounds como inteligencia colectiva, no como problema",
        "suggested_wording": "Me parece interesante eso que describes. Ese tipo de soluciones que el equipo inventa suelen esconder mucha inteligencia sobre lo que realmente se necesita..."
      }
    ]
  }
}
```

### Paso 3: Sección de Diseño de Piloto en el Panel

En `panel.html`, añadir nueva sección de configuración. En el sidebar:

```html
<div class="nav-item" onclick="showSection('design')">📋 Diseño de Piloto</div>
```

Sección HTML (después de `sec-setup`):

```html
<div id="sec-design" class="section">
    <h2 style="margin-bottom: 24px;">Diseño de Piloto</h2>

    <!-- Template selector -->
    <div class="card">
        <h3>1. Seleccionar Template de Investigación</h3>
        <div class="form-row">
            <label>Tipo de Investigación</label>
            <select id="design-type" onchange="loadSeedTemplate()">
                <option value="">— seleccionar —</option>
                <option value="CULTURA_ORGANIZACIONAL">Diagnóstico de Cultura Organizacional</option>
                <option value="TRANSFORMACION_DIGITAL">Transformación Digital</option>
                <option value="INVESTIGACION_CUALITATIVA">Investigación Cualitativa Custom</option>
            </select>
        </div>
        <div class="form-row">
            <label>Nombre de la Organización</label>
            <input id="design-org-name" placeholder="Ej: Cooperativa La Esperanza">
        </div>
        <div class="form-row">
            <label>Seed Prompt (editable)</label>
            <textarea id="design-seed-prompt" rows="8"
                style="width:100%; background:var(--surface2); border:1px solid var(--border);
                       border-radius:8px; padding:12px; color:var(--text); font-size:13px;
                       resize:vertical;"
                placeholder="Selecciona un tipo de investigación para cargar el template..."></textarea>
        </div>
        <div class="form-row">
            <label>Nombre del Piloto</label>
            <input id="design-pilot-name" placeholder="Ej: Diagnóstico Cultura Q2-2026">
        </div>
        <button class="btn btn-primary" onclick="createPilotFromDesign()">
            Crear Piloto con este Seed Prompt
        </button>
    </div>

    <!-- Biblioteca de directivas -->
    <div class="card" style="margin-top:16px;">
        <h3>2. Directivas de Exploración Sugeridas</h3>
        <p style="color:var(--text2); margin-bottom:16px; font-size:13px;">
            Estas directivas pueden inyectarse durante el piloto desde la sección Wizard.
        </p>
        <div id="directive-library-list"></div>
    </div>
</div>
```

Funciones JavaScript:

```javascript
const SEED_TEMPLATES = {
    CULTURA_ORGANIZACIONAL: `Eres VAL, un facilitador de investigación organizacional.
Tu misión es explorar cómo {ORG} toma decisiones, comparte conocimiento,
y enfrenta cambios — desde la perspectiva del participante.

Ejes de exploración:
1. Flujos de información reales (vs. los formales)
2. Cómo se toman decisiones en la práctica
3. Herramientas o procesos que surgieron "por fuera" del sistema oficial
4. Momentos de orgullo y frustración en el trabajo colaborativo

Escucha más de lo que preguntas. Valida antes de explorar.`,
    TRANSFORMACION_DIGITAL: `Eres VAL, un facilitador de investigación sobre transformación digital.
Exploras cómo {ORG} está viviendo el proceso de cambio tecnológico.

Ejes de exploración:
1. Adopción real de herramientas digitales (brechas entre lo declarado y lo vivido)
2. Resistencias y miedos al cambio — ¿qué se pierde?
3. Innovaciones que el equipo ha generado por su cuenta
4. ¿Qué funcionaría mejor y cómo debería cambiar?`,
    INVESTIGACION_CUALITATIVA: `Eres VAL, un facilitador de investigación cualitativa.
[Personaliza aquí el objetivo de investigación específico]

Ejes de exploración:
[Define los ejes temáticos a explorar]

Técnicas: paráfrasis, preguntas de contraste, silencios estratégicos.`
};

function loadSeedTemplate() {
    const type = document.getElementById('design-type').value;
    const org = document.getElementById('design-org-name').value || '{ORG}';
    if (!SEED_TEMPLATES[type]) return;
    document.getElementById('design-seed-prompt').value =
        SEED_TEMPLATES[type].replace(/{ORG}/g, org);
    loadDirectiveLibrary(type);
}

async function loadDirectiveLibrary(type) {
    const container = document.getElementById('directive-library-list');
    // Hardcoded desde directive_library.json o cargar via API
    const directives = {
        CULTURA_ORGANIZACIONAL: [
            { id: 'CO-001', type: 'QUESTION', theme: 'Shadow IT', content: 'Explora herramientas no oficiales que el equipo usa para resolver problemas' },
            { id: 'CO-002', type: 'QUESTION', theme: 'Decisiones reales', content: 'Indaga el proceso real de toma de decisiones' },
            { id: 'CO-003', type: 'REFRAME', theme: 'Estructuras', content: 'Reencuadra quejas como señales de mejora sistémica' },
        ],
        TRANSFORMACION_DIGITAL: [
            { id: 'TD-001', type: 'QUESTION', theme: 'Brecha digital', content: 'Herramientas implementadas vs. herramientas realmente usadas' },
            { id: 'TD-002', type: 'QUESTION', theme: 'Resistencias', content: '¿Qué se pierde con el cambio tecnológico?' },
        ]
    };
    const items = directives[type] || [];
    container.innerHTML = items.map(d => `
        <div style="padding:10px; border:1px solid var(--border); border-radius:8px; margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:600;">${d.theme}</span>
                <span class="badge badge-active">${d.type}</span>
            </div>
            <div style="color:var(--text2); font-size:13px; margin-top:4px;">${d.content}</div>
        </div>
    `).join('');
}

async function createPilotFromDesign() {
    const name = document.getElementById('design-pilot-name').value.trim();
    const seed = document.getElementById('design-seed-prompt').value.trim();
    const type = document.getElementById('design-type').value;
    if (!name || !seed || !type) {
        toast('Completa nombre, tipo y seed prompt');
        return;
    }
    await api('/admin/projects', {
        method: 'POST',
        body: JSON.stringify({ name, seed_prompt: seed, project_type: type })
    });
    toast('Piloto creado exitosamente');
    showSection('projects');
}
```

En `showSection()`, añadir el caso:
```javascript
if (name === 'design') {
    // No hay datos que cargar automáticamente — el facilitador completa el form
}
```

## Criterios de Éxito
1. La sección "Diseño de Piloto" aparece en el sidebar y es navegable
2. Seleccionar un tipo de investigación puebla el textarea con el template correspondiente
3. El botón "Crear Piloto" llama a `POST /admin/projects` con `seed_prompt` y `project_type`
4. La biblioteca de directivas sugeridas muestra las opciones correspondientes al tipo seleccionado
5. El piloto creado aparece en la sección de Proyectos con el tipo correcto

## Cómo verificar
```bash
# 1. Abrir el panel
open http://localhost:8002/admin

# 2. Navegar a sección "Diseño de Piloto"
# 3. Seleccionar "Diagnóstico de Cultura Organizacional"
# 4. Verificar que el seed prompt se puebla automáticamente
# 5. Completar nombre y crear piloto
# 6. Verificar en BD:
psql $DATABASE_URL -c "SELECT name, project_type, seed_prompt FROM projects ORDER BY created_at DESC LIMIT 3"
```
