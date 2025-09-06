import { Router } from "express";
import { sanitizePersonInput, findAll, findOne, add, update, loginWithEmailAndPassword, logOut, remove } from "./people.controller.js";

export const personRouter = Router();

personRouter.get("/", findAll);
personRouter.get("/:email", findOne);
personRouter.post("/", sanitizePersonInput, add);
personRouter.post("/login", loginWithEmailAndPassword);
personRouter.post("/logout", logOut);
personRouter.put("/:email", sanitizePersonInput, update);
personRouter.patch("/:email", sanitizePersonInput, update);
personRouter.delete("/delete:email", sanitizePersonInput, remove);
