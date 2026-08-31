import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import { orm } from "../shared/db/orm.js";
import { Person } from "../people/people.entity.js";

dotenv.config();

interface RequestWithUser extends Request {
  user?: any;
}

// Un usuario con active = false está deshabilitado (baneado por el admin, o profesional
// cuya solicitud todavía no fue aprobada) y no puede operar en la app, aunque tenga un
// token válido en la mano. Se chequea contra la base en cada request porque el ban puede
// ocurrir después de emitido el token.
// Se carga la entidad completa (no partial loading) para no dejarla a medias en el
// identity map: el resto del request suele volver a pedir esta misma persona.
export async function isPersonActive(email: string): Promise<boolean> {
  const person = await orm.em.findOne(Person, { email });
  return !!person && person.active === true;
}

export async function verifyToken(req: RequestWithUser, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1]; //Del header, nos quedamos con el authorization: Bearer, el ? pregunta si existe, de lo contrario undefined y el split separa el bearer del token y nos quedamos con este ultimo
  if (!token) return res.status(401).json({ message: "No autorizado" });

  let decodedToken: any;

  try {
    decodedToken = jwt.verify(token, process.env.JWT_SECRET as jwt.Secret);
    req.user = decodedToken;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.error("Error verifying token:", error);
      return res.status(401).json({ message: "Token expirado" }); // si el token expira, devuelve error
    }
    console.error("Error verifying token:", error);
    return res.status(401).json({ message: "Token inválido" });
  }

  try {
    if (!(await isPersonActive(decodedToken.email)))
      return res.status(403).json({ message: "Usuario deshabilitado", code: "USER_DISABLED" });
  } catch (error) {
    console.error("Error verificando el estado del usuario:", error);
    return res.status(500).json({ message: "No se pudo verificar el estado del usuario" });
  }

  next();
}

export async function verifyAdmin(req: RequestWithUser, res: Response, next: NextFunction) {
  if (req.user.type == "admin") return next();

  return res.status(403).json({ message: "Acceso denegado" });
}
