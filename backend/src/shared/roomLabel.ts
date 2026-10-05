import { orm } from "./db/orm.js";
import { Room } from "../rooms/rooms.entity.js";

/** La sucursal de un consultorio, para decir dónde es un turno. */
export interface BranchInfo {
  name: string;
  address: string | null;
  city: string;
}

/**
 * La sucursal donde queda un consultorio, con su dirección.
 *
 * Para los mails de una instalación con varias sucursales: con una sola no se pregunta,
 * porque la dirección es la del consultorio. Nunca falla: sin dato, null.
 */
export async function branchOf(room: unknown): Promise<BranchInfo | null> {
  const idRoom = (room as Room | null)?.idRoom;
  if (!idRoom) return null;

  try {
    const found = await orm.em.fork().findOne(Room, { idRoom }, { populate: ["office", "office.city"] });
    const office = found?.office;
    if (!office) return null;
    return { name: office.description, address: office.address ?? null, city: office.city?.nameCity ?? "" };
  } catch (error) {
    console.error("No se pudo leer la sucursal del turno:", error);
    return null;
  }
}

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
