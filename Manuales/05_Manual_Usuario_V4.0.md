# DigiKawsay: Guía de Experiencia del Usuario (v4.2)

*Esta guía explica a los participantes —empleados o voluntarios— cómo funciona DigiKawsay, qué pueden esperar de las conversaciones con VAL y cómo está protegida su privacidad.*

---

## 1. Cómo ingresar al proceso

DigiKawsay no es un chatbot público. Solo participan las personas que reciben una invitación directa del facilitador de su organización.

Recibirás un link personalizado por el canal interno que tu organización elija (email, Slack, Teams, etc.). El formato del link es:

```
https://t.me/VAL_Digi_bot?start=XXXXXXXX
```

El código de 8 caracteres al final es único para ti. Al abrirlo en tu teléfono, Telegram se abre automáticamente con el bot y la sesión queda vinculada a tu invitación.

> **No compartas este link.** Si otra persona lo usa primero, tu acceso queda bloqueado. Si perdiste el link, contacta a tu facilitador para que genere uno nuevo.

---

## 2. Primer contacto: bienvenida y consentimiento

Al ingresar por primera vez, VAL te envía un mensaje de bienvenida y te explica que:

- La conversación es **voluntaria** — puedes detenerte cuando quieras
- Tu identidad será **anonimizada** en todos los reportes
- El proceso sigue principios de **confidencialidad** — el facilitador no puede vincular tus respuestas a tu nombre en el informe final

Al enviar tu **primer mensaje** después de la bienvenida, das consentimiento implícito para participar. No hay que escribir "Acepto" — tu primera respuesta basta.

Si en algún momento decides no continuar, simplemente deja de responder. El sistema no te enviará mensajes recurrentes automáticos.

---

## 3. Conversar con VAL

VAL es un agente de inteligencia artificial diseñado para escuchar sin juzgar. No es un formulario de preguntas y respuestas. Es una conversación.

**Cómo funciona:**
- VAL hace **una sola pregunta por turno**, o a veces simplemente valida lo que dijiste sin preguntar nada
- Las respuestas de VAL son cortas — máximo 2-3 oraciones
- No hay respuestas correctas o incorrectas. VAL sigue los hilos que tú abres, no una lista de temas predefinidos
- VAL puede compartir ocasionalmente perspectivas de otros participantes del mismo proyecto (de forma completamente anónima, sin nombres). Esto es normal y busca enriquecer tu reflexión

**La conversación es asíncrona:**
Puedes responder cuando quieras. No hay presión de tiempo ni indicadores de "visto". Si contestas una semana después, VAL recordará el contexto de la conversación anterior.

**Sobre los mensajes proactivos:**
En algunos momentos, VAL puede enviarte un mensaje sin que hayas escrito primero. Esto ocurre cuando el equipo facilitador considera que hay un tema importante que vale la pena explorar o cuando quieren retomar la conversación. Estos mensajes son intencionados y parte del proceso — no son errores del sistema.

**Qué explorar:**
El facilitador configura un *seed prompt* que enmarca el territorio de la conversación (ej. *"Cómo trabaja el equipo en el día a día"*). Dentro de ese territorio, VAL sigue lo que tú traes: una queja, una idea, un proceso que no funciona, algo que sí funciona, una herramienta que usas por fuera del sistema oficial.

**Etapas de la conversación:**
La conversación tiene tres momentos que se van desarrollando naturalmente:
1. **Exploración:** VAL escucha y entiende cómo funciona realmente el trabajo
2. **Acción:** juntos identifican qué podría mejorar y cómo
3. **Participación:** qué puedes hacer tú y cómo se comparten los hallazgos con el equipo

No es necesario que sepas en qué etapa estás — VAL adapta su enfoque gradualmente.

---

## 4. Privacidad y anonimato

### Qué sabe el sistema sobre ti
El sistema asocia tu conversación con un identificador interno (tu chatId de Telegram). Tu nombre de display (el que el facilitador registró al crear tu invitación) aparece solo en el panel del facilitador.

