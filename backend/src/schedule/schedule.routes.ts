import { Router } from 'express';
import { 
  sanitizeScheduleInput,
  findAll,
  findOne,
  add,
  update,
  toggleScheduleState,
  findByEmailAndRoom
} from './schedule.controller.js';

export const scheduleRouter = Router();

scheduleRouter.get('/', findAll);
scheduleRouter.get('/:idSchedule', findOne);
scheduleRouter.get('/email/:email/room/:idRoom', findByEmailAndRoom);
scheduleRouter.post('/', sanitizeScheduleInput, add);
scheduleRouter.put('/', sanitizeScheduleInput, update);
scheduleRouter.patch('/', sanitizeScheduleInput, update);
scheduleRouter.patch('/toggle', toggleScheduleState);
