import { Router } from "express";
import { findAll, findAllActive, findOne, add, update, toggleRoomState, sanitizeRoomInput, findRoomsByOfficeAndProfessional } from "./rooms.controller.js";
import { verifyAdmin } from "../config/middlewares.js";

export const roomRouter = Router();

roomRouter.get("/", verifyAdmin, findAll);
roomRouter.get("/active", findAllActive);
roomRouter.get("/:idRoom", findOne);
roomRouter.get("/office/professional/:officeId/:email", findRoomsByOfficeAndProfessional);
roomRouter.post("/", verifyAdmin, sanitizeRoomInput, add);
roomRouter.put("/:idRoom", verifyAdmin, sanitizeRoomInput, update);
roomRouter.patch("/:idRoom", verifyAdmin, sanitizeRoomInput, update);
roomRouter.patch("/:idCity/toggle-state", verifyAdmin, sanitizeRoomInput, toggleRoomState);
