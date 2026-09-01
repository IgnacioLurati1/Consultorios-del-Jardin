import { Request, Response } from "express";
import { badRequest, sendError } from "../shared/errors.js";
import { AssistantService, type ChatTurn } from "./assistant.service.js";

interface RequestWithUser extends Request {
  user?: any;
}

const assistantService = new AssistantService();

const MAX_MESSAGE = 600;
/** Cuántos mensajes del historial se aceptan. Más que esto es prompt gratis. */
const MAX_HISTORY = 20;

const ROLES = ["client", "professional", "admin"];

/**
 * El historial lo manda el navegador, así que se lo trata como entrada de afuera: se
 * recorta, se le sacan los roles inventados y se limita el largo. Sin esto, cualquiera
 * podría mandar un "historial" armado a mano con instrucciones para el modelo.
 */
function cleanHistory(raw: any): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((turn) => turn && (turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string")
    .slice(-MAX_HISTORY)
    .map((turn) => ({ role: turn.role, content: turn.content.slice(0, MAX_MESSAGE * 4) }));
}

async function sendAssistantMessage(req: RequestWithUser, res: Response) {
  try {
    if (!ROLES.includes(req.user.type)) throw badRequest("Tu cuenta no puede usar el asistente");

    const message = String(req.body?.message ?? "").trim();
    if (!message) throw badRequest("Escribí una consulta");
    if (message.length > MAX_MESSAGE) throw badRequest("El mensaje es muy largo. Probá resumirlo");

    const reply = await assistantService.reply(
      { email: req.user.email, type: req.user.type },
      message,
      cleanHistory(req.body?.history),
      typeof req.body?.pendingAction === "string" ? req.body.pendingAction : undefined
    );

    return res.status(200).json({ message: "Respuesta generada", data: reply });
  } catch (error: any) {
    // Si el que falla es el proveedor del modelo, no es culpa de quien preguntó.
    if (error?.status === 429 || error?.status === 503)
      return res.status(503).json({ message: "El asistente está saturado. Probá de nuevo en un minuto." });

    return sendError(res, error, { fallback: "No pude procesar tu consulta. Probá de nuevo en un rato" });
  }
}

export { sendAssistantMessage };
