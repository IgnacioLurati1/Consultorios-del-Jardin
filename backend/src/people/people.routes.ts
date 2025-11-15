import { Router } from "express";
import {
  sanitizePersonInput,
  findAll,
  findOne,
  add,
  update,
  loginWithEmailAndPassword,
  logOut,
  remove,
  toggleState,
  changePassword,
  sendPasswordMail,
  findAllPerType,
  findAllNoAdmin,
  findProfesionalByOffice,
  findAllPerTypeActive
} from "./people.controller.js";
import { verifyToken, verifyAdmin } from "../config/middlewares.js";

export const personRouter = Router();

personRouter.get("/", verifyToken, verifyAdmin, findAll);
personRouter.get("/NoAdmin", verifyToken, verifyAdmin, findAllNoAdmin)
personRouter.get("/:email", verifyToken, findOne);
personRouter.get("/type/:peopleType", verifyToken, verifyAdmin, findAllPerType);
personRouter.get("/type/active/:peopleType", verifyToken, findAllPerTypeActive);
personRouter.get("/professionals/office/:officeId/:speciality?",verifyToken, findProfesionalByOffice); // nueva ruta para obtener profesionales por consultorio y especialidad
personRouter.post("/", sanitizePersonInput, add);
personRouter.post("/login", sanitizePersonInput, loginWithEmailAndPassword);
personRouter.post("/logout", logOut);
personRouter.patch("/changePassword", sanitizePersonInput, changePassword);
personRouter.put("/:email", verifyToken, sanitizePersonInput, update);
personRouter.patch("/:email", verifyToken, sanitizePersonInput, update);
personRouter.delete("/:email", verifyToken, verifyAdmin, sanitizePersonInput, remove);
personRouter.patch("/:email/toggleState", verifyToken, verifyAdmin, sanitizePersonInput, toggleState);
personRouter.post("/:email/passwordMail", sendPasswordMail);
