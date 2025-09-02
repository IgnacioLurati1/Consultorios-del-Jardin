import {Router} from 'express';
import {
  findAll,
  findAllActive,
  findOne,
  add,
  update,
  toggleRoomState,
  sanitizeRoomInput
} from './rooms.controller.js';

  export const roomRouter = Router();

  roomRouter.get('/', findAll)
  roomRouter.get('/active', findAllActive)
  roomRouter.get('/:idRoom', findOne)
  roomRouter.post('/', sanitizeRoomInput, add);
  roomRouter.put('/:idRoom', sanitizeRoomInput, update);
  roomRouter.patch('/:idRoom', sanitizeRoomInput, update);
  roomRouter.patch('/:idCity/toggle-state', sanitizeRoomInput, toggleRoomState);
