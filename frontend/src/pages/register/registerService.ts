import api from "../../axios";

/**
 * ¿Se puede usar este email para registrarse? Lo pregunta el primer paso del registro,
 * para avisar ahí mismo en lugar de dejar que la persona complete todo el formulario y
 * choque contra el error recién al enviarlo.
 *
 * Si la consulta falla (sin red, o el límite de consultas), se responde que sí: el alta
 * vuelve a validarlo del lado del servidor, así que no se pierde nada, y no se traba a
 * alguien que sí podía registrarse.
 */
export function isEmailAvailable(email: string): Promise<boolean> {
  return api
    .get(`/people/available/${encodeURIComponent(email)}`)
    .then((response) => response.data.available !== false)
    .catch(() => true);
}
