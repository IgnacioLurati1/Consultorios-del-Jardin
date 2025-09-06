import { Router } from 'express';
import { 
  sanitizeScheduleInput,
  findAll,
  findOne,
  add,
  update,
  toggleScheduleState
} from './schedule.controller.js';

export const scheduleRouter = Router();

scheduleRouter.get('/', findAll);
scheduleRouter.get('/:day/:initialHour', findOne);
scheduleRouter.post('/', sanitizeScheduleInput, add);
scheduleRouter.put('/:day/:initialHour', sanitizeScheduleInput, update);
scheduleRouter.patch('/:day/:initialHour', sanitizeScheduleInput, update);
scheduleRouter.patch('/:day/:initialHour/toggle', toggleScheduleState);
