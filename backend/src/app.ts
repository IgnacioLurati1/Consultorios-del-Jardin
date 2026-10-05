// La zona del consultorio (ver shared/timezone). Va primero para que todo lo que sigue la use.
process.env.TZ = (process.env.TIMEZONE ?? "").trim() || "America/Argentina/Buenos_Aires";

import "reflect-metadata";
import express from "express";
import cors from "cors";
import { provinceRouter } from "./provinces/provinces.routes.js";
import { cityRouter } from "./cities/cities.routes.js";
import { personRouter } from "./people/people.routes.js";
import { officeRouter } from "./offices/offices.routes.js";
import { roomRouter } from "./rooms/rooms.routes.js";
import { orm } from "./shared/db/orm.js";
import { applyAdditions, pendingOf } from "./shared/db/schema.js";
import { RequestContext } from "@mikro-orm/core";
import { verifyAdmin, verifyToken } from "./config/middlewares.js";
import { Request, Response } from "express";
import { scheduleRouter } from "./schedule/schedule.routes.js";
import refreshToken from "./config/refreshToken.js";
import cookieParser from "cookie-parser";
import { appointmentRouter } from "./appointments/appointments.routes.js";
import { startReminderJob } from "./jobs/reminder.job.js";
import { startRecurrenceJob } from "./jobs/recurrence.job.js";
import { startExpiryJob } from "./jobs/expiry.job.js";
import { startAttendanceJob } from "./jobs/attendance.job.js";
import { startPaymentJob } from "./jobs/payment.job.js";
import { startNotificationCleanupJob } from "./jobs/notifications.job.js";
import { startAccountCleanupJob } from "./jobs/cleanup.job.js";
import { startMailBounceJob } from "./jobs/mailBounce.job.js";
import { recurrenceRouter } from "./recurrences/recurrences.routes.js";
import { analyticsRouter } from "./analytics/analytics.routes.js";
import { agendaRouter } from "./agenda/agenda.routes.js";
import { settingsRouter } from "./settings/settings.routes.js";
import { adminVacationsRouter } from "./settings/vacations.admin.js";
import { announcementRouter } from "./announcements/announcements.routes.js";
import { notificationRouter } from "./notifications/notifications.routes.js";
import { securityRouter } from "./security/security.routes.js";
import { contactRouter } from "./contact/contact.routes.js";
import { assistantRouter } from "./assistant/assistant.routes.js";
import { calendarRouter } from "./calendar/calendar.routes.js";
import { waitlistRouter } from "./waitlist/waitlist.routes.js";
import { attendanceRouter } from "./attendance/attendance.routes.js";
import { startWaitlistJob } from "./jobs/waitlist.job.js";
import { rentRouter } from "./rent/rent.routes.js";
import { startRentJob } from "./jobs/rent.job.js";
import { setupSwagger } from './config/swagger.js';
import { attendanceLimiter, authLimiter, generalLimiter, refreshLimiter } from "./config/rateLimiter.js";
import { consoleRouter } from "./console/console.routes.js";
import { installationRouter } from "./installation/installation.routes.js";
import { consoleOrigins } from "./console/console.guard.js";
import { healthRouter } from "./health/health.routes.js";
import { checkEnv } from "./config/envCheck.js";

// Antes que nada: si la configuración está incompleta, esto no arranca y dice qué falta.
// Con varias instalaciones del mismo código, un deploy con una variable sin cargar deja de
// ser un descuido raro. Ver config/envCheck.
checkEnv();

const app = express();

