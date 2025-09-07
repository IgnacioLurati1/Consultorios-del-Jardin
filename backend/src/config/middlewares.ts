import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";

dotenv.config();

interface RequestWithUser extends Request {
  user?: any;
}

export async function verifyToken(req: RequestWithUser, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1]; //Del header, nos quedamos con el authorization: Bearer, el ? pregunta si existe, de lo contrario undefined y el split separa el bearer del token y nos quedamos con este ultimo
  if (!token) return res.status(401).json({ message: "No autorizado" });

  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET as jwt.Secret);
    req.user = decodedToken;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.error("Error verifying token:", error);
      res.status(401).json({ message: "Token expirado" }); // si el token expira, devuelve error
    } else {
      console.error("Error verifying token:", error);
      res.status(401).json({ message: "Token inválido" });
    }
  }
}

export async function verifyAdmin(req: RequestWithUser, res: Response, next: NextFunction) {
  if (req.user.type == "admin") return next();

  return res.status(403).json({ message: "Acceso denegado" });
}
