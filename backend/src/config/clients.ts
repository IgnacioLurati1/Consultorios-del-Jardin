import { Request } from "express";

/**
 * Por cuál de los dos clientes entró la request.
 *
 * Los dos reciben el refresh token en el cuerpo de la respuesta y lo mandan de vuelta en
 * un header; lo que cambia es dónde lo guardan mientras tanto: la app en el llavero del
 * sistema (expo-secure-store) y la web en su almacenamiento local. Ver
 * deliverRefreshToken en el controlador de personas.
 *
 * Acá el header sirve para una sola cosa: contar quién entra por dónde. Nadie gana nada
 * falsificándolo, porque no saltea ninguna validación —ensucia una estadística—.
 */
export const MOBILE_CLIENT_HEADER = "x-client";
export const REFRESH_TOKEN_HEADER = "x-refresh-token";

/**
 * `null` es todo lo demás —Swagger, un curl, un test— y no se cuenta como acceso de
 * nadie: para las estadísticas es mejor no tener el dato que inventarlo.
 */
export type ClientChannel = "app" | "web";

export function clientChannel(req: Request): ClientChannel | null {
  const client = req.headers?.[MOBILE_CLIENT_HEADER];
  if (typeof client !== "string") return null;

  const value = client.toLowerCase();
  if (value === "mobile") return "app";
  if (value === "web") return "web";
  return null;
}
