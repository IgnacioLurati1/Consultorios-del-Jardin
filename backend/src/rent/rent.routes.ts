import { Router } from "express";
import {
  exportMonth,
  getCalculation,
  getFreeBlocks,
  getIncreaseSimulation,
  getMonth,
  getPrices,
  postCalculation,
  postIncrease,
  putAmount,
  putPayment,
  putPrices,
  putSettings,
} from "./rent.controller.js";

/**
 * Cobro de alquileres a los profesionales. Todo es del administrador: la ruta entera va
 * detrás de verifyAdmin (ver app.ts).
 */
export const rentRouter = Router();

/**
 * @swagger
 * /api/rent/month/{month}:
 *   get:
 *     summary: Las cuotas de alquiler de un mes (solo admin)
 *     description: >
 *       Una fila por profesional con su cuota, lo pagado, el saldo y si pagó fuera de
 *       término. El mes en curso crea las cuotas que falten; el que viene muestra lo que
 *       saldría con las reglas de hoy, sin guardar nada.
 *     tags: [Rent]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: month
 *         required: true
 *         schema: { type: string, example: "2026-09" }
 *     responses:
 *       200:
 *         description: Las cuotas y los totales del mes
 *       400:
 *         description: El mes no existe o es posterior al que viene
 *       403:
 *         description: Solo para el administrador
 */
rentRouter.get("/month/:month", getMonth);

/**
 * @swagger
 * /api/rent/month/{month}/export:
 *   get:
 *     summary: Planilla de Excel del mes, con el histórico de todas las cuotas
 *     tags: [Rent]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: El archivo .xlsx
 */
rentRouter.get("/month/:month/export", exportMonth);

/**
 * @swagger
 * /api/rent/charges/{month}/{email}/amount:
 *   put:
 *     summary: Escribe la cuota de un profesional a mano
 *     description: >
 *       Desde el mes en curso en adelante queda como su cuota fija hasta el próximo cambio.
 *       En un mes pasado corrige solo ese mes. Devuelve el mes entero.
 *     tags: [Rent]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount: { type: integer }
 */
rentRouter.put("/charges/:month/:email/amount", putAmount);

/**
 * @swagger
 * /api/rent/charges/{month}/{email}/payment:
 *   put:
 *     summary: Registra el pago de una cuota
 *     tags: [Rent]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [paid, partial, unpaid] }
 *               paidAmount: { type: integer, description: Solo en los pagos parciales }
 *               paidOn: { type: string, format: date, description: Por defecto hoy. No puede ser futura }
 */
rentRouter.put("/charges/:month/:email/payment", putPayment);

/**
 * @swagger
 * /api/rent/prices:
 *   get:
 *     summary: El precio de cada bloque de cada consultorio en un mes
 *     tags: [Rent]
 *   put:
 *     summary: Cambia precios de bloques desde este mes o el que viene
 *     tags: [Rent]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fromMonth: { type: string, example: "2026-10" }
 *               prices:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     idRoom: { type: integer }
 *                     block: { type: string, enum: [morning, afternoon] }
 *                     price: { type: integer, nullable: true }
 */
rentRouter.get("/prices", getPrices);
rentRouter.put("/prices", putPrices);

/**
 * @swagger
 * /api/rent/settings:
 *   put:
 *     summary: Cambia el día de vencimiento de las cuotas (1 a 28)
 *     tags: [Rent]
 */
rentRouter.put("/settings", putSettings);

/**
 * @swagger
 * /api/rent/calculate:
 *   get:
 *     summary: Previa de las cuotas calculadas con los bloques, sin guardar
 *     tags: [Rent]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, example: "2026-09" }
 *   post:
 *     summary: Pasa a calcular por bloques la cuota de los elegidos
 *     tags: [Rent]
 */
rentRouter.get("/calculate", getCalculation);
rentRouter.post("/calculate", postCalculation);

/**
 * @swagger
 * /api/rent/increase:
 *   post:
 *     summary: Aumento en porcentaje para todos o para algunos, desde este mes o el que viene
 *     tags: [Rent]
 */
rentRouter.post("/increase", postIncrease);

/**
 * @swagger
 * /api/rent/potential/free-blocks:
 *   get:
 *     summary: Los bloques libres de cada consultorio y cuánto dejarían alquilados
 *     description: Recorre la agenda entera. Se pide a mano desde los números, nunca solo.
 *     tags: [Rent]
 * /api/rent/potential/increase:
 *   get:
 *     summary: Cuánto más entraría con un aumento del alquiler
 *     tags: [Rent]
 *     parameters:
 *       - in: query
 *         name: mode
 *         schema: { type: string, enum: [percent, amount] }
 *       - in: query
 *         name: value
 *         schema: { type: number }
 */
rentRouter.get("/potential/free-blocks", getFreeBlocks);
rentRouter.get("/potential/increase", getIncreaseSimulation);
