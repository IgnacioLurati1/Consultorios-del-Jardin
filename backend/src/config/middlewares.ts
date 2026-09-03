import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import { orm } from "../shared/db/orm.js";
import { Person } from "../people/people.entity.js";
import { SecurityService } from "../security/security.service.js";
import { classify } from "../security/sensitiveEndpoints.js";

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

/**
 * Por qué está cerrada una cuenta, en la forma en que se lo cuenta al que la usa.
 *
 * Una cuenta que el sistema cerró por parecer intervenida no es lo mismo que una que
 * deshabilitó la administración, y decirle a alguien "usuario deshabilitado" cuando lo
 * que pasó es que le robaron la contraseña le esconde justo lo que tiene que saber.
 */
export const COMPROMISED_MESSAGE =
  "Detectamos actividad que no reconocemos en esta cuenta y la cerramos por seguridad: es posible que alguien más " +
  "haya conseguido tu contraseña. Para revisar el caso y volver a habilitarla tenés que hablar con un administrador " +
  "del consultorio.";

export function describeLockout(person: Person): { message: string; code: string } {
  if (person.banKind === "compromise") return { message: COMPROMISED_MESSAGE, code: "ACCOUNT_COMPROMISED" };

  return { message: "Usuario deshabilitado", code: "USER_DISABLED" };
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
    const person = await orm.em.findOne(Person, { email: decodedToken.email });

    if (!person || person.active !== true) {
      // Sin persona no hay nada que explicar: el token nombra a alguien que ya no está.
      const lockout = person ? describeLockout(person) : { message: "Usuario deshabilitado", code: "USER_DISABLED" };
      return res.status(403).json(lockout);
    }
  } catch (error) {
    console.error("Error verificando el estado del usuario:", error);
    return res.status(500).json({ message: "No se pudo verificar el estado del usuario" });
  }

  if (await guardSensitiveAccess(req, res)) return;

  next();
}

const securityService = new SecurityService();

/**
 * Vigila los endpoints administrativos delicados y corta si la cuenta se pasó.
 *
 * Va acá adentro y no como middleware aparte porque `verifyToken` es el único lugar por
 * el que pasa toda request autenticada de la aplicación, cualquiera sea el router. Una
 * ruta administrativa nueva queda vigilada por existir, sin que nadie tenga que
 * acordarse de enchufarle nada.
 *
 * Importante: mira `req.originalUrl` y no `req.path`. Adentro de un router montado,
 * Express le saca el prefijo a `req.url`, así que `req.path` de una request a
 * `/api/people/x/toggleState` puede llegar como `/x/toggleState` y no coincidir con
 * ninguna regla.
 *
 * Devuelve si ya contestó. Si algo del control falla, deja pasar: una request legítima
 * no se cae porque el registro de seguridad tuvo un problema.
 */
async function guardSensitiveAccess(req: RequestWithUser, res: Response): Promise<boolean> {
  // Con `?? req.url` y no a secas: el comentario de arriba promete que este control no
  // voltea una request legítima, y leer `originalUrl` de algo que no lo tenga la volteaba
  // antes de llegar al try. Express siempre lo pone; los tests que arman un req a mano,
  // no, y ahí saltó.
  const path = (req.originalUrl ?? req.url ?? "").split("?")[0];
  const action = classify(req.method, path, req.user?.email);
  if (!action) return false;

  try {
    const { hit, verdict } = await securityService.reviewSensitiveAccess(
      req.user.email,
      req.user.type,
      { method: req.method, path },
      action
    );

    // Con qué terminó la request se anota después, cuando termina. No se espera: es
    // información para revisar el caso mañana, no para decidir ahora.
    res.on("finish", () => void securityService.recordOutcome(hit.id, res.statusCode));

    if (verdict?.locked) {
      // El mismo texto que va a ver en el login. La request que hizo saltar la regla y
      // todas las que vengan después tienen que contar lo mismo.
      res.status(403).json({ message: COMPROMISED_MESSAGE, code: "ACCOUNT_COMPROMISED" });
      return true;
    }
  } catch (error) {
    console.error("Error revisando el acceso a un endpoint sensible:", error);
  }

  return false;
}

export async function verifyAdmin(req: RequestWithUser, res: Response, next: NextFunction) {
  if (req.user.type == "admin") return next();

  return res.status(403).json({ message: "Acceso denegado" });
}
