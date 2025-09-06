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
  accept,
} from "./people.controller.js";
import { verifyToken } from "../config/middlewares.js";

export const personRouter = Router();

personRouter.get("/", verifyToken, findAll);
personRouter.get("/:email", verifyToken, findOne);
personRouter.post("/", sanitizePersonInput, add);
personRouter.post("/login", loginWithEmailAndPassword);
personRouter.post("/logout", logOut);
personRouter.put("/:email", verifyToken, sanitizePersonInput, update);
personRouter.patch("/:email", verifyToken, sanitizePersonInput, update);
personRouter.delete("/:email", verifyToken, sanitizePersonInput, remove);
personRouter.patch("/:email/accept", verifyToken, sanitizePersonInput, accept);
