import { Request, Response } from "express";
import { sendError } from "../shared/errors.js";
import { config, publicConfig, rulesView, updateConfig } from "./installation.service.js";
import { previewMail } from "./mailPreview.js";
import { listImages } from "./images.service.js";

/**
 * La configuración de la instalación, por HTTP.
 *
 * El GET público es el que lee la web antes de que nadie inicie sesión: la portada, la
 * pantalla de contacto y las preguntas frecuentes necesitan el nombre y la dirección. El
 * GET completo y el PATCH son del administrador.
 */

async function getPublic(_req: Request, res: Response) {
  try {
    res.status(200).json({ data: await publicConfig() });
  } catch (error: any) {
    sendError(res, error, { fallback: "No se pudo leer la configuración del consultorio" });
  }
}

/** Las fotos de la portada y de la galería, como están publicadas. */
async function adminPhotos() {
  const images = await listImages();
  return {
    hero: images.filter((image) => image.slot === "hero"),
    gallery: images.filter((image) => image.slot === "gallery"),
  };
}

async function getAll(_req: Request, res: Response) {
  try {
    // Con las reglas que el consultorio puede ver, para dibujarlas en la configuración, y
    // las fotos publicadas, que se editan en el mismo borrador.
    res.status(200).json({ data: { ...(await config()), rules: await rulesView("client"), photos: await adminPhotos() } });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function patch(req: Request, res: Response) {
  try {
    const data = await updateConfig(req.body ?? {}, "client");
    res.status(200).json({ message: "Configuración guardada", data: { ...data, rules: await rulesView("client"), photos: await adminPhotos() } });
  } catch (error: any) {
    sendError(res, error);
  }
}

/** Un mail de muestra con lo que se está editando. Ver mailPreview. */
async function preview(req: Request, res: Response) {
  try {
    const { kind, ...draft } = req.body ?? {};
    res.status(200).json({ data: await previewMail(kind, draft) });
  } catch (error: any) {
    sendError(res, error);
  }
}

export { getPublic, getAll, patch, preview };
