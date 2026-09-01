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
import { recurrenceRouter } from "./recurrences/recurrences.routes.js";
import { analyticsRouter } from "./analytics/analytics.routes.js";
import { contactRouter } from "./contact/contact.routes.js";
import { assistantRouter } from "./assistant/assistant.routes.js";
import { setupSwagger } from './config/swagger.js';
import { authLimiter, generalLimiter } from "./config/rateLimiter.js";


const app = express();

// Sin deploy: el proyecto corre solo en local.
// Nota: no se setea "trust proxy". Sin un proxy adelante, confiar en X-Forwarded-For
// permitiría falsear la IP y esquivar el rate limiter. Si algún día se despliega
// detrás de un proxy, hay que volver a poner app.set("trust proxy", 1).
const allowedOrigins = [
  "http://localhost:5173", // Vite (front)
  "http://localhost:3000"  // el propio backend (Swagger)
];

// La app nativa no manda Origin (no es un browser), así que cae en el `!origin` de abajo
// y CORS no la toca. Los headers sí hay que declararlos: son los que usa para mandar el
// refresh token, que en la app no puede viajar en una cookie. Ver config/clients.ts.
const allowedHeaders = ["Content-Type", "Authorization", "Cookie", "X-Client", "X-Refresh-Token"];

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
  allowedHeaders
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
app.use("/api/assistant", verifyToken, assistantRouter);
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

app.listen(3000, () => {
  console.log("Server runnning on http://localhost:3000/");
});