### Qué ven los facilitadores
Los facilitadores acceden a:
- El historial de tu conversación (completo, en el panel admin)
- Tu registro emocional actual y número de turnos
- Los patrones detectados en tu conversación (Shadow IT, indicadores de praxis)

Los facilitadores **no** ven tu nombre de Telegram ni tu número de teléfono.

### Qué aparece en los informes
Los informes analíticos son agregados: distribuciones del equipo completo, patrones emergentes, saberes colectivos. No hay citas textuales vinculadas a nombres. El informe no te identifica individualmente.

### Lo que el sistema NO hace actualmente
- No filtra automáticamente tus datos personales antes de enviarlos al modelo de IA. Evita mencionar nombres completos, números de cédula o emails en tus mensajes.
- No tiene un comando `/salir` implementado en esta versión. Para retirarte, comunícalo a tu facilitador, quien actualizará tu estado manualmente.

---

## 5. Safe Harbor: si la conversación se vuelve difícil

VAL está entrenado para reconocer cuando alguien expresa angustia emocional severa (burnout, situaciones de crisis, agotamiento profundo). En esos casos, VAL **suspende la exploración analítica** y acompaña con empatía, sin retomar temas de investigación hasta que lo indiques tú.

Si en algún momento la conversación te genera incomodidad, simplemente para de responder. No hay consecuencias. También puedes decirle a VAL directamente cómo te sientes.

---

## 6. Preguntas frecuentes

**¿VAL es un humano o una IA?**
Es una inteligencia artificial. Si lo preguntas directamente, VAL lo confirma.

**¿Mis respuestas afectan mi evaluación laboral?**
No. DigiKawsay es una herramienta de investigación organizacional, no de evaluación de desempeño. El sistema no tiene integración con sistemas de RRHH.

**¿Puedo hablar de cualquier tema?**
Dentro del territorio que el seed prompt define. VAL puede notar si te alejas del territorio y gentilmente retomar, pero sin forzar.

**¿Qué pasa si no respondo por semanas?**
Nada. El sistema no envía recordatorios automáticos. Tu conversación queda guardada y puedes retomar cuando quieras mientras el piloto esté activo. El equipo facilitador puede enviarte un mensaje de reenganche si el piloto está por cerrar.

**¿Puedo ver lo que el sistema recopiló sobre mí?**
Contacta a tu facilitador. El historial completo de tu conversación está disponible en el panel admin.

**¿Por qué a veces VAL menciona lo que otros del equipo piensan?**
VAL comparte ocasionalmente perspectivas anónimas del grupo para enriquecer tu reflexión — nunca con nombres, siempre de forma anónima. Esta función se llama Espejo Ligero y busca que puedas ver tu experiencia en contexto con la del equipo.

**¿Mis mensajes son seguros?**
Sí. El sistema analiza los mensajes con IA pero no los almacena en logs de texto accesibles libremente. Los facilitadores ven el historial de tu conversación, pero están sujetos a las mismas reglas de confidencialidad del proceso IAP.

---

## 7. El Espejo Ligero (implementado) y El Espejo Completo (próximamente)

### Espejo Ligero (disponible ahora)
Ocasionalmente, VAL puede mencionar que otros participantes del equipo también han compartido perspectivas similares sobre un tema. Esto es el **Espejo Ligero**: una forma de conectar tu reflexión individual con el pulso colectivo del equipo, sin revelar identidades.

Ejemplo de mensaje con Espejo Ligero:
> *"Otros del equipo también han mencionado algo similar sobre las herramientas que usan para coordinarse. ¿Eso resuena con lo que tú vives?"*

### El Espejo Completo (próximamente)
En versiones futuras del sistema, VAL introducirá periódicamente perspectivas anónimas de otros participantes del mismo proyecto — ideas de colegas que resuenan con lo que tú dijiste, o perspectivas complementarias que contrastan. El participante verá ideas del grupo, nunca nombres.
