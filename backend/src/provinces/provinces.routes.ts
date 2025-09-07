import { Router } from "express";
import { sanitizeProvinceInput, findAll, findAllActive, findOne, add, update, toggleProvinceState } from "./provinces.controller.js";
import { verifyAdmin } from "../config/middlewares.js";

export const provinceRouter = Router();

provinceRouter.get("/", verifyAdmin, findAll);
provinceRouter.get("/active", findAllActive);
provinceRouter.get("/:idProvince", findOne);
provinceRouter.post("/", verifyAdmin, sanitizeProvinceInput, add);
provinceRouter.put("/:idProvince", verifyAdmin, sanitizeProvinceInput, update);
provinceRouter.patch("/:idProvince", verifyAdmin, sanitizeProvinceInput, update);
provinceRouter.patch("/:idProvince/toggle-state", verifyAdmin, sanitizeProvinceInput, toggleProvinceState);
