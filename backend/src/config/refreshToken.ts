import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { isPersonActive } from "./middlewares.js";

dotenv.config();

interface AuthRequest extends Request {
  cookies: {
    refreshToken?: string;
  };
}

// El refresh token viaja únicamente en la cookie httpOnly, para que el JS de la página
// no pueda leerlo (defensa ante XSS). Por eso el front tiene que llamar a este endpoint
// con withCredentials.
export default function refreshToken(req: AuthRequest, res: Response) {
  const refreshToken = req.cookies?.refreshToken;

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
