import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { sendContactMessage } from "./contact.controller.js";
import { contactLimiter } from "../config/rateLimiter.js";

export const contactRouter = Router();

/** Un CV pesa unos cientos de kilobytes; cinco megas dejan pasar hasta uno con fotos. */
export const MAX_CV_BYTES = 5 * 1024 * 1024;

/** PDF o Word. Son los que se abren en cualquier lado sin instalar nada. */
const CV_NAME = /\.(pdf|docx?|odt)$/i;

/**
 * El CV se queda en memoria y sale en el mail: no toca el disco ni la base.
 *
 * Es un documento con datos personales de alguien que todavía no tiene nada que ver con el
 * consultorio. Guardarlo sería tener que cuidarlo y acordarse de borrarlo; en el mail ya
 * está donde lo va a leer quien tiene que leerlo.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CV_BYTES, files: 1, fields: 12 },
  fileFilter: (_req, file, done) => {
    if (CV_NAME.test(file.originalname)) return done(null, true);
    done(Object.assign(new Error("Tipo de archivo"), { code: "CV_TYPE" }));
  },
});

/**
 * Traduce los errores de multer, que no pasan por el controlador. Sin esto, un archivo
 * grande contesta el error de la librería, en inglés.
 *
 * Un envío sin archivo (el formulario de siempre, en JSON) pasa derecho: multer solo mira
 * los formularios con archivos.
 */
function receiveCv(req: Request, res: Response, next: NextFunction) {
  upload.single("cv")(req, res, (error: any) => {
    if (!error) return next();

    if (error.code === "LIMIT_FILE_SIZE") return res.status(400).json({ message: "El CV supera los 5 MB" });
    if (error.code === "CV_TYPE") return res.status(400).json({ message: "El CV tiene que ser PDF o Word" });

    return res.status(400).json({ message: "No se pudo leer el archivo adjunto" });
  });
}

/**
 * @swagger
 * /api/contact:
 *   post:
 *     summary: Enviar una consulta por mail al consultorio
 *     description: >
 *       Público: no hace falta tener cuenta. El mail sale desde la casilla del
 *       consultorio con el `replyTo` de quien escribió, y quien escribió recibe un
 *       acuse. Está limitado por IP para que no se use como relay de spam.
 *
 *       Con el motivo `profesional` el teléfono es obligatorio, se puede adjuntar un CV
 *       (PDF o Word, hasta 5 MB, como multipart en el campo `cv`) y el mail les llega
 *       también a los administradores, con un aviso en la campanita. El CV no se guarda.
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, reason, message]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *                 description: Obligatorio con el motivo profesional.
 *               reason:
 *                 type: string
 *                 enum: [turnos, profesional, sugerencia, otro]
 *               message:
 *                 type: string
 *               website:
 *                 type: string
 *                 description: Campo trampa. Si viene con texto, el envío se descarta.
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               cv:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Mensaje enviado
 *       400:
 *         description: Faltan datos o alguno no es válido
 *       429:
 *         description: Demasiadas consultas desde la misma IP
 */
contactRouter.post("/", contactLimiter, receiveCv, sendContactMessage);
