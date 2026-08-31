# API Endpoints — DSW Autogestora de Turnos

Base URL: `http://localhost:3000/api`

> **Auth:** La mayoría de endpoints requieren header `Authorization: Bearer <token>`.
> Las rutas públicas (❌) están marcadas explícitamente.

> **Usuarios deshabilitados:** una persona con `active = false` (baneada por el admin, o
> profesional cuya solicitud todavía no fue aprobada) no puede operar en la app. Se le
> rechaza el login, la renovación del token, la recuperación de contraseña y **cualquier
> endpoint autenticado**, con `403 { "message": "Usuario deshabilitado", "code": "USER_DISABLED" }`.
> El chequeo se hace contra la base en cada request, así que un ban corta la sesión al instante
> aunque el usuario ya tenga un token emitido.

---

## Auth / Token

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/tokenStatus` | ✅ | Verificar si el token es válido |
| POST | `/refreshToken` | 🍪 cookie | Refrescar el access token |

### Respuesta GET `/tokenStatus`
```json
{ "message": "Token válido" }
```

### POST `/refreshToken`

El refresh token viaja únicamente en la cookie httpOnly `refreshToken`, así que el JS de la
página no puede leerlo (defensa ante XSS). El front debe llamar a este endpoint con
`withCredentials: true`.

**Respuesta 200:**
```json
{ "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

| Código | Causa |
|--------|-------|
| 401 | No llegó la cookie con el refresh token |
| 403 | Refresh token inválido o expirado |
| 403 | Usuario deshabilitado (`code: "USER_DISABLED"`) |

> El refresh token dura 30 días y **no rota**: se emite una vez en el login/registro y no se
> guarda en el servidor. El logout es del lado del cliente. La forma de matar una sesión es
> deshabilitar a la persona (`active = false`).

---

## Personas (`/api/people`)

| Método | Ruta | Auth | Rol | Descripción |
|--------|------|------|-----|-------------|
| GET | `/people/` | ✅ | admin | Obtener todas las personas |
| GET | `/people/NoAdmin` | ✅ | admin | Obtener personas no-admin |
| GET | `/people/:email` | ✅ | — | Obtener persona por email |
| GET | `/people/type/:peopleType` | ✅ | admin | Obtener personas por tipo |
| GET | `/people/type/active/:peopleType` | ✅ | — | Personas activas por tipo |
| GET | `/people/professionals/office/:officeId/:speciality?` | ✅ | — | Profesionales por consultorio (y especialidad opcional) |
| POST | `/people/` | ❌ público | — | Registrar nuevo usuario |
| POST | `/people/login` | ❌ público | — | Login |
| POST | `/people/logout` | ✅ | — | Logout |
| POST | `/people/:email/passwordMail` | ❌ público | — | Enviar email de recuperación de contraseña |
| PATCH | `/people/changePassword` | ✅ | — | Cambiar contraseña |
| PUT/PATCH | `/people/:email` | ✅ | — | Actualizar persona |
| DELETE | `/people/:email` | ✅ | admin | Eliminar persona |
| PATCH | `/people/:email/toggleState` | ✅ | admin | Activar/desactivar persona |

### Body POST `/people/` (registro)
```json
{
  "email": "usuario@mail.com",
  "docType": "DNI",
  "docNumber": "12345678",
  "name": "Juan",
  "surname": "Pérez",
  "phoneNumber": "11-1234-5678",
  "password": "contraseña",
  "type": "client",
  "speciality": null
}
```
> Para registrar un profesional: `"type": "professional"` y `"speciality": "Cardiología"`

### Body POST `/people/login`
```json
{
  "email": "usuario@mail.com",
  "password": "contraseña"
}
```

### Respuesta POST `/people/login`
```json
{
  "message": "Login exitoso",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

> `token` es el access token (15 min) y va en `Authorization: Bearer`.
> El refresh token (30 días) **no** viene en el body: se setea como cookie httpOnly.
> El registro (`POST /people/`) devuelve lo mismo, más `data` con la persona creada.

### POST `/people/logout`
> No requiere body. Borra la cookie del refresh token.

**Respuesta 200:**
```json
{ "message": "Sesión cerrada" }
```

> El logout no invalida el refresh token del lado del servidor: solo borra la cookie.
> Sigue siendo válido hasta que expire.

### Body PATCH `/people/changePassword`
```json
{
  "currentPassword": "contraseñaActual",
  "newPassword": "nuevaContraseña"
}
```

---

## Turnos (`/api/appointments`)

| Método | Ruta | Auth | Rol | Descripción |
|--------|------|------|-----|-------------|
| GET | `/appointments/patient/:page` | ✅ | — | Turnos del paciente autenticado (paginado, 15/pág) |
| GET | `/appointments/professional/:page` | ✅ | professional | Turnos del profesional autenticado (paginado, 15/pág) |
| GET | `/appointments/pending` | ✅ | professional | Turnos pendientes del profesional |
| GET | `/appointments/medical-history` | ✅ | — | Historial médico personal |
| GET | `/appointments/medical-history/:patientEmail` | ✅ | professional | Historial médico de un paciente |
| GET | `/appointments/:numAppointment/diagnostic` | ✅ | — | Parte clínica del turno para el paciente autenticado |
| GET | `/appointments/:numAppointment/diagnostics` | ✅ | professional | Parte clínica del turno (array de 0 o 1 elemento) |
| POST | `/appointments/` | ✅ | — | Crear turno (desde paciente) |
| POST | `/appointments/professional` | ✅ | professional | Crear turno (desde profesional) |
| POST | `/appointments/patient/:numAppointment` | ✅ | professional | Asignar el paciente de un turno sin paciente |
| POST | `/appointments/getAppointments` | ✅ | — | Consultar turnos disponibles para el paciente |
| POST | `/appointments/secretary-response` | ✅ | client | Asistente virtual IA (Groq) |
| PATCH | `/appointments/:numAppointment/observations` | ✅ | professional | Agregar observaciones a diagnóstico |
| PATCH | `/appointments/:numAppointment/accept` | ✅ | professional | Aceptar turno |
| PATCH | `/appointments/:numAppointment/cancel` | ✅ | — | Cancelar turno |
| PUT/PATCH | `/appointments/:numAppointment/diagnostic` | ✅ | professional | Actualizar diagnóstico |
| PUT/PATCH | `/appointments/:numAppointment` | ✅ | professional | Actualizar turno |
| DELETE | `/appointments/:numAppointment` | ✅ | professional | Eliminar turno (solo estado pending) |

---

### POST `/appointments/` — Paciente crea turno
```json
{
  "date": "2025-03-15",
  "initialHour": "09:00",
  "professionalEmail": "doctor@mail.com",
  "office": 1
}
```
**Respuesta 201:**
```json
{
  "message": "Turno creado con éxito",
  "data": {
    "numAppointment": 42,
    "date": "2025-03-15T00:00:00.000Z",
    "initialHour": "09:00",
    "finalHour": "09:30",
    "value": 5000,
    "professionalEmail": "doctor@mail.com",
    "room": { "idRoom": 1, "description": "Consultorio A" }
  }
}
```

---

### POST `/appointments/professional` — Profesional crea turno
```json
{
  "date": "2025-03-15",
  "initialHour": "09:00",
  "finalHour": "09:30",
  "room": 1,
  "value": 5000,
  "patientEmail": "paciente@mail.com"
}
```
> `patientEmail` es opcional. Si se omite, crea el turno sin paciente asignado.

**Respuesta 201:**
```json
{
  "message": "Turno creado con éxito",
  "data": {
    "numAppointment": 43,
    "date": "2025-03-15T00:00:00.000Z",
    "initialHour": "09:00",
    "finalHour": "09:30",
    "value": 5000,
    "professionalEmail": "doctor@mail.com",
    "room": { "idRoom": 1, "description": "Consultorio A" }
  }
}
```

---

### POST `/appointments/patient/:numAppointment` — Asignar paciente a un turno
```json
{
  "patientEmail": "nuevopaciente@mail.com"
}
```
> Solo funciona si el turno todavía no tiene paciente. Un turno tiene como máximo uno.
**Respuesta 201:**
```json
{ "message": "Paciente añadido con éxito!" }
```

---

### POST `/appointments/getAppointments` — Turnos disponibles
```json
{
  "professionalEmail": "doctor@mail.com",
  "office": 1
}
```
**Respuesta 200:** lista de slots disponibles generados desde el schedule del profesional.

---

### POST `/appointments/secretary-response` — Asistente IA
> Requiere token. Solo rol `client`.
```json
{
  "message": "¿Cómo puedo sacar un turno?"
}
```
**Respuesta 200:**
```json
{
  "message": "Respuesta generada",
  "data": "Para sacar un turno, primero necesito saber con qué profesional quieres atenderte..."
}
```

---

### PATCH `/appointments/:numAppointment/observations` — Agregar observación
```json
{
  "patientEmail": "paciente@mail.com",
  "observations": "El paciente presenta mejoras tras el tratamiento."
}
```
**Respuesta 200:**
```json
{
  "message": "Observación añadida con éxito",
  "data": {
    "state": "assisted",
    "observations": "El paciente presenta mejoras tras el tratamiento."
  }
}
```

---

### PATCH `/appointments/:numAppointment/accept` — Aceptar turno
> No requiere body.

**Respuesta 200:**
```json
{ "message": "Turno aceptado exitosamente" }
```

---

### PATCH `/appointments/:numAppointment/cancel` — Cancelar turno
> No requiere body. Funciona tanto para `client` como `professional`.
> - `pending` → se elimina el turno
> - `accepted` → state pasa a ISO timestamp (cancelado)
> - `assisted` → error: no se puede cancelar un turno ya asistido
> - Si lo cancela el `client`, además se le avisa por mail al profesional

**Respuesta 200:**
```json
{ "message": "Turno cancelado con éxito" }
```

---

### PUT/PATCH `/appointments/:numAppointment/diagnostic` — Actualizar diagnóstico
```json
{
  "patientEmail": "paciente@mail.com",
  "state": "assisted",
  "observations": "Paciente asistió sin inconvenientes."
}
```
> `state` válidos: `"pending"`, `"accepted"`, `"assisted"`.
> Para cancelar hay que usar `PATCH /appointments/:numAppointment/cancel`.
> `patientEmail` es opcional; si se manda, se valida que sea el paciente del turno.

**Respuesta 200:**
```json
{
  "message": "Diagnóstico actualizado con éxito",
  "data": {
    "state": "assisted",
    "observations": "Paciente asistió sin inconvenientes."
  }
}
```

---

### PUT/PATCH `/appointments/:numAppointment` — Actualizar turno
```json
{
  "date": "2025-03-20",
  "initialHour": "10:00",
  "finalHour": "10:30",
  "value": 6000,
  "room": 2
}
```
**Respuesta 200:**
```json
{ "message": "Turno actualizado con éxito" }
```

---

## Consultorios (`/api/offices`)

| Método | Ruta | Auth | Rol | Descripción |
|--------|------|------|-----|-------------|
| GET | `/offices/` | ✅ | admin | Todos los consultorios |
| GET | `/offices/active` | ✅ | — | Consultorios activos |
| GET | `/offices/:idOffice` | ✅ | — | Consultorio por ID |
| GET | `/offices/professional/:email` | ✅ | — | Consultorios de un profesional |
| POST | `/offices/` | ✅ | admin | Crear consultorio |
| PUT/PATCH | `/offices/:idOffice` | ✅ | admin | Actualizar consultorio |
| PATCH | `/offices/:idOffice/toggle` | ✅ | admin | Activar/desactivar consultorio |

### Body POST `/offices/`
```json
{
  "description": "Consultorio Centro",
  "openingTime": "08:00",
  "closingTime": "20:00",
  "city": 1
}
```

---

## Salas (`/api/rooms`)

| Método | Ruta | Auth | Rol | Descripción |
|--------|------|------|-----|-------------|
| GET | `/rooms/` | ✅ | admin | Todas las salas |
| GET | `/rooms/active` | ✅ | — | Salas activas |
| GET | `/rooms/:idRoom` | ✅ | — | Sala por ID |
| GET | `/rooms/office/professional/:officeId/:email` | ✅ | — | Salas por consultorio y profesional |
| POST | `/rooms/` | ✅ | admin | Crear sala |
| PUT/PATCH | `/rooms/:idRoom` | ✅ | admin | Actualizar sala |
| PATCH | `/rooms/:idCity/toggle-state` | ✅ | admin | Activar/desactivar sala |

### Body POST `/rooms/`
```json
{
  "description": "Sala 1",
  "office": 1
}
```

---

## Horarios (`/api/schedules`)

| Método | Ruta | Auth | Rol | Descripción |
|--------|------|------|-----|-------------|
| GET | `/schedules/` | ✅ | — | Todos los horarios |
| GET | `/schedules/profesional` | ✅ | professional | Horarios del profesional autenticado |
| GET | `/schedules/by-email/:email` | ✅ | — | Horarios por email de profesional |
| GET | `/schedules/by-day-hour/:day/:initialHour` | ✅ | — | Horario por día y hora |
| POST | `/schedules/` | ✅ | — | Crear horario |
| PUT/PATCH | `/schedules/` | ✅ | — | Actualizar horario |
| DELETE | `/schedules/by-day-hour/:day/:initialHour/:person` | ✅ | — | Eliminar horario específico |

### Body POST `/schedules/`
```json
{
  "day": "Lunes",
  "initialHour": "09:00",
  "finalHour": "12:00",
  "duration": 30,
  "room": 1
}
```
> `duration`: duración en minutos de cada slot (ej: 30)

---

## Ciudades (`/api/cities`)

| Método | Ruta | Auth | Rol | Descripción |
|--------|------|------|-----|-------------|
| GET | `/cities/` | ✅ | admin | Todas las ciudades |
| GET | `/cities/active` | ✅ | — | Ciudades activas |
| GET | `/cities/:idCity` | ✅ | — | Ciudad por ID |
| POST | `/cities/` | ✅ | admin | Crear ciudad |
| PUT/PATCH | `/cities/:idCity` | ✅ | admin | Actualizar ciudad |
| PATCH | `/cities/:idCity/toggle-state` | ✅ | admin | Activar/desactivar ciudad |

### Body POST `/cities/`
```json
{
  "nameCity": "Córdoba",
  "province": 1
}
```

---

## Provincias (`/api/provinces`)

| Método | Ruta | Auth | Rol | Descripción |
|--------|------|------|-----|-------------|
| GET | `/provinces/` | ✅ | admin | Todas las provincias |
| GET | `/provinces/active` | ✅ | — | Provincias activas |
| GET | `/provinces/:idProvince` | ✅ | — | Provincia por ID |
| POST | `/provinces/` | ✅ | admin | Crear provincia |
| PUT/PATCH | `/provinces/:idProvince` | ✅ | admin | Actualizar provincia |
| PATCH | `/provinces/:idProvince/toggle-state` | ✅ | admin | Activar/desactivar provincia |

### Body POST `/provinces/`
```json
{
  "nameProvince": "Córdoba"
}
```

---

## Estados de entidades

### Appointment.state
| Valor | Significado |
|-------|-------------|
| `"pending"` | Creado, esperando aceptación del profesional |
| `"accepted"` | Aceptado por el profesional |
| `"assisted"` | El paciente asistió (lo marca el profesional) |
| ISO timestamp | Cancelado (ej: `"2025-03-10T14:30:00.000Z"`) |

> El estado del turno y el del diagnóstico se unificaron en este campo:
> `Diagnostic` dejó de ser una entidad y un turno tiene un solo paciente.

### Person.type (roles)
| Valor | Acceso |
|-------|--------|
| `"client"` | Paciente — saca y cancela turnos, usa asistente IA |
| `"professional"` | Gestiona su agenda, acepta/rechaza turnos |
| `"admin"` | Administración del sistema |

---

## Errores comunes

| Código | Causa |
|--------|-------|
| 401 | Token ausente, inválido o expirado |
| 403 | Rol insuficiente, o usuario deshabilitado (`code: "USER_DISABLED"`) |
| 404 | Recurso no encontrado |
| 409 | Conflicto — turno duplicado en misma fecha/hora |
| 500 | Error interno del servidor (ver `message` en respuesta) |
