import { Router } from "express";
import {
  sanitizeScheduleInput,
  findAll,
  findOne,
  add,
  update,
  remove,
  findByEmail,
  findByProfesionalLogged,
} from "./schedule.controller.js";
import { verify } from "crypto";
import { verifyAdmin } from "../config/middlewares.js";

export const scheduleRouter = Router();
//Rutas menos genericas primero
scheduleRouter.get("/", findAll);
scheduleRouter.get("/profesional", findByProfesionalLogged); // ruta para horarios del profesional logueado
scheduleRouter.get("/by-email/:email", findByEmail); // ex-ruta para PRUEBAS, ahora usada en horarios ADMIN
scheduleRouter.get("/by-day-hour/:day/:initialHour", findOne);
scheduleRouter.post("/", sanitizeScheduleInput, add);
scheduleRouter.put("/", sanitizeScheduleInput, update);
scheduleRouter.patch("/", sanitizeScheduleInput, update);
scheduleRouter.delete("/by-day-hour/:day/:initialHour/:person", remove); //ruta para eliminar un horario especifico de un profesional
