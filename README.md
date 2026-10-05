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
| Brevo | Notificaciones por email |
| Groq SDK (llama-3.3-70b) | Asistente virtual IA |
| node-cron | Recordatorios automáticos |

## Instalación

```bash
cd backend
npm install
```

## Variables de entorno

Copiar `backend/.env.example` a `backend/.env` y completarlo. Cada variable está explicada ahí.

En producción el servidor no arranca si falta una obligatoria, si dos claves de firma son iguales o
si alguna es más corta de 32 caracteres (`src/config/envCheck.ts`). El error dice qué falta sin
imprimir ningún valor.

El mismo código corre en más de un consultorio, una instalación por cliente. Ninguna clave se
comparte entre instalaciones: ver la sección "Una instalación por consultorio" de `.env.example`.

## Comandos

```bash
npm run build        # Compilar TypeScript
npm run start:dev    # Modo desarrollo (watch + auto-restart)
```

El servidor corre en `http://localhost:3000`.

> **El esquema.** Nada del código borra la base sin que una persona lo confirme (ver
> `backend/src/shared/db/schema.ts`). Lo que agrega (tablas y columnas nuevas) se aplica solo: al
> arrancar en local y con `npm run deploy:migrate`, que es lo que corre Railway antes de cada
> despliegue (`preDeployCommand` en `railway.json`). Lo que borra o reescribe una columna que ya
> existe no se aplica nunca solo: `npm run schema:plan` lo muestra y `npm run schema:apply` lo
> aplica, con un respaldo hecho y el nombre de la base escrito como confirmación
> (`npm run schema:apply -- --confirmar=<base>`). `schemaSafety.test.ts` falla si aparece en el
> código un `dropSchema`, un `updateSchema` fuera de ese módulo o un `drop database`, aunque sea
> comentado.

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

- Access token (15 min): header `Authorization: Bearer <token>`
- Refresh token (30 días): cookie httpOnly. El front tiene que llamar a `/api/refreshToken`
  con `withCredentials: true`
- Una persona con `active = false` está deshabilitada: no puede loguearse, renovar el token,
  recuperar la contraseña ni usar ningún endpoint autenticado (403 con `code: "USER_DISABLED"`)

## Arquitectura

```
backend/src/
├── app.ts                 # Entry point
├── appointments/          # Turnos (incluyen paciente y observaciones)
├── people/                # Usuarios
├── offices/               # Consultorios
├── rooms/                 # Salas
├── schedule/              # Horarios de profesionales
├── cities/ + provinces/   # Geografía
├── config/                # Groq, Brevo, JWT middleware
├── prompts/               # Prompts para la IA
└── jobs/                  # Cron jobs (recordatorios)
```
