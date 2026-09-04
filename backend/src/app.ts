process.env.TZ = "America/Argentina/Buenos_Aires";

import "reflect-metadata";
import express from "express";
import cors from "cors";
import { provinceRouter } from "./provinces/provinces.routes.js";
import { cityRouter } from "./cities/cities.routes.js";
import { personRouter } from "./people/people.routes.js";
import { officeRouter } from "./offices/offices.routes.js";
import { roomRouter } from "./rooms/rooms.routes.js";
import { orm, syncSchema } from "./shared/db/orm.js";
import { RequestContext } from "@mikro-orm/core";
import { verifyToken } from "./config/middlewares.js";
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
import { recurrenceRouter } from "./recurrences/recurrences.routes.js";
import { analyticsRouter } from "./analytics/analytics.routes.js";
import { agendaRouter } from "./agenda/agenda.routes.js";
import { settingsRouter } from "./settings/settings.routes.js";
import { announcementRouter } from "./announcements/announcements.routes.js";
import { securityRouter } from "./security/security.routes.js";
import { contactRouter } from "./contact/contact.routes.js";
import { assistantRouter } from "./assistant/assistant.routes.js";
import { calendarRouter } from "./calendar/calendar.routes.js";
import { setupSwagger } from './config/swagger.js';
import { authLimiter, generalLimiter } from "./config/rateLimiter.js";


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

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Bloqueado por CORS: Este origen no está permitido"));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders,
  exposedHeaders
}));

app.options('*', cors());

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
app.use("/api/refreshToken",authLimiter, refreshToken);
app.use("/api/appointments", verifyToken, appointmentRouter);
app.use("/api/recurrences", verifyToken, recurrenceRouter);
app.use("/api/analytics", verifyToken, analyticsRouter);
app.use("/api/agenda", verifyToken, agendaRouter);
app.use("/api/settings", verifyToken, settingsRouter);
app.use("/api/announcements", verifyToken, announcementRouter);
app.use("/api/security", verifyToken, securityRouter);
app.use("/api/assistant", verifyToken, assistantRouter);
app.use("/api/calendar", verifyToken, calendarRouter);
// Sin verifyToken a propósito: cualquiera tiene que poder escribirle al consultorio.
app.use("/api/contact", contactRouter);

app.use((_, res) => {
  return res.status(404).send({ message: "Resource not found" });
});

if (!isProduction){
  await syncSchema(); //Never in production
}

startReminderJob();
startRecurrenceJob();
startExpiryJob();
startAttendanceJob();
startPaymentJob();

// El puerto lo asigna la plataforma y llega por variable; en local no está y sigue
// siendo 3000, que es lo que espera el proxy de Vite.
const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`Server runnning on http://localhost:${port}/`);
});

