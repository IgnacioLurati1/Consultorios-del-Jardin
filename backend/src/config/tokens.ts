import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

/**
 * Firmado y verificación de los tokens de sesión, en un solo lugar.
 *
 * El mismo código corre en varias instalaciones, cada una con su base y su dominio. Los
 * tokens llevaban nada más que el mail y el tipo de cuenta, y se verificaban sin mirar
 * quién los había emitido ni para qué: dos instalaciones con la misma clave de firma
 * significaba que una sesión de una entraba en la otra con el mismo rol, y que un link de
 * cambiar contraseña emitido en una servía en la otra.
 *
 * Ahora cada token dice de qué instalación salió (`iss`) y para qué puerta sirve (`aud`).
 * La clave por instalación ya alcanzaría; esto se agrega igual, porque una clave mal
 * copiada entre dos deploys es un error de una tarde y esto lo deja sin efecto.
 */

/** La puerta normal: la página del consultorio y la aplicación del celular. */
export const AUD_APP = "app";

/** La consola de instalaciones. Tiene su propia clave, así que no se cruza con la de arriba. */
export const AUD_CONSOLE = "console";

export type Audience = typeof AUD_APP | typeof AUD_CONSOLE;

export interface SessionClaims {
  email: string;
  type: string;
  iss?: string;
  aud?: string | string[];
}

/**
 * Quién emite los tokens de esta instalación. Es el nombre corto del cliente, no el
 * dominio: el dominio puede cambiar sin que cambie la instalación.
 */
export function tokenIssuer(): string {
  return (process.env.TOKEN_ISSUER ?? "").trim();
}

/**
 * Si se exige que el token traiga `iss` y `aud`.
 *
 * Arranca apagado a propósito. El día que esto se despliega hay sesiones vivas firmadas
 * sin esos campos, y el refresh dura treinta días: exigirlos de entrada saca a todo el
 * mundo. Apagado, un token viejo entra y uno con los campos equivocados no, que es lo que
 * importa. Pasado un mes se prende y deja de haber tokens viejos en la calle.
 *
 * La consola no participa de esto: sus tokens son nuevos, así que los exige siempre.
 */
function claimsRequired(): boolean {
  return process.env.TOKEN_STRICT === "1";
}

function secretOf(name: string): jwt.Secret {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name}`);
  return value as jwt.Secret;
}

function accessSecret(audience: Audience): jwt.Secret {
  return audience === AUD_CONSOLE ? secretOf("CONSOLE_JWT_SECRET") : secretOf("JWT_SECRET");
}

function signOptions(audience: Audience, expiresIn: string): jwt.SignOptions {
  const issuer = tokenIssuer();
  return {
    expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
    audience,
    // Vacío no se manda: un `iss` en blanco es peor que no tenerlo, porque parece puesto.
    ...(issuer ? { issuer } : {}),
  };
}

export function signAccessToken(email: string, type: string, audience: Audience = AUD_APP, expiresIn = "15m"): string {
  return jwt.sign({ email, type }, accessSecret(audience), signOptions(audience, expiresIn));
}

export function signRefreshToken(email: string, type: string, expiresIn = "30d"): string {
  return jwt.sign({ email, type }, secretOf("REFRESH_SECRET"), signOptions(AUD_APP, expiresIn));
}

/**
 * Los dos campos se comprueban a mano y no con las opciones de la librería.
 *
 * `jwt.verify` con `issuer` y `audience` rechaza el token que no los trae, y durante la
 * transición hay que dejarlo pasar. Lo que no se deja pasar nunca es un token que los
 * trae equivocados: ese es exactamente el cruce entre instalaciones que esto evita.
 */
function assertClaims(claims: SessionClaims, audience: Audience, required: boolean): void {
  const audiences = claims.aud === undefined ? [] : Array.isArray(claims.aud) ? claims.aud : [claims.aud];

  if (audiences.length === 0) {
    if (required) throw new jwt.JsonWebTokenError("El token no dice para qué puerta sirve");
  } else if (!audiences.includes(audience)) {
    throw new jwt.JsonWebTokenError("El token es de otra puerta");
  }

  const expected = tokenIssuer();
  if (claims.iss === undefined) {
    if (required) throw new jwt.JsonWebTokenError("El token no dice de dónde salió");
  } else if (expected && claims.iss !== expected) {
    throw new jwt.JsonWebTokenError("El token es de otra instalación");
  }
}

export function verifyAccessToken(token: string, audience: Audience = AUD_APP): SessionClaims {
  const claims = jwt.verify(token, accessSecret(audience), { algorithms: ["HS256"] }) as SessionClaims;
  // La consola no tiene tokens viejos dando vueltas, así que no entra en el período de gracia.
  assertClaims(claims, audience, audience === AUD_CONSOLE || claimsRequired());
  return claims;
}

export function verifyRefreshToken(token: string): SessionClaims {
  const claims = jwt.verify(token, secretOf("REFRESH_SECRET"), { algorithms: ["HS256"] }) as SessionClaims;
  assertClaims(claims, AUD_APP, claimsRequired());
  return claims;
}
