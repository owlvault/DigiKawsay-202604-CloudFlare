# Manual de Ejecución de Pilotos DigiKawsay

Este manual guía al encargado del proyecto o líder de innovación en el proceso paso a paso de ejecutar un piloto controlado utilizando DigiKawsay.

## Fase 1: Pre-requisitos y Lanzamiento del Sistema

Un piloto requiere que los servicios de DigiKawsay estén funcionando localmente. 
1. Asegúrate de tener **Docker Desktop** en ejecución.
2. Verifica que tienes un archivo `.env` configurado en la raíz del proyecto con tus credenciales: `TELEGRAM_BOT_TOKEN` y `GEMINI_API_KEY`.
3. Ejecuta el script de lanzamiento:
   ```powershell
   .\scripts\launch_pilot.ps1
   ```
4. Nota: El script levantará un túnel **Ngrok** automáticamente y conectará el Webhook de Telegram. Lee el output de la terminal para encontrar la URL del Panel de Control (usualmente `http://localhost:8002/admin`).

## Fase 2: Configuración del Proyecto

Abre el **Panel de Control** en tu navegador.

1. Ve a la sección **📁 Proyectos**.
2. **Crear Nuevo Piloto:**
   - **Nombre:** Da un nombre identificable (ej. "Diagnóstico Área Operativa Q3").
   - **Pregunta Provocadora (Seed Prompt):** Esta es la semilla del foro. En lugar de hacer una pregunta cerrada, plantea un escenario de reflexión. *Ejemplo: "¿Cómo sienten que fluye la información cuando un requerimiento crítico entra de urgencia al área?"*
   - Define duración y máximo de participantes.
   - Haz clic en **Crear Piloto**.

## Fase 3: Registro y Onboarding de Participantes

El sistema requiere invitaciones cerradas para mantener la integridad de los datos.

1. Ve a la sección **👥 Participantes**.
2. Selecciona tu proyecto en el menú desplegable.
3. En **Nombres**, ingresa la lista de participantes (uno por línea). Pueden ser seudónimos si deseas doble anonimato.
4. Haz clic en **Registrar y Generar Invitaciones**.
5. **Distribución:** El sistema generará una lista de enlaces únicos (`https://t.me/TuBot?start=ABCD123`). Copia cada link y envíaselo personalmente a cada participante por WhatsApp, Slack o correo.

## Fase 4: Monitoreo Activo (Fase de Vida)

Mientras los participantes interactúan con el bot de Telegram, el líder del piloto debe monitorear el pulso.

1. Usa la vista **📊 Overview** para ver la "Tasa de Participación" (cuántos invitados han hablado) y el volumen de turnos.
2. Usa la vista **👥 Participantes** para observar quién está estancado o no ha respondido. 
   - Notarás etiquetas como `invited` (no han dado clic), `active` (hablando), `withdrawn` (pidieron salir).
3. **El Facilitador Activo:** Dile a tu investigador cualitativo que use el "Wizard of Oz" para inyectar directivas. Revisa el *[Manual del Facilitador](03_Manual_Facilitador.md)*.

## Fase 5: Cierre y Recolección de Frutos

Cuando pase el tiempo estipulado (o se note saturación teórica):

1. Ve a la sección **📤 Exportar**.
2. **Generar Reporte:** Selecciona tu proyecto y presiona "Generar Reporte". El sistema construirá un análisis demográfico, temático y emocional del piloto. Copia estos insights.
3. **Exportar JSON/CSV:** Para análisis futuro (o respaldos), descarga las transcripciones completas.
4. **Cerrar Piloto:** Selecciona el proyecto y presiona **🔒 Cerrar Piloto**. 
   - Esto actualizará el estado de la base de datos.
   - Automáticamente enviará un mensaje de despedida y agradecimiento por Telegram a todos los involucrados, cerrando la posibilidad de nuevos mensajes en ese contexto.

---
*Fin del Manual de Ejecución.*
