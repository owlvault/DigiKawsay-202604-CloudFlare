# DigiKawsay: Manual del Facilitador (Wizard of Oz)

## ¿Qué es el Wizard of Oz (WoZ)?

DigiKawsay es mayoritariamente autónomo, pero está diseñado bajo el principio de "Human-in-the-Loop". El **Panel Wizard of Oz** te permite, como facilitador humano o investigador cualitativo, leer las conversaciones en tiempo real e "inyectar" "Directivas" a los agentes. 

Cuando insertas una directiva, el bot **VAL** la lee en milisegundos, la internaliza y la traduce orgánicamente en la conversación con el participante en el siguiente turno. Nunca repetirá tu directiva como un loro; la interpretará como una intuición propia ("Me quedé pensando en...").

## Acceso al Panel
1. Ingresa al Panel de Control (`http://localhost:8002/admin`).
2. Haz clic en la pestaña lateral **🧙 Wizard of Oz**.

## Uso del Panel

### 1. Observación Activa
- Selecciona a un participante en el menú desplegable.
- Verás el historial de chat con "Burbujas".
  - **Burbuja del Participante:** Muestra también la "Emoción" y el "Acto de Habla" detectado por algoritmos.
  - **Burbuja de VAL:** Muestra la respuesta de la IA. Si tiene un ícono 🧙, significa que en ese turno VAL aplicó una de tus directivas.

### 2. Inyección de Directivas
Si notas que un participante (por ejemplo, "María") menciona un tema crítico pero superficial:
*María:* "Sí, acá cuesta mucho pedir vacaciones porque recursos humanos siempre pierde los papeles."
*VAL (Autónomo):* "Entiendo, suena frustrante sentir que el proceso no es fluido."

**Tu intervención como Facilitador:**
Te das cuenta de que esto es un "Bypass burocrático" o un cuello de botella sistémico.
1. Vas a la sección **Inyectar Directiva**.
2. Escribes: `"Indaga sobre qué herramientas no oficiales (Shadow IT) usan para llevar el control de vacaciones paralelo a Recursos Humanos."`
3. Seleccionas **Urgencia: Alta** y haces clic en **Inyectar**.

**El resultado en el siguiente turno de María:**
*María:* "Claro, es que la desconfianza cansa."
*VAL:* "Es comprensible que canse. Si los papeles se pierden, me da curiosidad, ¿ustedes han tenido que inventar alguna forma paralela, tal vez algún Excel o grupo no oficial, para llevar su propio control?"

### Buenas Prácticas para Directivas

✅ **Hazlas orientadas a la curiosidad:** "Pregúntale qué siente sobre X", "Indaga cómo se relaciona esto con Y".
✅ **Sé conciso:** VAL tiene un límite de contexto. Ve al grano.
❌ **NO escribas guiones literales:** No le digas a VAL "Dile exactamente: Hola, ¿cómo estás?". Dile "Salúdalo y pregúntale su nombre".
❌ **NO corrijas a VAL regañándolo:** VAL es un LLM sentipensante. Dirígelo hacia el futuro, no critiques su turno pasado.

### Monitoreo del Historial de Directivas
En el lado derecho del panel verás un log. Las directivas inyectadas aparecen como `PENDING`. Cuando VAL recibe el siguiente mensaje del usuario y fabrica la respuesta usando tu guía, el estado en el panel cambiará a verde `APPLIED`.
