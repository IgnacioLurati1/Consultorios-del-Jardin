import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { isPersonActive } from "./middlewares.js";
import { REFRESH_TOKEN_HEADER } from "./clients.js";

dotenv.config();

interface AuthRequest extends Request {
  cookies: {
    refreshToken?: string;
  };
}

/**
 * En el navegador el refresh token viaja en la cookie httpOnly, para que el JS de la
 * página no pueda leerlo (defensa ante XSS): por eso el front llama a este endpoint con
 * withCredentials. La app nativa no tiene cookies, así que lo manda en un header; lo
 * guarda en el llavero del sistema, que es su equivalente del httpOnly.
 *
 * El endpoint no cambia según quién llame: acepta las dos formas y valida igual. La
 * cookie tiene prioridad, así el navegador nunca depende de un header que podría llegar
 * pisado.
 */
function readRefreshToken(req: AuthRequest): string | undefined {
  if (req.cookies?.refreshToken) return req.cookies.refreshToken;

  const fromHeader = req.headers[REFRESH_TOKEN_HEADER];
  return typeof fromHeader === "string" && fromHeader.length > 0 ? fromHeader : undefined;
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

    const token = jwt.sign({ email: decoded.email, type: decoded.type }, process.env.JWT_SECRET as jwt.Secret, { expiresIn: "15m" });

    return res.json({ token: token });
  });
}
