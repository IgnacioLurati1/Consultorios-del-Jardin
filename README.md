# DSW — Autogestora de Turnos

**Trabajo Práctico — Desarrollo de Software**
Autores: Ortiz, Olivieri, Lurati, Rodriguez, Pretelli

---

## Descripción

Sistema de autogestión de turnos médicos. Permite a pacientes sacar turnos con profesionales, a profesionales gestionar su agenda, y cuenta con un asistente virtual impulsado por IA (Groq) que guía a los usuarios en el proceso.

## Stack

| Tecnología | Uso |
|---|---|
| Node.js + TypeScript | Runtime y lenguaje |
| Express 4 | Framework HTTP |
| MikroORM 6 + MySQL | ORM y base de datos |
| JWT | Autenticación |
| SendGrid | Notificaciones por email |
| Groq SDK (llama-3.3-70b) | Asistente virtual IA |
| node-cron | Recordatorios automáticos |

## Instalación

```bash
cd backend
npm install
```

## Variables de entorno

Crear un archivo `.env` en `backend/` con:

```env
GROQ_API_KEY=
SENDGRID_API_KEY=
JWT_SECRET=
DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=
```

## Comandos

```bash
npm run build        # Compilar TypeScript
npm run start:dev    # Modo desarrollo (watch + auto-restart)
```

El servidor corre en `http://localhost:3000`.

> **Nota:** `syncSchema()` está activo en `app.ts` — sincroniza el esquema de la base de datos automáticamente. Desactivar antes de producción.

## Documentación

- **[Endpoints API](docs/ENDPOINTS.md)** — Referencia completa de todos los endpoints
- **[Asistente IA Groq](docs/GROQ_AI.md)** — Detalle de la implementación y próximos pasos

## Roles de usuario

| Rol | Descripción |
|---|---|
| `client` | Paciente, puede sacar y cancelar turnos |
| `professional` | Médico/profesional, gestiona su agenda |
| `admin` | Administrador del sistema |

## Autenticación

- Access token: header `Authorization: Bearer <token>`
- Refresh token: cookie httpOnly

## Arquitectura

```
backend/src/
├── app.ts                 # Entry point
├── appointments/          # Turnos y diagnósticos
├── people/                # Usuarios
├── offices/               # Consultorios
├── rooms/                 # Salas
├── schedule/              # Horarios de profesionales
├── cities/ + provinces/   # Geografía
├── config/                # Groq, SendGrid, JWT middleware
├── prompts/               # Prompts para la IA
└── jobs/                  # Cron jobs (recordatorios)
```
