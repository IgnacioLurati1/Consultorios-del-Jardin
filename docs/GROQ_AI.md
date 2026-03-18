# Asistente Virtual con Groq AI

## Qué es

Un asistente virtual de "secretaria" que responde preguntas de los usuarios sobre cómo gestionar turnos. Usa el modelo LLM `llama-3.3-70b-versatile` de Groq.

---

## Lo que está implementado

### 1. Configuración del cliente (`src/config/groq.ts`)

```typescript
export const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const GROQ_CONFIG = {
    model: "llama-3.3-70b-versatile",
    temperature: 0.4,
    max_tokens: 800,
}
```

- Cliente Groq inicializado con API key desde `.env`
- Modelo: `llama-3.3-70b-versatile` (rápido, multilenguaje, bueno para instrucciones)
- `temperature: 0.4` — respuestas poco creativas
- `max_tokens: 800` — respuestas relativamente cortas

### 2. Prompt del sistema (`src/prompts/secretary.ts`)

```typescript
export const SECRETARY_PROMPT = `
Eres un asistente virtual especializado en la gestión de turnos.
Tu objetivo es ayudar a los usuarios a:
- Agendar nuevos turnos
- Consultar turnos existentes
Sé cordial, claro y eficiente. Siempre confirma los datos antes de procesar.
`;
```

Define el rol y comportamiento del asistente.

### 3. Método de servicio (`src/appointments/appointments.service.ts:602`)

```typescript
async generateSecretaryResponse(userMessage: string): Promise<string> {
    const response = await groqClient.chat.completions.create({
        ...GROQ_CONFIG,
        messages: [
            { role: "system", content: SECRETARY_PROMPT },
            { role: "user", content: userMessage }
        ]
    });
    return response.choices[0].message.content || "Lo siento, no pude generar una respuesta en este momento.";
}
```

Cada llamada es **stateless** — no hay historial de conversación.

### 4. Endpoint HTTP

```
POST /api/appointments/secretary-response
Body: { "message": "texto del usuario" }
Respuesta: { "message": "Respuesta generada", "data": "respuesta del modelo" }
```

**Estado actual:**
- ❌ Sin autenticación (el check de rol está comentado en el controller)
- ❌ Sin rate limiting
- ✅ Funcional para consultas de una sola vuelta

---

## Lo que FALTA implementar

### Alta prioridad

#### 1. Memoria de conversación (historial de mensajes)
Actualmente cada mensaje es una llamada aislada. El asistente no recuerda el contexto de la conversación anterior.

**Cómo implementarlo:**
- El frontend debe enviar el historial de mensajes junto con el nuevo mensaje
- O el backend guarda el historial en sesión/BD por usuario

```typescript
// Ejemplo: recibir historial desde el frontend
async generateSecretaryResponse(messages: {role: string, content: string}[]): Promise<string> {
    const response = await groqClient.chat.completions.create({
        ...GROQ_CONFIG,
        messages: [
            { role: "system", content: SECRETARY_PROMPT },
            ...messages  // historial incluido
        ]
    });
    ...
}
```

#### 2. Autenticación en el endpoint
El check de rol está comentado en el controller:
```typescript
// COMENTADO — cualquiera puede usar el endpoint sin token:
/*if (req.user.type !== "client") return res.status(403)...*/
```
Hay que:
1. Agregar `verifyToken` al router de appointments (o al endpoint específico)
2. Descomentar el check de rol según lo que se decida

#### 3. Acciones reales (function calling / tool use)
Ahora el asistente solo **habla** — no puede hacer acciones. Faltan:
- Que el asistente pueda consultar turnos disponibles reales
- Que pueda crear/cancelar turnos ejecutando las funciones del servicio
- Usar **Groq function calling** para integrar las herramientas del backend

#### 4. Prompt enriquecido con contexto
El prompt actual es muy genérico. Mejorar con:
- Información del usuario autenticado (nombre, turnos actuales)
- Horarios disponibles reales
- Reglas de negocio específicas (tipos de turno, horarios del sistema)

### Media prioridad

#### 5. Rate limiting
Sin límite actual — un usuario podría hacer miles de requests y generar costos.

```typescript
// Ejemplo simple con express-rate-limit
import rateLimit from 'express-rate-limit';
const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
appointmentRouter.post("/secretary-response", aiLimiter, ...);
```

#### 6. Validación del mensaje de entrada
Actualmente no se valida que `message` exista o tenga contenido.

#### 7. Manejo de errores de la API de Groq
Si la API de Groq falla (timeout, rate limit, etc.) el error actual se propaga genéricamente como 500.

### Baja prioridad

#### 8. Streaming de respuesta
Para mejorar UX en respuestas largas, usar streaming con `stream: true` de Groq SDK y Server-Sent Events.

#### 9. Métricas y logging
Registrar qué consultas se hacen, tiempos de respuesta, tokens usados.

#### 10. Múltiples prompts según rol
Diferente comportamiento si es un cliente vs un profesional.

---

## Flujo actual

```
Frontend → POST /api/appointments/secretary-response
              { message: "pregunta del usuario" }
                         ↓
          appointmentController.generateSecretaryResponse()
                         ↓
          appointmentService.generateSecretaryResponse(userMessage)
                         ↓
          groqClient.chat.completions.create({
              system: SECRETARY_PROMPT,
              user: userMessage
          })
                         ↓
          { message: "Respuesta generada", data: "respuesta del modelo" }
```

## Flujo ideal (a futuro)

```
Frontend → POST /api/appointments/secretary-response
              { messages: [{role, content}, ...] }  ← historial
                         ↓ verifyToken
          appointmentController.generateSecretaryResponse()
                         ↓
          Enriquecer contexto con datos reales del usuario
                         ↓
          groqClient.chat.completions.create({
              system: SECRETARY_PROMPT_CON_CONTEXTO,
              tools: [listarTurnos, crearTurno, cancelarTurno],
              messages: historial
          })
                         ↓ si hay tool_call → ejecutar función real
          { data: "respuesta con acciones reales" }
```
