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
import { setupSwagger } from './config/swagger.js';


const app = express();
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors({
  // Reemplaza esto con tu URL real de Vercel
  origin: ["dsw-autogestora-de-turnos-production.up.railway.app", "http://localhost:5173"], 
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"]
}));

app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  RequestContext.create(orm.em, next);
});

if (!isProduction) {
  setupSwagger(app); // documentacion de endpoints
}

app.use("/api/provinces", verifyToken, provinceRouter);
app.use("/api/cities", verifyToken, cityRouter);
app.use("/api/people", personRouter);
app.use("/api/offices", verifyToken, officeRouter);
app.use("/api/rooms", verifyToken, roomRouter);
app.use("/api/schedules", verifyToken, scheduleRouter);
app.use("/api/tokenStatus", verifyToken, (req: Request, res: Response) => {
  res.status(200).json({ message: "Token válido" });
});
app.use("/api/refreshToken", refreshToken);
app.use("/api/appointments", verifyToken, appointmentRouter);

app.use((_, res) => {
  return res.status(404).send({ message: "Resource not found" });
});

if (!isProduction){
  await syncSchema(); //Never in production
}

startReminderJob();

app.listen(3000, () => {
  console.log("Server runnning on http://localhost:3000/");
});
