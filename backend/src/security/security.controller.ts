import { Request, Response } from "express";
import { SecurityService } from "./security.service.js";
import { sendError } from "../shared/errors.js";

interface RequestWithUser extends Request {
  user?: any;
}

const securityService = new SecurityService();

/** El informe de comportamiento es para decidir sobre cuentas ajenas: solo el admin. */
export async function getBehaviourReport(req: RequestWithUser, res: Response) {
  try {
    if (req.user?.type !== "admin") return res.status(403).json({ message: "Esta información es solo para administradores" });

    res.status(200).json({ data: await securityService.behaviourReport() });
  } catch (error: any) {
    sendError(res, error);
  }
}

/**
 * Las cuentas que el sistema cerró por parecer intervenidas, con su rastro.
 *
 * Solo el admin, obviamente: la lista dice qué endpoints tocó cada cuenta caída, que es
 * exactamente el mapa que le serviría a quien esté intentando entrar.
 */
export async function getCompromisedAccounts(req: RequestWithUser, res: Response) {
  try {
    if (req.user?.type !== "admin") return res.status(403).json({ message: "Esta información es solo para administradores" });

    res.status(200).json({
      data: {
        accounts: await securityService.compromisedAccounts(),
        rules: securityService.intrusionRules(),
      },
    });
  } catch (error: any) {
    sendError(res, error);
  }
}
