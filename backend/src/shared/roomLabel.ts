import { orm } from "./db/orm.js";
import { Room } from "../rooms/rooms.entity.js";

/**
 * El consultorio de un turno, por su nombre, para los mails.
 *
 * El turno casi nunca llega con el consultorio cargado: los que mandan mails lo leen con
 * el paciente y el profesional y nada más. Se busca aparte y en un fork, así el pedido que
 * manda el mail no se entera. Cargado sobre la misma entidad, la respuesta de ese pedido
 * empezaría a traer el consultorio entero donde antes traía el número, y la pantalla que
 * la lee no lo espera.
 *
 * No falla nunca. Un mail sin el renglón del consultorio es mejor que un mail que no sale.
 */
export async function roomLabel(room: unknown): Promise<string> {
  if (!room) return "";

  // Una referencia sin cargar trae solo el id: si ya tiene el nombre, no hace falta ir a buscarlo.
  const known = (room as Room).description;
  if (known) return known;

  const idRoom = (room as Room).idRoom;
  if (!idRoom) return "";

  try {
    const found = await orm.em.fork().findOne(Room, { idRoom });
    return found?.description ?? "";
  } catch (error) {
    console.error("No se pudo leer el consultorio del turno:", error);
    return "";
  }
}
