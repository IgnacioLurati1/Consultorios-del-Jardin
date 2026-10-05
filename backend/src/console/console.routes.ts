import { Router } from "express";
import { createAdmin, getRules, login, patchRules, status } from "./console.controller.js";
import { onlyOwner, requireConsoleOrigin } from "./console.guard.js";
import { consoleLoginLimiter, consoleWriteLimiter } from "../config/rateLimiter.js";

/**
 * Las rutas de la consola de instalaciones.
 *
 * `requireConsoleOrigin` va en todas, incluida la de entrar: ahí todavía no hay token, así
 * que el origen es el único filtro antes del limitador y de la contraseña.
 *
 * El router se monta sin `verifyToken`, a propósito. La sesión de la aplicación no abre
 * nada de acá, y mezclar los dos middlewares haría parecer que sí.
 */
export const consoleRouter = Router();

consoleRouter.post("/login", requireConsoleOrigin, consoleLoginLimiter, login);
consoleRouter.get("/status", requireConsoleOrigin, onlyOwner, status);
consoleRouter.post("/admins", requireConsoleOrigin, onlyOwner, consoleWriteLimiter, createAdmin);
consoleRouter.get("/rules", requireConsoleOrigin, onlyOwner, getRules);
consoleRouter.patch("/rules", requireConsoleOrigin, onlyOwner, consoleWriteLimiter, patchRules);
