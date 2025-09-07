import { Router } from "express";
import { findAll, findAllActive, findOne, add, update, toggleCityState, sanitizeCityInput } from "./cities.controller.js";
import { verifyAdmin } from "../config/middlewares.js";

export const cityRouter = Router();

cityRouter.get("/", verifyAdmin, findAll);
cityRouter.get("/active", findAllActive);
cityRouter.get("/:idCity", findOne);
cityRouter.post("/", verifyAdmin, sanitizeCityInput, add);
cityRouter.put("/:idCity", verifyAdmin, sanitizeCityInput, update);
cityRouter.patch("/:idCity", verifyAdmin, sanitizeCityInput, update);
cityRouter.patch("/:idCity/toggle-state", verifyAdmin, sanitizeCityInput, toggleCityState);
