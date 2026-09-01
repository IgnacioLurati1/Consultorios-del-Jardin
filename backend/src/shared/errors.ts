import { Response } from "express";

/**
 * Error "esperable": lo provoca el usuario mandando datos que no cierran, no un bug.
 * Lleva el status HTTP que corresponde y un mensaje escrito para mostrarse tal cual en
 * pantalla, así el front no tiene que adivinar qué pasó ni traducir nada.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message: string, code?: string) => new AppError(message, 400, code);
export const forbidden = (message: string, code?: string) => new AppError(message, 403, code);
export const notFound = (message: string, code?: string) => new AppError(message, 404, code);
export const conflict = (message: string, code?: string) => new AppError(message, 409, code);

function isDuplicateEntry(error: any): boolean {
  return error?.code === "ER_DUP_ENTRY" || (typeof error?.message === "string" && error.message.includes("Duplicate entry"));
}

function isStillReferenced(error: any): boolean {
  return error?.code === "ER_ROW_IS_REFERENCED" || error?.code === "ER_ROW_IS_REFERENCED_2";
}

// MikroORM tira NotFoundError desde findOneOrFail, con un mensaje en inglés que además
// incluye el criterio de búsqueda. No sirve para mostrar, así que se reemplaza.
function isNotFound(error: any): boolean {
  return error?.name === "NotFoundError";
}

interface ErrorMessages {
  /** Mensaje para un choque de clave única (409). */
  duplicate?: string;
  /** Mensaje para algo que no existe o no le pertenece al usuario (404). */
  missing?: string;
  /** Mensaje para un error inesperado (500). El detalle real va al log, no al cliente. */
  fallback?: string;
}

/**
 * Traduce cualquier error a una respuesta HTTP. La idea es que el front pueda mostrar
 * `message` directamente: nada de "Información de turno inválida" para seis causas
 * distintas, ni textos de la librería filtrándose a la pantalla.
 */
export function sendError(res: Response, error: any, messages: ErrorMessages = {}) {
  if (error instanceof AppError) {
    return res.status(error.status).json({ message: error.message, ...(error.code ? { code: error.code } : {}) });
  }

  if (isDuplicateEntry(error)) {
    return res.status(409).json({ message: messages.duplicate ?? "Ya existe un registro con esos datos" });
  }

  if (isStillReferenced(error)) {
    return res.status(409).json({ message: "No se puede eliminar porque hay otros registros que lo usan" });
  }

  if (isNotFound(error)) {
    return res.status(404).json({ message: messages.missing ?? "No encontramos lo que buscabas" });
  }

  // Acá sí es un problema nuestro: se registra completo y se responde algo genérico.
  console.error("Error inesperado:", error);
  return res.status(500).json({ message: messages.fallback ?? "Ups! Algo salió mal. Intentá de nuevo en un rato" });
}
