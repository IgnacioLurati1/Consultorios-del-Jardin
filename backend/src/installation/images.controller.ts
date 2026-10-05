import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { sendError } from "../shared/errors.js";
import {
  IMAGE_SLOTS,
  MAX_UPLOAD_BYTES,
  addImage,
  imageBytes,
  listImages,
  removeImage,
  type ImageSlot,
} from "./images.service.js";

/**
 * Las fotos de la portada, por HTTP.
 *
 * Servirlas es público: son las fotos de la portada, que ve cualquiera. Subirlas,
 * ordenarlas, describirlas y sacarlas es de la administración.
 */

/** En memoria y no en disco: se vuelven a escribir enseguida y se guardan en la base. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 4 },
});

/** Traduce los errores de multer, que no pasan por el controlador y vienen en inglés. */
export function receiveImage(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (error: any) => {
    if (!error) return next();
    if (error.code === "LIMIT_FILE_SIZE")
      return res.status(400).json({ message: `La foto supera los ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB` });
    return res.status(400).json({ message: "No se pudo leer el archivo" });
  });
}

export async function list(req: Request, res: Response) {
  try {
    const slot = (IMAGE_SLOTS as readonly string[]).includes(String(req.query.slot)) ? (req.query.slot as ImageSlot) : undefined;
    res.status(200).json({ data: await listImages(slot) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function create(req: Request, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ message: "Falta la foto" });
    const image = await addImage(req.file.buffer, req.body?.slot, req.body?.alt);
    res.status(201).json({ message: "Foto subida", data: image });
  } catch (error) {
    sendError(res, error);
  }
}

/**
 * La foto en sí.
 *
 * Se cachea un año y para siempre: una foto nueva tiene otro id, así que una dirección
 * nunca cambia de contenido. `nosniff` porque el navegador no tiene que adivinar qué es:
 * es WebP, lo escribió el servidor.
 */
export async function serve(req: Request, res: Response) {
  try {
    const size = req.params.size === "small" ? "small" : "large";
    const bytes = await imageBytes(req.params.id, size);
    res.set({
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // Que se pueda mostrar desde la web del consultorio, que vive en otro dominio.
      "Cross-Origin-Resource-Policy": "cross-origin",
    });
    res.status(200).send(bytes);
  } catch (error) {
    sendError(res, error, { missing: "Esa foto no existe" });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    await removeImage(req.params.id);
    res.status(200).json({ message: "Foto borrada" });
  } catch (error) {
    sendError(res, error, { missing: "Esa foto no existe" });
  }
}
