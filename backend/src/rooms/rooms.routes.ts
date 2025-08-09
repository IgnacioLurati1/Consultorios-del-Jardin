import {Router} from 'express';
import {
  findAll,
  findOne,
  add,
  update,
  remove,
  sanitizeRoomInput,
  validateRoomInput,
  validateRoomUpdateInput
} from './rooms.controller.js';

  export const roomRouter = Router();

  roomRouter.get('/', findAll);
  roomRouter.get('/:idRoom', findOne);
  roomRouter.post('/', sanitizeRoomInput, validateRoomInput, add);
  roomRouter.put('/:idRoom', sanitizeRoomInput, validateRoomUpdateInput, update);
  roomRouter.patch('/:idRoom', sanitizeRoomInput, validateRoomUpdateInput, update);
  roomRouter.delete('/:idRoom', remove);
  roomRouter.delete('/', (req, res) => {
  res.status(400).json({ error: 'idRoom is required in the URL' });
  });