// Desplegado, el servidor no ve al visitante: ve al proxy de la plataforma. Sin esto la
// IP de todas las requests es la misma y el limitador de intentos de login cuenta a todo
// el mundo junto —o sea, no limita a nadie—. En local no va: sin un proxy adelante,
// confiar en X-Forwarded-For deja falsear la IP y esquivar el limitador escribiendo un
// header.
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// De dónde se acepta que venga el navegador. La dirección del front cambia con el
// deploy, así que viaja en una variable y no acá adentro; se pueden poner varias
// separadas por coma (la de producción y una de prueba, por ejemplo).
const configuredOrigins = (process.env.WEB_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const allowedOrigins = [
  ...configuredOrigins,
  "http://localhost:5173", // Vite (front)
  "http://localhost:3000"  // el propio backend (Swagger)
];

// La app móvil corre en un navegador solo mientras se la desarrolla, para poder mirar
// las pantallas sin el teléfono a mano (`npm run web` en Frontend/mobile). En el
// teléfono no pasa por acá: las requests nativas no mandan Origin.
if (process.env.NODE_ENV !== "production") {
  allowedOrigins.push("http://localhost:8081", "http://localhost:8082");
}

// La app nativa no manda Origin (no es un browser), así que cae en el `!origin` de abajo
// y CORS no la toca. Los headers sí hay que declararlos: son los que usa para mandar el
// refresh token, que en la app no puede viajar en una cookie. Ver config/clients.ts.
const allowedHeaders = ["Content-Type", "Authorization", "Cookie", "X-Client", "X-Refresh-Token"];

// Los encabezados de la respuesta que el navegador puede leer. Por defecto no deja ver
// ninguno propio, y la descarga de la agenda cuenta ahi cuantos turnos entraron.
const exposedHeaders = ["Content-Disposition", "X-Appointments"];

// La consola de instalaciones vive en su propio dominio y no comparte la lista de arriba.
// Ver console/console.guard.
const CONSOLE_PATH = "/api/console";

/**
 * La lista de origenes depende de la ruta.
 *
 * Son dos políticas distintas sobre la misma aplicación. En la de siempre, una request sin
 * `Origin` pasa: es la app nativa, un curl o el cron, y CORS no la protege de nada. En la
 * consola el origen es obligatorio y tiene que ser el suyo, porque ahí lo que se evita es
 * que una página cualquiera abierta en mi navegador use mi sesión.
 *
 * Antes de esto había además un `app.options('*', cors())` suelto al final, con la
 * configuración por defecto de la librería: el preflight contestaba reflejando cualquier
 * origen y la lista de acá no se aplicaba. Ya no está; el middleware de CORS contesta el
 * preflight por su cuenta.
 */
function corsFor(req: Request): Parameters<typeof cors>[0] {
  const esConsola = req.path.startsWith(CONSOLE_PATH);
  const permitidos = esConsola ? consoleOrigins() : allowedOrigins;

  return {
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      if (esConsola) {
        const limpio = (origin ?? "").replace(/\/+$/, "");
        // Sin error a propósito. Un Error acá lo toma el manejador de errores de Express y
        // contesta 500: el navegador queda bloqueado igual, porque no va la cabecera que
        // permite el origen, pero la request no llega a requireConsoleOrigin y el intento
        // no queda anotado en ningún lado. Así llega, contesta 403 y se escribe quién fue.
        return callback(null, limpio !== "" && permitidos.includes(limpio));
      }

      if (!origin || permitidos.includes(origin)) return callback(null, true);
      return callback(new Error("Bloqueado por CORS: Este origen no está permitido"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders,
    exposedHeaders
  };
}

// La ruta de salud va antes que el CORS de arriba, a propósito: contesta a cualquier origen
// con `*` y sin credenciales, y trae su propio limitador. Es la única excepción a la lista
// de orígenes. Ver health/health.controller.
app.use("/api/health", healthRouter);

app.use((req, res, next) => cors(corsFor(req))(req, res, next));

const isProduction = process.env.NODE_ENV === 'production';
app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  RequestContext.create(orm.em, next);
});

if (!isProduction) {
  setupSwagger(app); // documentacion de endpoints
}

app.use("/api", generalLimiter); // Limiter general para todas las rutas

app.use("/api/provinces", verifyToken, provinceRouter);
app.use("/api/cities", verifyToken, cityRouter);
app.use("/api/people", personRouter);
app.use("/api/offices", verifyToken, officeRouter);
app.use("/api/rooms", verifyToken, roomRouter);
app.use("/api/schedules", verifyToken, scheduleRouter);
app.use("/api/tokenStatus", authLimiter, verifyToken, (req: Request, res: Response) => {
  res.status(200).json({ message: "Token válido" });
});
app.use("/api/refreshToken", refreshLimiter, refreshToken);
app.use("/api/appointments", verifyToken, appointmentRouter);
app.use("/api/recurrences", verifyToken, recurrenceRouter);
app.use("/api/analytics", verifyToken, analyticsRouter);
app.use("/api/agenda", verifyToken, agendaRouter);
app.use("/api/settings", verifyToken, settingsRouter);
// Las vacaciones de cada profesional, cargadas por la administración (regla vacations).
app.use("/api/vacations", verifyToken, adminVacationsRouter);
app.use("/api/announcements", verifyToken, announcementRouter);
app.use("/api/notifications", verifyToken, notificationRouter);
app.use("/api/security", verifyToken, securityRouter);
app.use("/api/assistant", verifyToken, assistantRouter);
app.use("/api/calendar", verifyToken, calendarRouter);
app.use("/api/waitlist", verifyToken, waitlistRouter);
// Lo que pagan los profesionales es asunto de la administración y de nadie más.
app.use("/api/rent", verifyToken, verifyAdmin, rentRouter);
// Sin verifyToken a propósito: la portada lee el nombre y la dirección del consultorio
// antes de que nadie inicie sesión. El router pide sesión y administración en las rutas que
// escriben. Ver installation/installation.routes.
app.use("/api/installation", installationRouter);
// Sin verifyToken a propósito, y no porque esté abierta: la consola tiene su propia puerta
// —su dominio, su clave de firma, su lista de cuentas y la contraseña otra vez al crear—, y
// la sesión de la aplicación no abre nada de acá. Ver console/console.guard.
app.use("/api/console", consoleRouter);
// Sin verifyToken a propósito: cualquiera tiene que poder escribirle al consultorio.
app.use("/api/contact", contactRouter);
// Tampoco: son los links del mail del día anterior, que se contestan sin iniciar sesión.
app.use("/api/attendance", attendanceLimiter, attendanceRouter);

app.use((_, res) => {
  return res.status(404).send({ message: "Resource not found" });
});

// En local, la base se pone al día sola con lo que agrega, igual que en el deploy. Nunca
// borra ni reescribe: antes esto aplicaba la diferencia entera, y una versión vieja
// levantada en modo desarrollo le sacaba a la base las columnas nuevas con sus datos. En
// producción lo hace el Pre-Deploy Command (scripts/deploy-migrate), no el arranque.
if (!isProduction) {
  const pending = pendingOf(await applyAdditions());
  if (pending.length) console.warn(`Esquema: ${pending.length} cambio(s) sin aplicar porque borran o reescriben. Ver npm run schema:plan.`);
}

startReminderJob();
startRecurrenceJob();
startExpiryJob();
startAttendanceJob();
startPaymentJob();
startNotificationCleanupJob();
startAccountCleanupJob();
startMailBounceJob();
startWaitlistJob();
startRentJob();

// El puerto lo asigna la plataforma y llega por variable; en local no está y sigue
// siendo 3000, que es lo que espera el proxy de Vite.
const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`Server runnning on http://localhost:${port}/`);
});

