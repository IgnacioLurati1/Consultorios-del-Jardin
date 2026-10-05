import { directionsOf, fullAddress, mapEmbedOf, type Branch, type Installation } from "../../../lib/installation.ts";
import type { Office } from "../../types.ts";

/**
 * Las sucursales, del lado de la pantalla.
 *
 * Todo lo de acá vale solo cuando la instalación trabaja con varias (ver hasBranches en
 * lib/installation). Con una sola, ninguna pantalla lo llama y todo se ve como siempre.
 *
 * Una sucursal llega de tres formas distintas según de dónde venga: la lista pública de la
 * configuración (`Branch`, con la ciudad como texto), una sucursal con sesión (`Office`,
 * con la ciudad como objeto) y, en los turnos y los horarios, a veces solo el número. Estos
 * ayudantes las reciben como vengan.
 */

/** El número de una sucursal: objeto con `idOffice`, fila cruda con `id_office` o el número suelto. */
export function officeIdOf(office: unknown): string | null {
  if (typeof office === "number" || typeof office === "string") return String(office);
  if (!office || typeof office !== "object") return null;

  const raw = office as Record<string, unknown>;
  const id = raw.idOffice ?? raw.id_office ?? raw.id;
  return typeof id === "number" || typeof id === "string" ? String(id) : null;
}

/** Una sucursal con sesión, con la forma de la lista pública. */
export function branchFromOffice(office: Office): Branch {
  const city = office.city as unknown;
  return {
    id: Number(office.idOffice),
    name: office.description,
    address: office.address || null,
    city: city && typeof city === "object" ? ((city as { nameCity?: string }).nameCity ?? "") : "",
    opens: String(office.openingTime ?? "").slice(0, 5),
    closes: String(office.closingTime ?? "").slice(0, 5),
  };
}

/**
 * La sucursal que corresponde a lo que vino en un turno, un consultorio o un horario.
 *
 * Primero se busca en la lista de la configuración, que trae la ciudad escrita: en los
 * turnos la sucursal viene con el nombre pero la ciudad llega como un número. Si no está
 * ahí (una sucursal dada de baja, por ejemplo), alcanza con lo que traiga el dato mismo.
 */
export function findBranch(office: unknown, installation: Installation): Branch | null {
  const id = officeIdOf(office);
  const listed = id ? installation.branches.find((branch) => String(branch.id) === id) : undefined;
  if (listed) return listed;

  if (office && typeof office === "object" && typeof (office as Office).description === "string") {
    return branchFromOffice(office as Office);
  }

  return null;
}

/** Si las sucursales quedan en más de una ciudad. Ahí el nombre solo no alcanza para ubicarlas. */
export function manyCities(branches: ReadonlyArray<{ city: string }>): boolean {
  return new Set(branches.map((branch) => branch.city.trim().toLowerCase()).filter(Boolean)).size > 1;
}

/** "Centro", o "Centro (Funes)" cuando hay sucursales en más de una ciudad. */
export function branchName(branch: Pick<Branch, "name" | "city">, withCity: boolean): string {
  return withCity && branch.city ? `${branch.name} (${branch.city})` : branch.name;
}

/**
 * Dónde queda: la calle y la ciudad.
 *
 * Sin calle cargada, la sucursal usa la dirección general del consultorio, que es lo mismo
 * que hace el servidor en los recordatorios. Sin ninguna de las dos, la ciudad.
 */
export function branchPlace(branch: Branch, installation: Installation): string {
  if (branch.address) return [branch.address, branch.city].filter(Boolean).join(", ");
  return fullAddress(installation) || branch.city;
}

/** "08:00 a 20:00". Vacío si falta alguna de las dos horas. */
export function branchHours(branch: Pick<Branch, "opens" | "closes">): string {
  return branch.opens && branch.closes ? `${branch.opens} a ${branch.closes}` : "";
}

/** El mapa de una sucursal. Sin calle cargada, el del consultorio, con el mismo criterio que branchPlace. */
export function branchMapEmbed(branch: Branch, installation: Installation): string {
  if (!branch.address) return mapEmbedOf(installation);
  return `https://maps.google.com/maps?q=${encodeURIComponent(branchPlace(branch, installation))}&output=embed`;
}

/** El "Cómo llegar" de una sucursal, con el mismo criterio que el mapa. */
export function branchDirections(branch: Branch, installation: Installation): string {
  if (!branch.address) return directionsOf(installation);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(branchPlace(branch, installation))}`;
}
