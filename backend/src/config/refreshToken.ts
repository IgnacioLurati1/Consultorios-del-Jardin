import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { isPersonActive } from "./middlewares.js";
import { clientChannel, REFRESH_TOKEN_HEADER } from "./clients.js";
import { PeopleService } from "../people/people.service.js";

dotenv.config();

const peopleService = new PeopleService();

interface AuthRequest extends Request {
  cookies: {
    refreshToken?: string;
  };
}

/**
 * De dónde sale el refresh token, en el orden en que se busca.
 *
 * Las dos formas valen. La app lo manda siempre en el header, sacado del llavero del
 * sistema. La web tiene las dos disponibles y usa la que su navegador le permita: si la
 * cookie httpOnly sobrevive, deja de mandar el header y viaja sola. Ver
 * deliverRefreshToken en el controlador de personas.
 *
 * El header va primero justamente porque la cookie puede quedar vieja: una de una sesión
 * anterior no puede tapar el token que el cliente está mandando recién ahora.
 */
function readRefreshToken(req: AuthRequest): string | undefined {
  const fromHeader = req.headers?.[REFRESH_TOKEN_HEADER];
  if (typeof fromHeader === "string" && fromHeader.length > 0) return fromHeader;

  return req.cookies?.refreshToken;
}

export default function refreshToken(req: AuthRequest, res: Response) {
  const refreshToken = readRefreshToken(req);

  if (!refreshToken) {
    return res.status(401).json({ message: "Token inexistente" });
  }

  jwt.verify(refreshToken, process.env.REFRESH_SECRET as jwt.Secret, async (err, decoded: any) => {
    if (err) return res.status(403).json({ message: "Refresh token inválido" });

    // Un usuario deshabilitado no puede renovar su sesión (el refresh token dura 30 días)
    try {
      if (!(await isPersonActive(decoded.email)))
        return res.status(403).json({ message: "Usuario deshabilitado", code: "USER_DISABLED" });
    } catch (error) {
      console.error("Error verificando el estado del usuario:", error);
      return res.status(500).json({ message: "No se pudo verificar el estado del usuario" });
    }

    // Una sesión dura treinta días: si solo se contaran los logins, el panel diría que
    // casi nadie usa la app. Renovar el token es lo más cerca que estamos de "la abrió".
    const channel = clientChannel(req);
    if (channel) void peopleService.recordAccess(decoded.email, channel);

    const token = jwt.sign({ email: decoded.email, type: decoded.type }, process.env.JWT_SECRET as jwt.Secret, { expiresIn: "15m" });

    return res.json({ token: token });
  });
}
