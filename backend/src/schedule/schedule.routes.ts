import { Router } from 'express';
import { 
  sanitizeScheduleInput,
  findAll,
  findOne,
  add,
  update,
  toggleScheduleState,
  findByEmail,
  findByProfesionalLogged
} from './schedule.controller.js';

export const scheduleRouter = Router();
//Rutas menos genericas primero
scheduleRouter.get('/', findAll);
scheduleRouter.get('/profesional', findByProfesionalLogged); // ruta para horarios del profesional logueado
scheduleRouter.get('/by-email/:email', findByEmail); // ruta para PRUEBAS
scheduleRouter.get('/by-day-hour/:day/:initialHour', findOne);
scheduleRouter.post('/', sanitizeScheduleInput, add);
scheduleRouter.put('/', sanitizeScheduleInput, update);
scheduleRouter.patch('/', sanitizeScheduleInput, update);
scheduleRouter.patch('/toggle', toggleScheduleState);
