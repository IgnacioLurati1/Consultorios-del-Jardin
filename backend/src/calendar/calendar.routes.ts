import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { importLimiter } from "../config/rateLimiter.js";
import { exportCalendar, previewImport, runImport } from "./calendar.controller.js";

export const calendarRouter = Router();

/** Un Takeout con años de calendario pesa poco; veinticinco megas sobran de lejos. */
const MAX_FILE_BYTES = 25 * 1024 * 1024;

/**
 * El archivo se queda en memoria y no toca el disco.
 *
 * Se lee una vez, se convierte en turnos y se descarta. Escribirlo en algún lado
 * significaría tener guardado el calendario personal de alguien —con los nombres de sus
 * pacientes adentro— hasta que a alguien se le ocurra borrarlo.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

/**
 * Traduce los errores de multer, que son los únicos que no pasan por el controlador.
 *
 * Sin esto, un archivo más grande que el tope contesta el error crudo de la librería: en
 * inglés y con el nombre del campo del formulario adentro.
 */
function receiveFile(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (error: any) => {
    if (!error) return next();

    if (error.code === "LIMIT_FILE_SIZE")
      return res.status(400).json({ message: "El archivo es demasiado grande. Exportá un calendario a la vez." });

    return res.status(400).json({ message: "No pudimos leer el archivo que subiste" });
  });
}

/**
 * @swagger
 * /api/calendar/import/preview:
 *   post:
 *     summary: Qué turnos entrarían al importar un calendario, sin guardar nada
 *     description: >
 *       Lee un .ics o el zip de Google Takeout y devuelve el plan: los turnos que se
 *       crearían y los eventos que se saltean, cada uno con su motivo. No escribe nada.
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, from, to]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               from: { type: string, format: date }
 *               to: { type: string, format: date }
 *               state:
 *                 type: string
 *                 enum: [past-assisted, all-accepted, all-assisted]
 *               payment:
 *                 type: string
 *                 enum: [past-paid, all-paid, none, unset]
 *               keepTitle:
 *                 type: boolean
 *                 description: Guardar el título del evento en las observaciones del turno
 *     responses:
 *       200:
 *         description: El plan de importación
 *       400:
 *         description: El archivo no se pudo leer, o faltan las fechas
 *       403:
 *         description: Solo para profesionales
 */
calendarRouter.post("/import/preview", importLimiter, receiveFile, previewImport);

/**
 * @swagger
 * /api/calendar/import:
 *   post:
 *     summary: Importa los turnos de un calendario exportado
 *     description: >
 *       Mismo cuerpo que la previa. Los turnos entran sin paciente, sin valor cuando el
 *       evento no lo dice, y ninguno queda como turno repetible.
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Turnos importados
 *       400:
 *         description: El archivo no se pudo leer, o faltan las fechas
 *       403:
 *         description: Solo para profesionales
 */
calendarRouter.post("/import", importLimiter, receiveFile, runImport);

/**
 * @swagger
 * /api/calendar/export:
 *   get:
 *     summary: Baja la agenda del profesional como archivo de calendario
 *     description: >
 *       Devuelve un `.ics` con los turnos del tramo pedido, listo para abrir en Google
 *       Calendar, Outlook o el calendario del teléfono. Cada turno lleva siempre el mismo
 *       identificador, así que volver a subir el archivo actualiza los eventos en vez de
 *       duplicarlos. La cantidad exportada viene en el encabezado `X-Appointments`.
 *     tags: [Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: includeCancelled
 *         schema: { type: boolean }
 *         description: Incluir los turnos dados de baja, marcados como cancelados
 *       - in: query
 *         name: withPatientName
 *         schema: { type: boolean }
 *         description: Poner el nombre del paciente en el título del evento
 *     responses:
 *       200:
 *         description: El archivo de calendario
 *         content:
 *           text/calendar:
 *             schema: { type: string }
 *       400:
 *         description: Faltan las fechas o están al revés
 *       403:
 *         description: Solo para profesionales
 */
calendarRouter.get("/export", exportCalendar);
