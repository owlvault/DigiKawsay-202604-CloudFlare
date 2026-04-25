# Skill: Panel de Control Frontend

## Propósito
SPA (Single Page Application) en JavaScript vanilla que sirve como interfaz del facilitador.
Archivo principal: `src/agente00-service/static/panel.html`
Servido por AGENTE-00 en: `http://localhost:8002/admin`

## Arquitectura del Panel
```
panel.html
├── CSS (variables :root, componentes reutilizables)
├── HTML (sidebar nav + 6 secciones de contenido)
└── JavaScript
    ├── showSection(name)     — navegación entre secciones
    ├── toast(msg)            — notificaciones temporales
    ├── api(path, opts)       — wrapper de fetch()
    ├── loadOverview()        — carga sección Overview
    ├── loadProjects()        — carga tabla de proyectos
    ├── loadProjectSelectors() — popula dropdowns de proyectos
    ├── registerBatch()       — registro masivo de participantes
    ├── loadParticipants()    — tabla de participantes con métricas
    ├── loadWozParticipants() — selector de participantes activos para WoZ
    ├── loadConversation()    — burbujas de chat para participante seleccionado
    ├── injectDirective()     — inyección de directiva WoZ
    ├── loadDirectiveHistory(projectId) — historial de directivas
    ├── exportData(format)    — exportar JSON/CSV
    ├── generateReport()      — reporte del piloto inline
    └── closeProject()        — cerrar piloto con confirmación
```

## Secciones Existentes
```
sec-overview     — KPIs + tabla de proyectos recientes
sec-projects     — Crear piloto + tabla de pilotos existentes
sec-participants — Registro batch + monitoreo + links de invitación
sec-wizard       — WoZ: conversación en vivo + inyección de directivas
sec-export       — Exportar transcripciones + reporte + cerrar piloto
sec-setup        — Configurar webhook de Telegram
```

## Patrones JavaScript del Panel

### Añadir nueva sección completa
```javascript
// 1. Nav item en sidebar HTML:
<div class="nav-item" onclick="showSection('nueva')">🔖 Nueva</div>

// 2. Sección HTML (dentro de <div class="main">):
<div id="sec-nueva" class="section">
    <h2 style="margin-bottom: 24px;">Nueva Sección</h2>
    <div class="kpi-grid">
        <div class="kpi"><div class="value" id="kpi-nuevo">-</div><div class="label">Métrica</div></div>
    </div>
    <div class="card">
        <h3>Tabla de Datos</h3>
        <table>
            <thead><tr><th>Col 1</th><th>Col 2</th></tr></thead>
            <tbody id="nueva-tabla"></tbody>
        </table>
    </div>
</div>

// 3. En showSection(), añadir:
if (name === 'nueva') loadNueva();

// 4. Función de carga:
async function loadNueva() {
    const data = await api('/admin/nuevo_endpoint');
    document.getElementById('kpi-nuevo').textContent = data.total || 0;
    const tbody = document.getElementById('nueva-tabla');
    tbody.innerHTML = (data.items || []).map(item => `
        <tr>
            <td>${item.campo1}</td>
            <td><span class="badge badge-active">${item.estado}</span></td>
        </tr>
    `).join('');
}
```

### Añadir auto-refresh a una sección
```javascript
// Al final de la función de carga, añadir:
clearInterval(window._refreshNueva);
window._refreshNueva = setInterval(() => loadNueva(), 10000); // cada 10s

// En showSection(), limpiar el intervalo al salir:
clearInterval(window._refreshNueva);
```

### Añadir badge de alerta a una fila de tabla
```javascript
// En el map() de la tabla:
const alertaBadge = condicion ? '<span class="badge" style="background:rgba(239,68,68,0.15);color:#ef4444">⚠ Alerta</span>' : '';
tbody.innerHTML = items.map(item => `
    <tr>
        <td>${item.nombre} ${alertaBadge}</td>
    </tr>
`).join('');
```

## Variables CSS Disponibles
```css
--primary: #8b5cf6       /* púrpura — acciones principales */
--accent: #06d6a0        /* verde azulado — éxito / activo */
--warning: #ffd166       /* amarillo — advertencia / invited */
--danger: #ef476f        /* rojo — error / alerta crítica */
--text: #e4e6ef          /* texto principal */
--text2: #9da3b4         /* texto secundario */
--text3: #626880         /* texto muted */
--bg: #0f1117            /* fondo global */
--surface: #1a1d27       /* cards */
--surface2: #252836      /* inputs, hover */
--border: #2d3142        /* bordes */
--radius: 12px           /* border-radius estándar */
```

## Clases de Componentes
```html
<!-- Cards -->
<div class="card"><h3>Título</h3>contenido</div>

<!-- Badges de estado -->
<span class="badge badge-active">active</span>
<span class="badge badge-invited">invited</span>
<span class="badge badge-completed">completed</span>

<!-- Botones -->
<button class="btn btn-primary">Acción Principal</button>
<button class="btn btn-secondary">Acción Secundaria</button>
<button class="btn btn-danger">Acción Peligrosa</button>
<button class="btn btn-sm btn-secondary">Botón Pequeño</button>

<!-- KPI Grid -->
<div class="kpi-grid">
    <div class="kpi">
        <div class="value" id="kpi-id">42</div>
        <div class="label">Descripción</div>
    </div>
</div>

<!-- Formulario -->
<div class="form-row">
    <label>Campo</label>
    <input id="campo-id" placeholder="...">
</div>
```
