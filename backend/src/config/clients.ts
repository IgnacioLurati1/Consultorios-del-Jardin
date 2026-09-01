import { Request } from "express";

/**
 * De dónde viene la request. El mismo backend atiende a los dos clientes; lo único que
 * cambia entre ellos es dónde puede guardarse el refresh token.
 *
 * En el navegador el refresh token vive en una cookie httpOnly: el JS de la página no
 * puede leerlo, así que un XSS no se lo lleva. En la app nativa esa defensa no existe
 * (no hay cookie jar ni documento que pueda ser inyectado), y en cambio hay algo que el
 * browser no tiene: el llavero del sistema. Ahí el token se devuelve en el cuerpo de la
 * respuesta y la app lo guarda en expo-secure-store.
 *
 * La app se identifica con el header. Nadie gana nada falsificándolo: pedir el token en
 * el cuerpo en vez de en una cookie no saltea ninguna validación, solo elige el envase.
 */
export const MOBILE_CLIENT_HEADER = "x-client";
export const REFRESH_TOKEN_HEADER = "x-refresh-token";

export function isMobileClient(req: Request): boolean {
  const client = req.headers[MOBILE_CLIENT_HEADER];
  return typeof client === "string" && client.toLowerCase() === "mobile";
}
