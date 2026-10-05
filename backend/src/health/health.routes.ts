import { Router } from "express";
import { health, healthCors } from "./health.controller.js";
import { healthLimiter } from "../config/rateLimiter.js";

/**
 * La ruta de salud. Pública, sin sesión y con su propio limitador.
 *
 * Va montada antes del CORS general y del limitador general (ver app.ts), así que todo lo
 * que necesita lo trae acá: sus cabeceras de CORS primero, para que hasta el 429 del
 * limitador lo pueda leer la consola, y después el limitador.
 */
export const healthRouter = Router();

// Solo en "/" y no con un `use` para todo el router: /api/health/otra-cosa no es esta ruta,
// sigue de largo hasta el 404 de siempre y con el CORS de siempre.
healthRouter.options("/", healthCors);

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Estado del servidor, sin sesión
 *     description: >
 *       Dice si el proceso y la base contestan, qué versión corre y cuándo corrió por última
 *       vez cada tarea programada. Abierta a cualquier origen y sin datos de personas.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: El servidor contesta y la base también. `ok` es false si hay una tarea atrasada
 *       503:
 *         description: La base no contesta
 */
healthRouter.get("/", healthCors, healthLimiter, health);
