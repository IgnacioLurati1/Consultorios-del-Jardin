import { Router } from "express";
import { getAll, getPublic, patch, preview } from "./installation.controller.js";
import { verifyAdmin, verifyToken } from "../config/middlewares.js";
import { create, list, receiveImage, remove, serve } from "./images.controller.js";
import { imageUploadLimiter } from "../config/rateLimiter.js";

export const installationRouter = Router();

/**
 * @swagger
 * /api/installation:
 *   get:
 *     summary: Los datos públicos del consultorio y las reglas de turnos
 *     description: >
 *       Sin sesión: lo lee la portada antes de que nadie entre. Trae el nombre, la
 *       dirección, el horario publicado y las reglas que la pantalla necesita para no
 *       tener los mismos números escritos de su lado.
 *     tags: [Installation]
 *     responses:
 *       200:
 *         description: Configuración pública
 */
installationRouter.get("/", getPublic);

/**
 * @swagger
 * /api/installation/all:
 *   get:
 *     summary: La configuración completa
 *     tags: [Installation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuración completa
 *       403:
 *         description: Solo para la administración
 */
installationRouter.get("/all", verifyToken, verifyAdmin, getAll);

/**
 * @swagger
 * /api/installation:
 *   patch:
 *     summary: Cambiar la configuración del consultorio
 *     description: >
 *       Los campos que no vengan quedan como estaban. Un valor fuera de rango rechaza el
 *       pedido entero, no se recorta en silencio.
 *     tags: [Installation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuración guardada
 *       400:
 *         description: Algún valor está fuera de rango
 *       403:
 *         description: Solo para la administración
 */
installationRouter.patch("/", verifyToken, verifyAdmin, patch);

/**
 * @swagger
 * /api/installation/preview-mail:
 *   post:
 *     summary: Un mail de muestra con la configuración que se está editando
 *     description: >
 *       No guarda ni manda nada. Arma el mail con las mismas funciones que los de verdad,
 *       con las palabras, el nombre y el color que lleguen en el pedido, y un turno de
 *       muestra adentro. `kind` es pedido, confirmado, recordatorio, cancelado o profesional.
 *     tags: [Installation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Asunto y HTML del mail
 *       400:
 *         description: El tipo de mail no existe o las palabras no sirven
 *       403:
 *         description: Solo para la administración
 */
installationRouter.post("/preview-mail", verifyToken, verifyAdmin, preview);

/* ============================================================
   Las fotos de la portada. Ver images.service.
   ============================================================ */

/**
 * @swagger
 * /api/installation/images/{id}/{size}:
 *   get:
 *     summary: Una foto de la portada
 *     description: Pública. `size` es large (hasta 1600 px) o small (hasta 640 px). Siempre WebP.
 *     tags: [Installation]
 *     responses:
 *       200:
 *         description: La foto
 *       404:
 *         description: Esa foto no existe
 */
installationRouter.get("/images/:id/:size", serve);

/** Lo que sigue es todo de la administración. */
installationRouter.get("/images", verifyToken, verifyAdmin, list);

/**
 * @swagger
 * /api/installation/images:
 *   post:
 *     summary: Subir una foto a la portada o a la galería
 *     description: >
 *       Multipart, con la foto en `file`, el lugar en `slot` (hero o gallery) y la
 *       descripción en `alt`. El servidor la vuelve a escribir en WebP: lo que se guarda
 *       nunca es el archivo que se subió.
 *     tags: [Installation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Foto subida
 *       400:
 *         description: No es una imagen, o es demasiado grande
 *       409:
 *         description: Ese lugar ya tiene todas las fotos que admite
 */
installationRouter.post("/images", verifyToken, verifyAdmin, imageUploadLimiter, receiveImage, create);
// El orden y la descripción no tienen ruta propia: van con el guardado de la configuración
// (ver savePhotos). Borrar acá es solo para una subida que no se guardó.
installationRouter.delete("/images/:id", verifyToken, verifyAdmin, remove);
