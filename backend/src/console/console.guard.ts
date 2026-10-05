import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { orm } from "../shared/db/orm.js";
import { Person } from "../people/people.entity.js";
import { AUD_CONSOLE, verifyAccessToken } from "../config/tokens.js";

/**
 * La puerta de la consola de instalaciones.
 *
 * Crear un administrador es la operación más grave del sistema: quien la consigue se
 * queda con el consultorio entero. Así que esta puerta no se parece a las demás y no
 * comparte nada con ellas.
 *
 * Son cuatro controles, y el orden importa porque cada uno abarata el siguiente:
 *
 *  1. El origen. La consola vive en su propio dominio y es el único que CORS acepta para
 *     estas rutas. Acá, a diferencia del resto de la aplicación, una request sin `Origin`
 *     se rechaza.
 *  2. El token. Está firmado con una clave que no es la de la aplicación y lleva su propia
 *     audiencia, así que una sesión del consultorio —incluso la de un administrador— no
 *     abre nada de acá.
 *  3. La cuenta. Tiene que ser una de las de `OWNER_EMAILS`, y además existir, estar
 *     activa y ser de tipo admin en la base de esta instalación.
 *  4. La contraseña, de nuevo, en el momento de crear (ver console.service). Un token
 *     robado no alcanza.
 *
 * Sobre el punto 1, para que quede escrito donde se lee: **el origen no autoriza**. Lo
 * aplica el navegador, no el servidor, así que un `curl` lo ignora y puede mandar el
 * `Origin` que quiera. Está para que una página cualquiera abierta en el navegador de uno
 * de los dueños no pueda usar su sesión, que es un ataque real, y no para frenar a alguien
 * con una terminal. Lo que frena a ese alguien son los puntos 2, 3 y 4.
 */

interface RequestWithOwner extends Request {
  owner?: { email: string };
}

/** Los dominios desde los que se acepta la consola. Normalmente uno. */
export function consoleOrigins(): string[] {
  return (process.env.CONSOLE_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

/** Las cuentas que pueden usar la consola. Son las mías, no las del cliente. */
export function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isOwner(email: string | undefined): boolean {
  if (!email) return false;
  const owners = ownerEmails();
  // Sin lista cargada nadie es dueño. Es a propósito: una lista vacía por un deploy sin la
  // variable no puede significar "pasen todos".
  return owners.length > 0 && owners.includes(email.trim().toLowerCase());
}

/**
 * Queda escrito quién golpeó la consola y con qué resultado.
 *
 * Va al log de la plataforma y no a una tabla: la tabla vive en la base de la instalación,
 * que es justo lo que esta puerta puede cambiar. Un registro que el atacante puede editar
 * no es un registro.
 */
export function auditConsole(req: Request, outcome: string, email?: string): void {
  const quien = email ?? (req as RequestWithOwner).owner?.email ?? "sin identificar";
  const origen = req.headers.origin ?? "sin origen";
  console.log(`[consola] ${req.method} ${req.originalUrl} · ${quien} · ${origen} · ${outcome}`);
}

/** Primer control: el origen, y acá sí es obligatorio. */
export function requireConsoleOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = (req.headers.origin ?? "").replace(/\/+$/, "");
  const permitidos = consoleOrigins();

  if (!origin || !permitidos.includes(origin)) {
    auditConsole(req, `origen rechazado (${origin || "ausente"})`);
    return res.status(403).json({ message: "No autorizado" });
  }

  return next();
}

/** Controles 2 y 3: el token de la consola y que la cuenta sea una de las mías. */
export async function onlyOwner(req: RequestWithOwner, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    auditConsole(req, "sin token");
    return res.status(401).json({ message: "No autorizado" });
  }

  let claims;
  try {
    claims = verifyAccessToken(token, AUD_CONSOLE);
  } catch (error) {
    // El motivo no se le cuenta a quien golpea la puerta, pero sí queda en el log: un token
    // de otra instalación y uno vencido son dos cosas distintas y la segunda es normal.
    const motivo = error instanceof jwt.TokenExpiredError ? "token vencido" : "token rechazado";
    auditConsole(req, motivo);
    return res.status(401).json({ message: "No autorizado" });
  }

  if (!isOwner(claims.email)) {
    auditConsole(req, "cuenta fuera de la lista", claims.email);
    return res.status(403).json({ message: "No autorizado" });
  }

  // El token dice quién es; la base dice si todavía lo es. Una cuenta deshabilitada o que
  // dejó de ser admin no entra, aunque el token siga siendo válido.
  const person = await orm.em.findOne(Person, { email: claims.email });
  if (!person || person.active !== true || person.type !== "admin") {
    auditConsole(req, "cuenta no habilitada en esta instalación", claims.email);
    return res.status(403).json({ message: "No autorizado" });
  }

  req.owner = { email: person.email };
  return next();
}
